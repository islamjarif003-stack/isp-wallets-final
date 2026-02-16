import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { env } from '../../../config/env';

export type ExcelLegacyPackage = {
  packageId: string;
  name: string;
  price: number;
  bandwidth?: string;
  dataLimit?: string;
  validity?: number;
  serviceType: string;
  description?: string;
};

export class ExcelReaderService {
  private packagesById = new Map<string, ExcelLegacyPackage>();

  constructor(filePath: string) {
    this.load(filePath);
  }

  private load(filePath: string): void {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (!fs.existsSync(absPath)) return;

    const workbook = xlsx.readFile(absPath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return;

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    for (const row of rows) {
      const packageId = String(row.packageId || row.PackageId || row.PACKAGEID || '').trim();
      if (!packageId) continue;

      const pkg: ExcelLegacyPackage = {
        packageId,
        name: String(row.name || row.Name || '').trim(),
        price: Number(row.price ?? row.Price ?? 0),
        bandwidth: String(row.bandwidth || row.Bandwidth || '').trim() || undefined,
        dataLimit: String(row.dataLimit || row.DataLimit || '').trim() || undefined,
        validity:
          row.validity === '' || row.validity === undefined
            ? undefined
            : Number(row.validity),
        serviceType: String(row.serviceType || row.ServiceType || '').trim(),
        description: String(row.description || row.Description || '').trim() || undefined,
      };

      this.packagesById.set(pkg.packageId, pkg);
    }
  }

  findPackageById(packageId: string): ExcelLegacyPackage | null {
    return this.packagesById.get(packageId) || null;
  }
}

let excelReaderInstance: ExcelReaderService | null = null;

export function getExcelReader(): ExcelReaderService {
  if (!excelReaderInstance) {
    excelReaderInstance = new ExcelReaderService(env.EXCEL_LEGACY_PATH);
  }
  return excelReaderInstance;
}
