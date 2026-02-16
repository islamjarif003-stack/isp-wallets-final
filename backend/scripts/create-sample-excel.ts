import * as ExcelJS from 'exceljs';
import path from 'path';

async function createSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Packages');

  sheet.columns = [
    { header: 'packageId', key: 'packageId', width: 20 },
    { header: 'name', key: 'name', width: 30 },
    { header: 'price', key: 'price', width: 10 },
    { header: 'bandwidth', key: 'bandwidth', width: 15 },
    { header: 'dataLimit', key: 'dataLimit', width: 15 },
    { header: 'validity', key: 'validity', width: 10 },
    { header: 'serviceType', key: 'serviceType', width: 20 },
    { header: 'description', key: 'description', width: 40 },
  ];

  const packages = [
    {
      packageId: 'LEGACY-HI-001',
      name: 'Legacy Basic 3Mbps',
      price: 400,
      bandwidth: '3 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      serviceType: 'HOME_INTERNET',
      description: 'Legacy 3Mbps home internet package',
    },
    {
      packageId: 'LEGACY-HI-002',
      name: 'Legacy Standard 8Mbps',
      price: 700,
      bandwidth: '8 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      serviceType: 'HOME_INTERNET',
      description: 'Legacy 8Mbps home internet package',
    },
    {
      packageId: 'LEGACY-HI-003',
      name: 'Legacy Premium 15Mbps',
      price: 1000,
      bandwidth: '15 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      serviceType: 'HOME_INTERNET',
      description: 'Legacy 15Mbps home internet package',
    },
    {
      packageId: 'LEGACY-HS-001',
      name: 'Legacy Hotspot 2Hr',
      price: 25,
      bandwidth: '5 Mbps',
      dataLimit: '1 GB',
      validity: 1,
      serviceType: 'HOTSPOT_WIFI',
      description: 'Legacy 2 hour hotspot voucher',
    },
    {
      packageId: 'LEGACY-HS-002',
      name: 'Legacy Hotspot Day',
      price: 45,
      bandwidth: '8 Mbps',
      dataLimit: '2 GB',
      validity: 1,
      serviceType: 'HOTSPOT_WIFI',
      description: 'Legacy daily hotspot voucher',
    },
  ];

  packages.forEach((pkg) => sheet.addRow(pkg));
  sheet.getRow(1).font = { bold: true };

  const filePath = path.resolve('./data/legacy-packages.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Sample Excel created at: ${filePath}`);
}

createSampleExcel().catch((err) => {
  console.error('❌ Failed to create sample Excel:', err);
  process.exit(1);
});