export interface ExcelRow {
  packageId: string;
  name: string;
  price: number;
  bandwidth?: string;
  dataLimit?: string;
  validity?: number;
  serviceType: string;
  description?: string;
}