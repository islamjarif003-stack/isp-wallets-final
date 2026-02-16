import { connectDatabases, disconnectDatabases } from './config/database';
import { getAccountWalletDb } from './config/database';
import { getServiceDb } from './config/database';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('🌱 Starting seed...');

  await connectDatabases();

  const walletDb = getAccountWalletDb();
  const serviceDb = getServiceDb();

  // ═══════ SEED ROLES ═══════
  console.log('Seeding roles...');
  const roles = [
    { name: 'SUPER_ADMIN' as const, label: 'Super Administrator' },
    { name: 'ADMIN' as const, label: 'Administrator' },
    { name: 'MANAGER' as const, label: 'Manager' },
    { name: 'USER' as const, label: 'Regular User' },
  ];

  for (const role of roles) {
    await walletDb.role.upsert({
      where: { name: role.name },
      update: { label: role.label },
      create: role,
    });
  }
  console.log('✅ Roles seeded');

  // ═══════ SEED SYSTEM SETTINGS ═══════
  console.log('Seeding system settings...');
  const settings = [
    {
      key: 'commission_percentage',
      value: '2.5',
      type: 'number',
      label: 'Commission Percentage (%)',
      group: 'wallet',
    },
    {
      key: 'min_add_balance',
      value: '10',
      type: 'number',
      label: 'Minimum Add Balance (৳)',
      group: 'wallet',
    },
    {
      key: 'max_add_balance',
      value: '100000',
      type: 'number',
      label: 'Maximum Add Balance (৳)',
      group: 'wallet',
    },
    {
      key: 'max_single_transaction',
      value: '500000',
      type: 'number',
      label: 'Max Single Transaction (৳)',
      group: 'wallet',
    },
    {
      key: 'platform_name',
      value: 'ISP Wallet Platform',
      type: 'string',
      label: 'Platform Name',
      group: 'general',
    },
    {
      key: 'support_phone',
      value: '09678123456',
      type: 'string',
      label: 'Support Phone',
      group: 'general',
    },
    {
      key: 'support_email',
      value: 'support@ispwallet.com',
      type: 'string',
      label: 'Support Email',
      group: 'general',
    },
    {
      key: 'auto_refund_enabled',
      value: 'true',
      type: 'boolean',
      label: 'Auto Refund on Service Failure',
      group: 'service',
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      type: 'boolean',
      label: 'Maintenance Mode',
      group: 'general',
    },
    {
      key: 'otp_expiry_minutes',
      value: '3',
      type: 'number',
      label: 'OTP Expiry (minutes)',
      group: 'security',
    },
    {
      key: 'max_login_attempts',
      value: '10',
      type: 'number',
      label: 'Max Login Attempts',
      group: 'security',
    },
    {
      key: 'sms_enabled',
      value: 'true',
      type: 'boolean',
      label: 'SMS Notifications Enabled',
      group: 'notification',
    },
  ];

  for (const setting of settings) {
    await walletDb.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ System settings seeded');

  // ═══════ SEED SUPER ADMIN ═══════
  console.log('Seeding super admin...');
  const superAdminRole = await walletDb.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  });

  if (superAdminRole) {
    const existingAdmin = await walletDb.user.findUnique({
      where: { mobile: '01700000000' },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 12);
      const admin = await walletDb.user.create({
        data: {
          mobile: '01700000000',
          passwordHash,
          fullName: 'Super Admin',
          email: 'admin@ispwallet.com',
          status: 'ACTIVE',
          roleId: superAdminRole.id,
          isVerified: true,
          lastLoginAt: new Date(),
          loginCount: 0,
        },
      });

      await walletDb.wallet.create({
        data: {
          userId: admin.id,
          status: 'ACTIVE',
          cachedBalance: 0,
        },
      });

      console.log('✅ Super Admin created:');
      console.log('   Mobile: 01700000000');
      console.log('   Password: Admin@123');
    } else {
      console.log('ℹ️  Super Admin already exists');
    }
  }

  // ═══════ SEED DEMO ADMIN ═══════
  const adminRole = await walletDb.role.findUnique({
    where: { name: 'ADMIN' },
  });
  if (adminRole) {
    const existingDemoAdmin = await walletDb.user.findUnique({
      where: { mobile: '01700000001' },
    });
    if (!existingDemoAdmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 12);
      const demoAdmin = await walletDb.user.create({
        data: {
          mobile: '01700000001',
          passwordHash,
          fullName: 'Demo Admin',
          email: 'demoadmin@ispwallet.com',
          status: 'ACTIVE',
          roleId: adminRole.id,
          isVerified: true,
          loginCount: 0,
        },
      });
      await walletDb.wallet.create({
        data: {
          userId: demoAdmin.id,
          status: 'ACTIVE',
          cachedBalance: 0,
        },
      });
      console.log('✅ Demo Admin created: 01700000001 / Admin@123');
    } else {
      console.log('ℹ️  Demo Admin already exists');
    }
  }

  // ═══════ SEED SERVICE PACKAGES ═══════
  console.log('Seeding service packages...');

  const homeInternetPackages = [
    {
      name: 'Basic Internet 5Mbps',
      price: 500,
      bandwidth: '5 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      sortOrder: 1,
    },
    {
      name: 'Standard Internet 10Mbps',
      price: 800,
      bandwidth: '10 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      sortOrder: 2,
    },
    {
      name: 'Premium Internet 20Mbps',
      price: 1200,
      bandwidth: '20 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      sortOrder: 3,
    },
    {
      name: 'Ultra Internet 40Mbps',
      price: 1800,
      bandwidth: '40 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      sortOrder: 4,
    },
    {
      name: 'Corporate Internet 100Mbps',
      price: 3500,
      bandwidth: '100 Mbps',
      dataLimit: 'Unlimited',
      validity: 30,
      sortOrder: 5,
    },
  ];

  for (const pkg of homeInternetPackages) {
    const existing = await serviceDb.servicePackage.findFirst({
      where: { name: pkg.name, serviceType: 'HOME_INTERNET' },
    });
    if (!existing) {
      await serviceDb.servicePackage.create({
        data: {
          serviceType: 'HOME_INTERNET',
          name: pkg.name,
          description: `${pkg.bandwidth} unlimited home internet`,
          price: pkg.price,
          commission: Math.round(pkg.price * 0.025),
          validity: pkg.validity,
          bandwidth: pkg.bandwidth,
          dataLimit: pkg.dataLimit,
          status: 'ACTIVE',
          sortOrder: pkg.sortOrder,
        },
      });
    }
  }

  const hotspotPackages = [
    {
      name: 'Hotspot 1 Hour',
      price: 15,
      bandwidth: '5 Mbps',
      dataLimit: '500 MB',
      validity: 1,
      sortOrder: 1,
    },
    {
      name: 'Hotspot 3 Hours',
      price: 30,
      bandwidth: '5 Mbps',
      dataLimit: '1 GB',
      validity: 1,
      sortOrder: 2,
    },
    {
      name: 'Hotspot Daily',
      price: 50,
      bandwidth: '10 Mbps',
      dataLimit: '3 GB',
      validity: 1,
      sortOrder: 3,
    },
    {
      name: 'Hotspot Weekly',
      price: 200,
      bandwidth: '10 Mbps',
      dataLimit: '15 GB',
      validity: 7,
      sortOrder: 4,
    },
    {
      name: 'Hotspot Monthly',
      price: 600,
      bandwidth: '10 Mbps',
      dataLimit: '50 GB',
      validity: 30,
      sortOrder: 5,
    },
  ];

  for (const pkg of hotspotPackages) {
    const existing = await serviceDb.servicePackage.findFirst({
      where: { name: pkg.name, serviceType: 'HOTSPOT_WIFI' },
    });
    if (!existing) {
      await serviceDb.servicePackage.create({
        data: {
          serviceType: 'HOTSPOT_WIFI',
          name: pkg.name,
          description: `${pkg.bandwidth} hotspot with ${pkg.dataLimit} data`,
          price: pkg.price,
          commission: Math.round(pkg.price * 0.03),
          validity: pkg.validity,
          bandwidth: pkg.bandwidth,
          dataLimit: pkg.dataLimit,
          status: 'ACTIVE',
          sortOrder: pkg.sortOrder,
        },
      });
    }
  }

  console.log('✅ Service packages seeded');

  // ═══════ CREATE DATA DIRECTORY ═══════
  const fs = await import('fs');
  const path = await import('path');
  const dataDir = path.resolve('./data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Data directory created');
  }

  // ═══════ CREATE LOGS DIRECTORY ═══════
  const logsDir = path.resolve('./logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✅ Logs directory created');
  }

  await disconnectDatabases();
  console.log('\n🎉 Seed completed successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});