import { getServiceDb } from '../../config/database';
import { getAccountWalletDb } from '../../config/database';
import { WalletService } from '../wallet/wallet.service';
import { getExcelReader } from './excel/excel-reader.service';
import { withLock } from '../../utils/distributed-lock';
import { generateIdempotencyKey, generateTransactionId } from '../../utils/idempotency';
import { getLogger } from '../../utils/logger';
import { paginationMeta } from '../../utils/helpers';
import { createAuditLog } from '../../utils/audit';
import {
  notifyServicePurchased,
  notifyServiceCompleted,
  notifyServiceFailed,
  notifyRefundProcessed,
} from '../notification/notification.queue';
import { AppError, NotFoundError, ConflictError, ForbiddenError, InsufficientBalanceError } from '../../utils/errors';

import {
  CreatePackageInput,
  UpdatePackageInput,
  PurchaseHomeInternetInput,
  PurchaseHotspotInput,
  PurchaseMobileRechargeInput,
  PurchaseElectricityInput,
  ServiceExecutionResult,
} from './service.types';
import { executeHomeInternetActivation } from './executors/home-internet.executor';
import { executeHotspotActivation } from './executors/hotspot.executor';
import { executeMobileRecharge } from './executors/mobile-recharge.executor';
import { executeElectricityPayment } from './executors/electricity.executor';
import { ServiceType, ExecutionStatus, PackageStatus } from '@prisma/service-client';

export class ServiceService {
  private serviceDb = getServiceDb();
  private walletDb = getAccountWalletDb();
  private walletService = new WalletService();
  private excelReader = getExcelReader();
  private logger = getLogger();

