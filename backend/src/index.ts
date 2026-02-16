import { app } from './app';
import { env } from './config/env';
import { connectDatabases, disconnectDatabases } from './config/database';
import { getRedis, closeRedis } from './config/redis';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    // Connect to databases
    await connectDatabases();
    logger.info('All databases connected');

    // Initialize Redis
    if (env.REDIS_ENABLED) {
      getRedis();
      logger.info('Redis initialized');
    } else {
      logger.warn('Redis disabled');
    }

    // Seed default roles if not exist
    await seedDefaultData();

    // Start server
    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Server started on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        apiVersion: env.API_VERSION,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabases();
        await closeRedis();
        logger.info('All connections closed. Exiting.');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Uncaught error handlers
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection', { reason });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

async function seedDefaultData(): Promise<void> {
  try {
    const { getAccountWalletDb } = await import('./config/database');
    const db = getAccountWalletDb();

    // Seed roles
    const roles = [
      { name: 'SUPER_ADMIN' as const, label: 'Super Administrator' },
      { name: 'ADMIN' as const, label: 'Administrator' },
      { name: 'MANAGER' as const, label: 'Manager' },
      { name: 'USER' as const, label: 'Regular User' },
    ];

    for (const role of roles) {
      await db.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      });
    }

    // Seed system settings
    const settings = [
      { key: 'commission_percentage', value: '2.5', type: 'number', label: 'Commission Percentage', group: 'wallet' },
      { key: 'topup_bonus_percent', value: '0', type: 'number', label: 'Top-up Bonus Percent', group: 'wallet' },
      { key: 'min_add_balance', value: '10', type: 'number', label: 'Minimum Add Balance', group: 'wallet' },
      { key: 'max_add_balance', value: '100000', type: 'number', label: 'Maximum Add Balance', group: 'wallet' },
      { key: 'max_single_transaction', value: '500000', type: 'number', label: 'Max Single Transaction', group: 'wallet' },
      { key: 'bkash_send_money_number', value: '', type: 'string', label: 'bKash Send Money Number', group: 'payment' },
      { key: 'nagad_send_money_number', value: '', type: 'string', label: 'Nagad Send Money Number', group: 'payment' },
      { key: 'rocket_send_money_number', value: '', type: 'string', label: 'Rocket Send Money Number', group: 'payment' },
      { key: 'sms_enabled', value: 'false', type: 'boolean', label: 'SMS Enabled', group: 'sms' },
      { key: 'sms_api_url', value: '', type: 'string', label: 'SMS API URL', group: 'sms' },
      { key: 'sms_api_key', value: '', type: 'string', label: 'SMS API Key', group: 'sms' },
      { key: 'sms_sender_id', value: '', type: 'string', label: 'SMS Sender ID', group: 'sms' },
      { key: 'sms_template_signup_otp', value: 'Your ISP Wallet verification code is: {{otp}}. Valid for {{expiryMinutes}} minutes. Do not share with anyone.', type: 'string', label: 'Signup OTP SMS Template', group: 'sms' },
      { key: 'sms_template_forgot_password_otp', value: 'Your password reset code is: {{otp}}. Valid for {{expiryMinutes}} minutes. If you did not request this, ignore this message.', type: 'string', label: 'Forgot Password OTP SMS Template', group: 'sms' },
      { key: 'platform_name', value: 'ISP Wallet Platform', type: 'string', label: 'Platform Name', group: 'general' },
      { key: 'support_phone', value: '09678123456', type: 'string', label: 'Support Phone', group: 'general' },
      { key: 'auto_refund_enabled', value: 'true', type: 'boolean', label: 'Auto Refund on Failure', group: 'service' },
    ];

    for (const setting of settings) {
      await db.systemSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    // Create default super admin if not exists
    const bcrypt = await import('bcrypt');
    const superAdminRole = await db.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });

    if (superAdminRole) {
      const existingAdmin = await db.user.findUnique({
        where: { mobile: '01700000000' },
      });

      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash('Admin@123', 12);
        const admin = await db.user.create({
          data: {
            mobile: '01700000000',
            passwordHash,
            fullName: 'Super Admin',
            status: 'ACTIVE',
            roleId: superAdminRole.id,
            isVerified: true,
          },
        });

        await db.wallet.create({
          data: {
            userId: admin.id,
            status: 'ACTIVE',
            cachedBalance: 0,
          },
        });

        logger.info('Default super admin created', {
          mobile: '01700000000',
          password: 'Admin@123',
        });
      }
    }

    logger.info('Default data seeded successfully');
  } catch (error) {
    logger.error('Error seeding default data', { error });
  }
}

bootstrap();
