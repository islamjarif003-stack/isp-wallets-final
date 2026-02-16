
import axios from 'axios';
import { getServiceDb, getAccountWalletDb } from '../src/config/database';
import { WalletService } from '../src/modules/wallet/wallet.service';

const API_URL = 'http://localhost:4000/api/v1';

async function main() {
  console.log('🚀 Starting STB Service Verification...');

  // 1. Setup Admin & User
  const walletDb = getAccountWalletDb();
  const serviceDb = getServiceDb();
  
  // Find a super admin (Assuming standard role names from schema)
  const admin = await walletDb.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
  if (!admin) throw new Error('No SUPER_ADMIN found. Run seed first.');
  
  // Find a user
  const user = await walletDb.user.findFirst({ where: { role: { name: 'USER' } } });
  if (!user) throw new Error('No USER found. Run seed first.');

  // Login Admin
  const adminLogin = await axios.post(`${API_URL}/auth/login`, {
    mobile: admin.mobile,
    password: 'password123' // Assuming default seed password
  }).catch(e => {
     // If login fails, try to find token differently or assume we need to skip login if we can't guess password
     // For this test, let's assume standard seed password. If not, we might fail here.
     console.error('Admin login failed. Make sure password is password123');
     throw e;
  });
  const adminToken = adminLogin.data.data.accessToken;

  // Login User
  const userLogin = await axios.post(`${API_URL}/auth/login`, {
    mobile: user.mobile,
    password: 'password123'
  });
  const userToken = userLogin.data.data.accessToken;

  console.log('✅ Auth successful');

  // 2. Create STB Package (Admin)
  console.log('📦 Creating STB Package...');
  const pkgRes = await axios.post(
    `${API_URL}/services/stb/admin/packages`,
    {
      name: 'Premium Sports HD',
      price: 500,
      validityDays: 30
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const pkg = pkgRes.data.data;
  console.log(`✅ Package Created: ${pkg.name} (${pkg.id})`);

  // 3. Ensure User has Balance
  console.log('💰 Checking Wallet Balance...');
  const walletService = new WalletService();
  const wallet = await walletDb.wallet.findFirst({ where: { userId: user.id } });
  if (!wallet) throw new Error('User has no wallet');
  
  // Credit some money if needed (using internal service for test)
  await walletService.creditWallet({
      walletId: wallet.id,
      userId: user.id,
      amount: 1000,
      description: 'Test Credit',
      category: 'BALANCE_ADD',
      referenceId: 'TEST-' + Date.now(),
      referenceType: 'SYSTEM_CREDIT',
      idempotencyKey: 'TEST-' + Date.now()
  });
  console.log('✅ Balance ensured');

  // 4. Purchase STB Service (User)
  console.log('🛒 Purchasing STB Service...');
  const stbNumber = 'STB-' + Math.floor(Math.random() * 10000);
  
  const purchaseRes = await axios.post(
    `${API_URL}/services/stb/purchase`,
    {
      packageId: pkg.id,
      stbNumber: stbNumber,
      walletId: wallet.id
    },
    { headers: { Authorization: `Bearer ${userToken}` } }
  );
  
  console.log('✅ Purchase Successful:', purchaseRes.data.message);
  
  // 5. Verify Ownership (Try purchasing again for same STB)
  console.log('🔒 Verifying Ownership Lock...');
  try {
    await axios.post(
        `${API_URL}/services/stb/purchase`,
        {
          packageId: pkg.id,
          stbNumber: stbNumber,
          walletId: wallet.id
        },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      console.error('❌ FAILED: Should have blocked duplicate purchase');
  } catch (error: any) {
    if (error.response && error.response.status === 409) {
        console.log('✅ Correctly blocked duplicate purchase:', error.response.data.message);
    } else {
        console.error('❌ Unexpected error:', error.message);
    }
  }

  // 6. Verify My Services
  console.log('📜 Fetching My Services...');
  const myServices = await axios.get(
    `${API_URL}/services/stb/my-services`,
    { headers: { Authorization: `Bearer ${userToken}` } }
  );
  
  if (myServices.data.data.find((s: any) => s.stbNumber === stbNumber)) {
      console.log('✅ Service found in history');
  } else {
      console.error('❌ Service NOT found in history');
  }

  console.log('🎉 STB Service Verification Complete!');
}

main().catch(console.error);