  // ═══════════════════════════════════════════════════════════════
  // PACKAGE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async getPackages(
    serviceType?: ServiceType,
    includeInactive: boolean = false,
    page: number = 1,
    limit: number = 50
  ) {
    const where: any = {};
    if (serviceType) where.serviceType = serviceType;
    if (!includeInactive) where.status = PackageStatus.ACTIVE;

    const [packages, total] = await Promise.all([
      this.serviceDb.servicePackage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.servicePackage.count({ where }),
    ]);

    return {
      packages: packages.map((p: any) => ({
        ...p,
        price: parseFloat(p.price.toString()),
        commission: parseFloat(p.commission.toString()),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  async getPackageById(packageId: string) {
    // Step 1: Check DB first
    let pkg = await this.serviceDb.servicePackage.findUnique({
      where: { id: packageId },
    });

    if (pkg) {
      return {
        ...pkg,
        price: parseFloat(pkg.price.toString()),
        commission: parseFloat(pkg.commission.toString()),
      };
    }

    // Step 2: Not in DB — LAZY IMPORT from Excel
    return this.lazyImportFromExcel(packageId);
  }

  /**
   * LAZY IMPORT:
   * 1) Check DB → if found, return
   * 2) If not found → Check Excel
   * 3) If found in Excel → Insert to DB → return
   * 4) If not in Excel → Block (return null)
   */
  private async lazyImportFromExcel(excelPackageId: string) {
    const excelPackage = this.excelReader.findPackageById(excelPackageId);

    if (!excelPackage) {
      return null;
    }

    // Check if already imported by excel ID
    const existingImport = await this.serviceDb.servicePackage.findUnique({
      where: { excelPackageId: excelPackage.packageId },
    });

    if (existingImport) {
      return {
        ...existingImport,
        price: parseFloat(existingImport.price.toString()),
        commission: parseFloat(existingImport.commission.toString()),
      };
    }

    // Import to DB
    let serviceType: ServiceType = ServiceType.HOME_INTERNET;
    const typeMap: Record<string, ServiceType> = {
      HOME_INTERNET: ServiceType.HOME_INTERNET,
      HOTSPOT_WIFI: ServiceType.HOTSPOT_WIFI,
      MOBILE_RECHARGE: ServiceType.MOBILE_RECHARGE,
      ELECTRICITY_BILL: ServiceType.ELECTRICITY_BILL,
      SET_TOP_BOX: ServiceType.SET_TOP_BOX,
    };
    if (typeMap[excelPackage.serviceType.toUpperCase()]) {
      serviceType = typeMap[excelPackage.serviceType.toUpperCase()];
    }

    try {
      const imported = await this.serviceDb.servicePackage.create({
        data: {
          serviceType,
          name: excelPackage.name,
          description: excelPackage.description || null,
          price: excelPackage.price,
          commission: 0,
          validity: excelPackage.validity || null,
          bandwidth: excelPackage.bandwidth || null,
          dataLimit: excelPackage.dataLimit || null,
          status: PackageStatus.ACTIVE,
          excelPackageId: excelPackage.packageId,
        },
      });

      this.logger.info('Package lazy-imported from Excel', {
        excelPackageId: excelPackage.packageId,
        dbId: imported.id,
        name: imported.name,
      });

      return {
        ...imported,
        price: parseFloat(imported.price.toString()),
        commission: parseFloat(imported.commission.toString()),
      };
    } catch (error) {
      this.logger.error('Failed to lazy-import Excel package', {
        excelPackageId: excelPackage.packageId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async createPackage(input: CreatePackageInput) {
    const pkg = await this.serviceDb.servicePackage.create({
      data: {
        serviceType: input.serviceType,
        name: input.name,
        description: input.description || null,
        price: input.price,
        commission: input.commission,
        validity: input.validity || null,
        bandwidth: input.bandwidth || null,
        dataLimit: input.dataLimit || null,
        metadata: input.metadata || undefined,
        sortOrder: input.sortOrder || 0,
      },
    });

    this.logger.info('Package created', { id: pkg.id, name: pkg.name });

    return {
      ...pkg,
      price: parseFloat(pkg.price.toString()),
      commission: parseFloat(pkg.commission.toString()),
    };
  }

  async updatePackage(packageId: string, input: UpdatePackageInput) {
    const existing = await this.serviceDb.servicePackage.findUnique({
      where: { id: packageId },
    });

    if (!existing) {
      throw new NotFoundError('Package not found');
    }

    const updated = await this.serviceDb.servicePackage.update({
      where: { id: packageId },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        price: input.price ?? undefined,
        commission: input.commission ?? undefined,
        validity: input.validity ?? undefined,
        bandwidth: input.bandwidth ?? undefined,
        dataLimit: input.dataLimit ?? undefined,
        status: input.status ?? undefined,
        metadata: input.metadata ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
      },
    });

    return {
      ...updated,
      price: parseFloat(updated.price.toString()),
      commission: parseFloat(updated.commission.toString()),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE HOME INTERNET
  // ═══════════════════════════════════════════════════════════════

  async purchaseHomeInternet(
    input: PurchaseHomeInternetInput
  ): Promise<ServiceExecutionResult> {
    const lockKey = `service:home:${input.connectionId}`;

    return withLock(lockKey, async () => {
      // 1. Get package (with lazy Excel import)
      const pkg = await this.getPackageById(input.packageId);
      if (!pkg) {
        throw new NotFoundError('Package not found');
      }
      if (pkg.status !== PackageStatus.ACTIVE) {
        throw new AppError('Package is not active', 400);
      }
      if (pkg.serviceType !== ServiceType.HOME_INTERNET) {
        throw new AppError('Package is not a home internet package', 400);
      }

      // 2. Check ownership — prevent duplicate active connections
      const existingActive = await this.serviceDb.homeService.findFirst({
        where: {
          connectionId: input.connectionId,
          status: PackageStatus.ACTIVE,
        },
      });

      if (existingActive) {
        const isExpired = existingActive.expiresAt && existingActive.expiresAt <= new Date();

        if (isExpired || !existingActive.expiresAt) {
          // Auto-release expired connection
          await this.serviceDb.homeService.update({
            where: { id: existingActive.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          if (existingActive.userId !== input.userId) {
            throw new ForbiddenError('This connection is owned by another user', {
              expiresAt: existingActive.expiresAt,
            });
          }
          throw new ConflictError('Connection already has an active package');
        }
      }

      // 3. Calculate cost
      const price = pkg.price;
      const commission = await this.walletService.calculateCommission(price);
      const idempotencyKey = generateIdempotencyKey();
      const availableBalance = await this.walletService.getAvailableBalance(
        input.walletId,
        input.userId
      );
      const totalRequired = price + commission;
      if (availableBalance < totalRequired) {
        throw new InsufficientBalanceError('Insufficient balance');
      }

      // 4. Create execution log (PENDING)
      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: ServiceType.HOME_INTERNET,
          serviceRecordId: 'PENDING',
          packageId: pkg.id,
          userId: input.userId,
          status: ExecutionStatus.PENDING,
          executionMethod: 'AUTOMATIC',
          requestPayload: input as any,
        },
      });

      // 5. DEBIT wallet BEFORE execution
      let walletTx;
      try {
        walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: price,
          category: 'SERVICE_PURCHASE',
          idempotencyKey,
          description: `Home Internet: ${pkg.name} for connection ${input.connectionId}`,
          referenceType: 'HOME_SERVICE',
          referenceId: executionLog.id,
          commission,
          metadata: {
            packageId: pkg.id,
            packageName: pkg.name,
            connectionId: input.connectionId,
          },
        });
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          await this.serviceDb.serviceExecutionLog.delete({
            where: { id: executionLog.id },
          });
          throw error;
        }

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Wallet debit failed',
            completedAt: new Date(),
            walletTransactionId: walletTx?.transactionId,
          },
        });
        throw error;
      }

      // 6. Update execution log to EXECUTING
      await this.serviceDb.serviceExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.EXECUTING,
          walletTransactionId: walletTx.transactionId,
          startedAt: new Date(),
        },
      });

      // 7. Execute activation
      try {

        const result = await executeHomeInternetActivation({
          connectionId: input.connectionId,
          packageName: pkg.name,
          subscriberName: input.subscriberName,
          bandwidth: pkg.bandwidth || undefined,
          validity: pkg.validity ? String(pkg.validity) : undefined,
              amount: pkg.price,
              execution: executionLog,
        });

        // The executionLog status is already EXECUTING from step 6.
        // We will not update it to COMPLETED here.
        // We will not create the homeService record here.
        // The actual service completion/failure will be handled by BullMQ listeners.

        this.logger.info('Home internet renewal job queued', {
          executionLogId: executionLog.id,
          connectionId: input.connectionId,
          transactionId: walletTx.transactionId,
        });

        return {
          serviceRecordId: executionLog.serviceRecordId,
          executionLogId: executionLog.id,
          status: ExecutionStatus.EXECUTING,
          walletTransactionId: walletTx.transactionId,
          message: result.message,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errMsg.toLowerCase().includes('not implemented')) {
          await this.serviceDb.serviceExecutionLog.update({
            where: { id: executionLog.id },
            data: {
              status: ExecutionStatus.PENDING,
              executionMethod: 'MANUAL',
              startedAt: null,
              errorMessage: null,
            },
          });

          return {
            serviceRecordId: executionLog.serviceRecordId,
            executionLogId: executionLog.id,
            status: ExecutionStatus.PENDING,
            walletTransactionId: walletTx.transactionId,
            message: 'Home internet request submitted. Awaiting admin processing.',
          };
        }

        // EXECUTION FAILED — AUTO REFUND
        return this.handleExecutionFailure(
          executionLog.id,
          walletTx.transactionId,
          input.userId,
          pkg.name,
          error
        );
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE HOTSPOT
  // ═══════════════════════════════════════════════════════════════

  async purchaseHotspot(
    input: PurchaseHotspotInput
  ): Promise<ServiceExecutionResult> {
    const lockKey = `service:hotspot:${input.userId}:${input.packageId}:${Date.now()}`;

    return withLock(lockKey, async () => {
      const pkg = await this.getPackageById(input.packageId);
      if (!pkg) throw new NotFoundError('Package not found');
      if (pkg.status !== PackageStatus.ACTIVE) throw new AppError('Package is not active', 400);
      if (pkg.serviceType !== 'HOTSPOT_WIFI') throw new AppError('Not a hotspot package', 400);

      const price = pkg.price;
      const commission = await this.walletService.calculateCommission(price);
      const idempotencyKey = generateIdempotencyKey();
      const availableBalance = await this.walletService.getAvailableBalance(
        input.walletId,
        input.userId
      );
      const totalRequired = price + commission;
      if (availableBalance < totalRequired) {
        throw new InsufficientBalanceError('Insufficient balance');
      }

      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: ServiceType.HOTSPOT_WIFI,
          serviceRecordId: 'PENDING',
          packageId: pkg.id,
          userId: input.userId,
          status: ExecutionStatus.PENDING,
          executionMethod: 'AUTOMATIC',
          requestPayload: input as any,
        },
      });

      let walletTx;
      try {
        walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: price,
          category: 'SERVICE_PURCHASE',
          idempotencyKey,
          description: `Hotspot WiFi: ${pkg.name}`,
          referenceType: 'HOTSPOT_SERVICE',
          referenceId: executionLog.id,
          commission,
          metadata: { packageId: pkg.id, packageName: pkg.name },
        });
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          await this.serviceDb.serviceExecutionLog.delete({
            where: { id: executionLog.id },
          });
          throw error;
        }

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Wallet debit failed',
            completedAt: new Date(),
            walletTransactionId: walletTx?.transactionId,
          },
        });
        throw error;
      }

      await this.serviceDb.serviceExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.EXECUTING,
          walletTransactionId: walletTx.transactionId,
          startedAt: new Date(),
        },
      });

      try {
        const result = await executeHotspotActivation({
          packageName: pkg.name,
          deviceMac: input.deviceMac,
          zoneId: input.zoneId,
          bandwidth: pkg.bandwidth || undefined,
          validity: pkg.validity || undefined,
          dataLimit: pkg.dataLimit || undefined,
        });

        if (!result.success) {
          throw new Error(result.message || 'Hotspot activation failed');
        }

        const hotspotService = await this.serviceDb.hotspotService.create({
          data: {
            userId: input.userId,
            packageId: pkg.id,
            deviceMac: input.deviceMac || null,
            voucherCode: result.voucherCode || null,
            zoneId: input.zoneId || null,
            status: PackageStatus.ACTIVE,
            activatedAt: result.activatedAt || new Date(),
            expiresAt: result.expiresAt || null,
            walletTransactionId: walletTx.transactionId,
          },
        });

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.COMPLETED,
            serviceRecordId: hotspotService.id,
            completedAt: new Date(),
            duration: Date.now() - (executionLog.createdAt?.getTime() || Date.now()),
            responsePayload: result as any,
          },
        });

        notifyServiceCompleted(input.userId, pkg.name);

        this.logger.info('Hotspot purchase completed', {
          serviceId: hotspotService.id,
          voucherCode: result.voucherCode,
          transactionId: walletTx.transactionId,
        });

        return {
          serviceRecordId: hotspotService.id,
          executionLogId: executionLog.id,
          status: 'COMPLETED' as ExecutionStatus,
          walletTransactionId: walletTx.transactionId,
          message: result.message,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errMsg.toLowerCase().includes('not implemented')) {
          await this.serviceDb.serviceExecutionLog.update({
            where: { id: executionLog.id },
            data: {
              status: ExecutionStatus.PENDING,
              executionMethod: 'MANUAL',
              startedAt: null,
              errorMessage: null,
            },
          });

          return {
            serviceRecordId: executionLog.serviceRecordId,
            executionLogId: executionLog.id,
            status: 'PENDING' as ExecutionStatus,
            walletTransactionId: walletTx.transactionId,
            message: 'Hotspot request submitted. Awaiting admin processing.',
          };
        }

        return this.handleExecutionFailure(
          executionLog.id,
          walletTx.transactionId,
          input.userId,
          pkg.name,
          error
        );
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE MOBILE RECHARGE
  // ═══════════════════════════════════════════════════════════════

  async purchaseMobileRecharge(
    input: PurchaseMobileRechargeInput
  ): Promise<ServiceExecutionResult> {
    const lockKey = `service:recharge:${input.mobileNumber}:${Date.now()}`;

    return withLock(lockKey, async () => {
      const commission = await this.walletService.calculateCommission(input.amount);
      const idempotencyKey = generateIdempotencyKey();
      const availableBalance = await this.walletService.getAvailableBalance(
        input.walletId,
        input.userId
      );
      const totalRequired = input.amount + commission;
      if (availableBalance < totalRequired) {
        throw new InsufficientBalanceError('Insufficient balance');
      }

      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: ServiceType.MOBILE_RECHARGE,
          serviceRecordId: 'PENDING',
          userId: input.userId,
          status: ExecutionStatus.PENDING,
          executionMethod: 'AUTOMATIC',
          requestPayload: {
            mobileNumber: input.mobileNumber,
            operator: input.operator,
            amount: input.amount,
            rechargeType: input.rechargeType,
          } as any,
        },
      });

      let walletTx;
      try {
        walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: input.amount,
          category: 'SERVICE_PURCHASE',
          idempotencyKey,
          description: `Mobile Recharge: ৳${input.amount} to ${input.mobileNumber} (${input.operator})`,
          referenceType: 'MOBILE_RECHARGE',
          referenceId: executionLog.id,
          commission,
          metadata: {
            mobileNumber: input.mobileNumber,
            operator: input.operator,
            rechargeType: input.rechargeType,
          },
        });
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          await this.serviceDb.serviceExecutionLog.delete({
            where: { id: executionLog.id },
          });
          throw error;
        }

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Wallet debit failed',
            completedAt: new Date(),
          },
        });
        throw error;
      }

      await this.serviceDb.serviceExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.EXECUTING,
          walletTransactionId: walletTx.transactionId,
          startedAt: new Date(),
        },
      });

      try {
        const result = await executeMobileRecharge({
          mobileNumber: input.mobileNumber,
          operator: input.operator,
          amount: input.amount,
          rechargeType: input.rechargeType,
        });

        if (!result.success) {
          throw new Error(result.message || 'Recharge failed');
        }

        const rechargeRecord = await this.serviceDb.mobileRecharge.create({
          data: {
            userId: input.userId,
            mobileNumber: input.mobileNumber,
            operator: input.operator,
            amount: input.amount,
            rechargeType: input.rechargeType,
            executionStatus: 'COMPLETED',
            externalReference: result.externalReference || null,
            walletTransactionId: walletTx.transactionId,
          },
        });

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.COMPLETED,
            serviceRecordId: rechargeRecord.id,
            completedAt: new Date(),
            duration: Date.now() - (executionLog.createdAt?.getTime() || Date.now()),
            responsePayload: result as any,
          },
        });

        notifyServiceCompleted(input.userId, `Mobile Recharge ৳${input.amount}`);

        this.logger.info('Mobile recharge completed', {
          serviceId: rechargeRecord.id,
          transactionId: walletTx.transactionId,
        });

        return {
          serviceRecordId: rechargeRecord.id,
          executionLogId: executionLog.id,
          status: 'COMPLETED' as ExecutionStatus,
          walletTransactionId: walletTx.transactionId,
          message: result.message,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errMsg.toLowerCase().includes('executor not implemented')) {
          const rechargeRecord = await this.serviceDb.mobileRecharge.create({
            data: {
              userId: input.userId,
              mobileNumber: input.mobileNumber,
              operator: input.operator,
              amount: input.amount,
              rechargeType: input.rechargeType,
              executionStatus: 'PENDING',
              walletTransactionId: walletTx.transactionId,
              failureReason: null,
            },
          });

          await this.serviceDb.serviceExecutionLog.update({
            where: { id: executionLog.id },
            data: {
              status: ExecutionStatus.PENDING,
              executionMethod: 'MANUAL',
              serviceRecordId: rechargeRecord.id,
              startedAt: null,
              errorMessage: null,
            },
          });

          return {
            serviceRecordId: rechargeRecord.id,
            executionLogId: executionLog.id,
            status: 'PENDING' as ExecutionStatus,
            walletTransactionId: walletTx.transactionId,
            message: 'Recharge request submitted. Awaiting admin processing.',
          };
        }

        // Update mobile recharge record as failed
        await this.serviceDb.mobileRecharge.create({
          data: {
            userId: input.userId,
            mobileNumber: input.mobileNumber,
            operator: input.operator,
            amount: input.amount,
            rechargeType: input.rechargeType,
            executionStatus: 'FAILED',
            walletTransactionId: walletTx.transactionId,
            failureReason: errMsg,
          },
        }).catch((e: any) => this.logger.error('Failed to create recharge failure record', { error: e }));

        return this.handleExecutionFailure(
          executionLog.id,
          walletTx.transactionId,
          input.userId,
          `Mobile Recharge ৳${input.amount}`,
          error
        );
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE ELECTRICITY BILL
  // ═══════════════════════════════════════════════════════════════

  async purchaseElectricityBill(
    input: PurchaseElectricityInput
  ): Promise<ServiceExecutionResult> {
    const lockKey = `service:electricity:${input.meterNumber}:${Date.now()}`;

    return withLock(lockKey, async () => {
      const commission = await this.walletService.calculateCommission(input.amount);
      const idempotencyKey = generateIdempotencyKey();
      const availableBalance = await this.walletService.getAvailableBalance(
        input.walletId,
        input.userId
      );
      const totalRequired = input.amount + commission;
      if (availableBalance < totalRequired) {
        throw new InsufficientBalanceError('Insufficient balance');
      }

      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: ServiceType.ELECTRICITY_BILL,
          serviceRecordId: 'PENDING',
          userId: input.userId,
          status: ExecutionStatus.PENDING,
          executionMethod: 'AUTOMATIC',
          requestPayload: {
            meterNumber: input.meterNumber,
            provider: input.provider,
            amount: input.amount,
            billMonth: input.billMonth,
          } as any,
        },
      });

      let walletTx;
      try {
        walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: input.amount,
          category: 'SERVICE_PURCHASE',
          idempotencyKey,
          description: `Electricity Bill: ৳${input.amount} for meter ${input.meterNumber} (${input.provider})`,
          referenceType: 'ELECTRICITY_BILL',
          referenceId: executionLog.id,
          commission,
          metadata: {
            meterNumber: input.meterNumber,
            provider: input.provider,
            billMonth: input.billMonth,
          },
        });
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          await this.serviceDb.serviceExecutionLog.delete({
            where: { id: executionLog.id },
          });
          throw error;
        }

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Wallet debit failed',
            completedAt: new Date(),
          },
        });
        throw error;
      }

      await this.serviceDb.serviceExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.EXECUTING,
          walletTransactionId: walletTx.transactionId,
          startedAt: new Date(),
        },
      });

      try {
        const result = await executeElectricityPayment({
          meterNumber: input.meterNumber,
          provider: input.provider,
          amount: input.amount,
          billMonth: input.billMonth,
          accountHolder: input.accountHolder,
        });

        if (!result.success) {
          throw new Error(result.message || 'Bill payment failed');
        }

        const billRecord = await this.serviceDb.electricityBill.create({
          data: {
            userId: input.userId,
            meterNumber: input.meterNumber,
            provider: input.provider,
            accountHolder: input.accountHolder || null,
            amount: input.amount,
            billMonth: input.billMonth || null,
            executionStatus: 'COMPLETED',
            externalReference: result.externalReference || null,
            walletTransactionId: walletTx.transactionId,
          },
        });

        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: ExecutionStatus.COMPLETED,
            serviceRecordId: billRecord.id,
            completedAt: new Date(),
            duration: Date.now() - (executionLog.createdAt?.getTime() || Date.now()),
            responsePayload: result as any,
          },
        });

        notifyServiceCompleted(input.userId, `Electricity Bill ৳${input.amount}`);

        this.logger.info('Electricity bill payment completed', {
          serviceId: billRecord.id,
          transactionId: walletTx.transactionId,
        });

        return {
          serviceRecordId: billRecord.id,
          executionLogId: executionLog.id,
          status: 'COMPLETED' as ExecutionStatus,
          walletTransactionId: walletTx.transactionId,
          message: result.message,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errMsg.toLowerCase().includes('not implemented')) {
          const billRecord = await this.serviceDb.electricityBill.create({
            data: {
              userId: input.userId,
              meterNumber: input.meterNumber,
              provider: input.provider,
              accountHolder: input.accountHolder || null,
              amount: input.amount,
              billMonth: input.billMonth || null,
              executionStatus: 'PENDING',
              walletTransactionId: walletTx.transactionId,
              failureReason: null,
            },
          });

          await this.serviceDb.serviceExecutionLog.update({
            where: { id: executionLog.id },
            data: {
              status: ExecutionStatus.PENDING,
              executionMethod: 'MANUAL',
              serviceRecordId: billRecord.id,
              startedAt: null,
              errorMessage: null,
            },
          });

          return {
            serviceRecordId: billRecord.id,
            executionLogId: executionLog.id,
            status: 'PENDING' as ExecutionStatus,
            walletTransactionId: walletTx.transactionId,
            message: 'Bill payment request submitted. Awaiting admin processing.',
          };
        }

        await this.serviceDb.electricityBill.create({
          data: {
            userId: input.userId,
            meterNumber: input.meterNumber,
            provider: input.provider,
            accountHolder: input.accountHolder || null,
            amount: input.amount,
            billMonth: input.billMonth || null,
            executionStatus: 'FAILED',
            walletTransactionId: walletTx.transactionId,
            failureReason: errMsg,
          },
        }).catch((e: any) => this.logger.error('Failed to create bill failure record', { error: e }));

        return this.handleExecutionFailure(
          executionLog.id,
          walletTx.transactionId,
          input.userId,
          `Electricity Bill ৳${input.amount}`,
          error
        );
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EXECUTION FAILURE + AUTO REFUND
  // ═══════════════════════════════════════════════════════════════

  public async handleExecutionFailure(
    executionLogId: string,
    walletTransactionId: string,
    userId: string,
    serviceName: string,
    error: unknown
  ): Promise<ServiceExecutionResult> {
    this.logger.debug('handleExecutionFailure called', { executionLogId, walletTransactionId, userId, serviceName, error });
    let errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

    if (error instanceof AppError && error.details?.expiresAt) {
      errorMessage += ` (Available after: ${new Date(error.details.expiresAt).toLocaleString()})`;
    }

    this.logger.error('Service execution failed, initiating auto-refund', {
      executionLogId,
      walletTransactionId,
      userId,
      serviceName,
      error: errorMessage,
    });

    // Notify failure
    notifyServiceFailed(userId, serviceName);

    // Check if auto-refund is enabled
    const walletDb = getAccountWalletDb();
    const autoRefundSetting = await walletDb.systemSetting.findUnique({
      where: { key: 'auto_refund_enabled' },
    });

    const autoRefundEnabled = autoRefundSetting?.value === 'true';
    this.logger.debug('Auto-refund check before refundTransaction', { executionLogId, walletTransactionId, autoRefundEnabled });

    let refundTransactionId: string | undefined;

    if (autoRefundEnabled) {
      try {
        const refundResult = await this.walletService.refundTransaction({
          originalTransactionId: walletTransactionId,
          reason: `Service execution failed: ${errorMessage}`,
          initiatedBy: 'SYSTEM_AUTO_REFUND',
        });

        refundTransactionId = refundResult.transactionId;

        // Get new balance for notification
        const walletBalance = await this.walletService.getBalance(
          refundResult.walletId
        );

        notifyRefundProcessed(userId, refundResult.amount, walletBalance.balance);

        this.logger.info('Auto-refund processed', {
          executionLogId,
          refundTransactionId,
          amount: refundResult.amount,
        });
      } catch (refundError) {
        this.logger.error('AUTO-REFUND FAILED - CRITICAL', {
          executionLogId,
          walletTransactionId,
          userId,
          refundError: refundError instanceof Error ? refundError.message : refundError,
        });
        // This is a critical failure - must be manually resolved
      }
    } else {
      this.logger.warn('Auto-refund disabled, manual refund required', {
        executionLogId,
        walletTransactionId,
      });
    }

    // Update execution log
    await this.serviceDb.serviceExecutionLog.update({
      where: { id: executionLogId },
      data: {
        status: refundTransactionId ? 'REFUNDED' : 'FAILED',
        refundTransactionId: refundTransactionId || null,
        errorMessage,
        completedAt: new Date(),
        duration: Date.now() - Date.now(), // Will be close to 0 for the update
      },
    });

    return {
      serviceRecordId: '',
      executionLogId,
      status: (refundTransactionId ? 'REFUNDED' : 'FAILED') as ExecutionStatus,
      walletTransactionId,
      refundTransactionId,
      message: refundTransactionId
        ? `Service failed. ৳ has been refunded to your wallet.`
        : `Service failed: ${errorMessage}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN MANUAL EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async adminManualExecute(
    executionLogId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    const execLog = await this.serviceDb.serviceExecutionLog.findUnique({
      where: { id: executionLogId },
    });

    if (!execLog) {
      throw new NotFoundError('Execution log not found');
    }

    if (execLog.status === 'COMPLETED') {
      throw new ConflictError('Service already completed');
    }

    if (execLog.status === 'REFUNDED') {
      throw new ConflictError('Service was refunded. Cannot re-execute.');
    }

    let serviceRecordId: string | null = null;

    if (execLog.serviceType === 'HOME_INTERNET') {
      const payload = (execLog.requestPayload || {}) as any;
      const connectionId = String(payload.connectionId || '').trim();
      if (!connectionId) throw new AppError('Missing connectionId in request payload', 400);
      if (!execLog.packageId) throw new AppError('Missing packageId for home internet service', 400);

      const pkg = await this.getPackageById(execLog.packageId);
      if (!pkg) throw new NotFoundError('Package not found');

      const activatedAt = new Date();
      const expiresAt =
        pkg.validity && Number.isFinite(Number(pkg.validity))
          ? new Date(activatedAt.getTime() + Number(pkg.validity) * 24 * 60 * 60 * 1000)
          : null;

      // FORCE ASSIGNMENT (Upsert)
      // This handles both new assignments and taking over expired/released connections
      const homeService = await this.serviceDb.homeService.upsert({
        where: { connectionId },
        update: {
          userId: execLog.userId,
          packageId: execLog.packageId,
          subscriberName: String(payload.subscriberName || ''),
          address: String(payload.address || ''),
          area: payload.area ? String(payload.area) : null,
          status: 'ACTIVE',
          activatedAt,
          expiresAt,
          walletTransactionId: execLog.walletTransactionId || undefined,
        },
        create: {
          userId: execLog.userId,
          packageId: execLog.packageId,
          connectionId,
          subscriberName: String(payload.subscriberName || ''),
          address: String(payload.address || ''),
          area: payload.area ? String(payload.area) : null,
          status: 'ACTIVE',
          activatedAt,
          expiresAt,
          walletTransactionId: execLog.walletTransactionId || null,
        },
      });
      serviceRecordId = homeService.id;
    }

    if (execLog.serviceType === 'HOTSPOT_WIFI') {
      const payload = (execLog.requestPayload || {}) as any;
      if (!execLog.packageId) throw new AppError('Missing packageId for hotspot service', 400);

      const pkg = await this.getPackageById(execLog.packageId);
      if (!pkg) throw new NotFoundError('Package not found');

      const activatedAt = new Date();
      const expiresAt =
        pkg.validity && Number.isFinite(Number(pkg.validity))
          ? new Date(activatedAt.getTime() + Number(pkg.validity) * 24 * 60 * 60 * 1000)
          : null;

      const created = await this.serviceDb.hotspotService.create({
        data: {
          userId: execLog.userId,
          packageId: execLog.packageId,
          deviceMac: payload.deviceMac ? String(payload.deviceMac) : null,
          voucherCode: null,
          zoneId: payload.zoneId ? String(payload.zoneId) : null,
          status: 'ACTIVE',
          activatedAt,
          expiresAt,
          walletTransactionId: execLog.walletTransactionId || null,
        },
      });
      serviceRecordId = created.id;
    }

    if (execLog.serviceType === 'MOBILE_RECHARGE' && execLog.serviceRecordId && execLog.serviceRecordId !== 'PENDING') {
      await this.serviceDb.mobileRecharge.update({
        where: { id: execLog.serviceRecordId },
        data: { executionStatus: 'COMPLETED' },
      }).catch(() => null);
    }

    if (execLog.serviceType === 'ELECTRICITY_BILL' && execLog.serviceRecordId && execLog.serviceRecordId !== 'PENDING') {
      await this.serviceDb.electricityBill.update({
        where: { id: execLog.serviceRecordId },
        data: { executionStatus: 'COMPLETED' },
      }).catch(() => null);
    }

    if (execLog.serviceType === 'SET_TOP_BOX') {
        // STB Manual Completion Logic
        const payload = (execLog.requestPayload || {}) as any;
        const validityDays = payload.validityDays || 30; // Default or from payload
        const stbNumber = payload.stbNumber;
        
        if (!stbNumber) {
            throw new AppError('STB Number missing in log payload', 400);
        }

        // We need packageId. In log it is in requestPayload.stbPackageId because log.packageId is null
        const packageId = payload.stbPackageId;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + validityDays);

        const created = await this.serviceDb.stbService.create({
            data: {
                userId: execLog.userId,
                stbNumber: stbNumber,
                packageId: packageId, // This must be a valid UUID for StbPackage
                status: 'ACTIVE',
                startDate,
                endDate,
                walletTransactionId: execLog.walletTransactionId || null
            }
        });
        serviceRecordId = created.id;
    }

    await this.serviceDb.serviceExecutionLog.update({
      where: { id: executionLogId },
      data: {
        status: 'COMPLETED',
        executedBy: adminId,
        executionMethod: 'MANUAL',
        serviceRecordId: serviceRecordId || execLog.serviceRecordId,
        completedAt: new Date(),
      },
    });

    // Audit log
    await createAuditLog({
      adminId,
      action: 'SERVICE_MANUAL_EXECUTE',
      resourceType: 'SERVICE_EXECUTION_LOG',
      resourceId: executionLogId,
      newData: {
        executionLogId,
        serviceType: execLog.serviceType,
        userId: execLog.userId,
      },
      reason: 'Manual execution by admin',
      ipAddress,
      userAgent,
    });

    this.logger.info('Service manually executed by admin', {
      executionLogId,
      adminId,
      serviceType: execLog.serviceType,
    });

    return {
      success: true,
      message: 'Service marked as completed by admin',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SERVICE HISTORY
  // ═══════════════════════════════════════════════════════════════

  async getUserServiceHistory(
    userId: string,
    serviceType?: ServiceType,
    status?: ExecutionStatus,
    page: number = 1,
    limit: number = 20
  ) {
    const where: any = { userId };
    if (serviceType) where.serviceType = serviceType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.serviceDb.serviceExecutionLog.findMany({
        where,
        include: {
          package: {
            select: {
              id: true,
              name: true,
              serviceType: true,
              price: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.serviceExecutionLog.count({ where }),
    ]);

    return {
      services: logs.map((log: any) => ({
        id: log.id,
        serviceType: log.serviceType,
        packageName: log.package?.name || log.requestPayload?.packageName || 'N/A',
        packagePrice: log.package 
          ? parseFloat(log.package.price.toString()) 
          : (log.requestPayload?.price ? Number(log.requestPayload.price) : 0),
        amount:
          typeof log.requestPayload?.amount === 'number'
            ? log.requestPayload.amount
            : log.requestPayload?.amount
              ? Number(log.requestPayload.amount)
              : log.requestPayload?.price
                ? Number(log.requestPayload.price)
                : 0,
        status: log.status,
        executionMethod: log.executionMethod,
        walletTransactionId: log.walletTransactionId,
        refundTransactionId: log.refundTransactionId,
        errorMessage: log.errorMessage,
        requestPayload: log.requestPayload,
        createdAt: log.createdAt,
        completedAt: log.completedAt,
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  // ─── Get user's active home services ─────────────────
  async getUserHomeServices(userId: string) {
    const services = await this.serviceDb.homeService.findMany({
      where: { userId },
      include: {
        package: {
          select: { name: true, bandwidth: true, dataLimit: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return services.map((s: any) => ({
      ...s,
      package: s.package
        ? {
            ...s.package,
            price: parseFloat(s.package.price.toString()),
          }
        : null,
    }));
  }

  // ─── Get user's active hotspot services ───────────────
  async getUserHotspotServices(userId: string) {
    const services = await this.serviceDb.hotspotService.findMany({
      where: { userId },
      include: {
        package: {
          select: { name: true, bandwidth: true, dataLimit: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return services.map((s: any) => ({
      ...s,
      package: s.package
        ? {
            ...s.package,
            price: parseFloat(s.package.price.toString()),
          }
        : null,
    }));
  }

  // ─── Get user's recharge history ──────────────────────
  async getUserRechargeHistory(userId: string, page: number = 1, limit: number = 20) {
    const [records, total] = await Promise.all([
      this.serviceDb.mobileRecharge.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.mobileRecharge.count({ where: { userId } }),
    ]);

    return {
      recharges: records.map((r: any) => ({
        ...r,
        amount: parseFloat(r.amount.toString()),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  // ─── Get user's electricity bill history ──────────────
  async getUserElectricityHistory(userId: string, page: number = 1, limit: number = 20) {
    const [records, total] = await Promise.all([
      this.serviceDb.electricityBill.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.electricityBill.count({ where: { userId } }),
    ]);

    return {
      bills: records.map((b: any) => ({
        ...b,
        amount: parseFloat(b.amount.toString()),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN: PENDING SERVICES
  // ═══════════════════════════════════════════════════════════════

  async getPendingServices(page: number = 1, limit: number = 20) {
    const where = {
      status: { in: ['PENDING' as const, 'EXECUTING' as const, 'FAILED' as const] },
    };

    const [logs, total] = await Promise.all([
      this.serviceDb.serviceExecutionLog.findMany({
        where,
        include: {
          package: {
            select: { name: true, serviceType: true, price: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.serviceExecutionLog.count({ where }),
    ]);

    const userIds = Array.from(
      new Set(
        logs
          .map((l: any) => l.userId)
          .filter((id: any) => typeof id === 'string' && id.length > 0)
      )
    );

    const users = userIds.length
      ? await this.walletDb.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, mobile: true, email: true },
        })
      : [];

    const userById = new Map<string, any>(users.map((u: any) => [u.id, u]));

    return {
      services: logs.map((log: any) => ({
        id: log.id,
        serviceType: log.serviceType,
        userId: log.userId,
        requester: userById.get(log.userId)
          ? {
              id: userById.get(log.userId).id,
              fullName: userById.get(log.userId).fullName,
              mobile: userById.get(log.userId).mobile,
              email: userById.get(log.userId).email,
            }
          : null,
        packageName: log.package?.name || 'N/A',
        status: log.status,
        executionMethod: log.executionMethod,
        errorMessage: log.errorMessage,
        walletTransactionId: log.walletTransactionId,
        requestPayload: log.requestPayload,
        createdAt: log.createdAt,
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  async adminReleaseHomeConnectionOwnership(
    connectionId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const existing = await this.serviceDb.homeService.findUnique({
      where: { connectionId },
    });

    if (!existing) {
      throw new NotFoundError('Connection not found');
    }

    // Fetch user from wallet DB since it's a separate database
    const user = await this.walletDb.user.findUnique({
      where: { id: existing.userId },
      select: { fullName: true, mobile: true },
    });

    await this.serviceDb.homeService.update({
      where: { connectionId },
      data: { status: 'EXPIRED', expiresAt: new Date() },
    });

    await createAuditLog({
      adminId,
      action: 'SYSTEM_CONFIG_CHANGE',
      targetUserId: existing.userId,
      resourceType: 'HOME_SERVICE',
      resourceId: connectionId,
      previousData: {
        id: existing.id,
        userId: existing.userId,
        connectionId: existing.connectionId,
        status: existing.status,
      },
      newData: { released: true },
      reason: 'Admin released home internet connection ownership',
      ipAddress,
      userAgent,
    });

    this.logger.info('Home internet connection ownership released by admin', {
      adminId,
      connectionId,
      previousUserId: existing.userId,
    });

    return {
      success: true,
      message: 'Connection ownership released',
      data: {
        connectionId: existing.connectionId,
        ownerName: user?.fullName,
        ownerMobile: user?.mobile,
        expiresAt: existing.expiresAt,
      },
    };
  }

  async getAllExecutionLogs(
    serviceType?: ServiceType,
    status?: ExecutionStatus,
    page: number = 1,
    limit: number = 20
  ) {
    const where: any = {};
    if (serviceType) where.serviceType = serviceType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.serviceDb.serviceExecutionLog.findMany({
        where,
        include: {
          package: {
            select: { name: true, serviceType: true, price: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.serviceDb.serviceExecutionLog.count({ where }),
    ]);

    return {
      logs: logs.map((log: any) => ({
        ...log,
        package: log.package
          ? {
              ...log.package,
              price: parseFloat(log.package.price.toString()),
            }
          : null,
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN: MANUAL REFUND
  // ═══════════════════════════════════════════════════════════════

  async adminManualRefund(
    executionLogId: string,
    adminId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string; refundTransactionId?: string }> {
    const execLog = await this.serviceDb.serviceExecutionLog.findUnique({
      where: { id: executionLogId },
    });

    if (!execLog) {
      throw new NotFoundError('Execution log not found');
    }

    if (execLog.status === 'REFUNDED') {
      throw new ConflictError('Already refunded');
    }

    if (!execLog.walletTransactionId) {
      throw new AppError('No wallet transaction to refund', 400);
    }

    const refundResult = await this.walletService.refundTransaction({
      originalTransactionId: execLog.walletTransactionId,
      reason: `Admin manual refund: ${reason}`,
      initiatedBy: adminId,
    });

    await this.serviceDb.serviceExecutionLog.update({
      where: { id: executionLogId },
      data: {
        status: 'REFUNDED',
        refundTransactionId: refundResult.transactionId,
        errorMessage: reason, // Store refund reason in errorMessage field for visibility
      },
    });

    await createAuditLog({
      adminId,
      action: 'SERVICE_REFUND',
      targetUserId: execLog.userId,
      resourceType: 'SERVICE_EXECUTION_LOG',
      resourceId: executionLogId,
      newData: {
        refundTransactionId: refundResult.transactionId,
        amount: refundResult.amount,
        reason,
      },
      reason,
      ipAddress,
      userAgent,
    });

    this.logger.info('Admin manual refund processed', {
      executionLogId,
      adminId,
      refundTransactionId: refundResult.transactionId,
    });

    return {
      success: true,
      message: 'Refund processed successfully',
      refundTransactionId: refundResult.transactionId,
    };
  }
}
