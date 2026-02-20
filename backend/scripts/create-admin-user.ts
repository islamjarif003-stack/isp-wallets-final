import bcrypt from 'bcrypt';
import { getAccountWalletDb } from '../src/config/database';
import { sanitizeMobile } from '../src/utils/helpers';
import { getLogger } from '../src/utils/logger';
const logger = getLogger();
import { RoleName } from '@prisma/account-wallet-client';
import { createAuditLog } from '../src/utils/audit';
 
type Args = {
  mobile?: string;
  fullName?: string;
  password?: string;
  role?: RoleName;
};
 
function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mobile') args.mobile = argv[i + 1];
    if (a === '--fullName') args.fullName = argv[i + 1];
    if (a === '--password') args.password = argv[i + 1];
    if (a === '--role') args.role = argv[i + 1] as RoleName;
  }
  return args;
}
 
async function main(): Promise<void> {
  const { mobile, fullName, password, role } = parseArgs(process.argv.slice(2));
 
  if (!mobile) {
    throw new Error('Missing --mobile');
  }
  if (!password) {
    throw new Error('Missing --password');
  }
 
  const db = getAccountWalletDb();
  const normalizedMobile = sanitizeMobile(mobile);
  const desiredRole: RoleName = role || 'ADMIN';
  const name = (fullName || 'Admin').trim();
 
  const roleRow = await db.role.findUnique({ where: { name: desiredRole } });
  if (!roleRow) {
    throw new Error(`Role not found: ${desiredRole}. Seed roles first.`);
  }
 
  const passwordHash = await bcrypt.hash(password, 12);
 
  const existing = await db.user.findUnique({ where: { mobile: normalizedMobile } });
  const isCreate = !existing;
  const user =
    existing
      ? await db.user.update({
          where: { id: existing.id },
          data: {
            fullName: name,
            passwordHash,
            roleId: roleRow.id,
            status: 'ACTIVE',
            isVerified: true,
          },
        })
      : await db.user.create({
          data: {
            mobile: normalizedMobile,
            fullName: name,
            passwordHash,
            roleId: roleRow.id,
            status: 'ACTIVE',
            isVerified: true,
          },
        });
 
  const superAdmin = await db.user.findUnique({
    where: { mobile: '01700000000' },
  });
 
  if (superAdmin) {
    await createAuditLog({
      adminId: superAdmin.id,
      action: isCreate ? 'USER_CREATE' : 'ROLE_ASSIGN',
      targetUserId: user.id,
      resourceType: 'USER',
      resourceId: user.id,
      newData: {
        mobile: user.mobile,
        fullName: user.fullName,
        role: desiredRole,
        status: user.status,
        isVerified: user.isVerified,
      },
      reason: isCreate ? 'Created via create-admin-user script' : 'Updated via create-admin-user script',
    });
  } else {
    logger.warn('Super admin not found; skipping audit log', { mobile: '01700000000' });
  }
 
  logger.info('Admin user ready', {
    userId: user.id,
    mobile: user.mobile,
    role: desiredRole,
  });
}
 
main().catch((err) => {
  logger.error('Failed to create admin user', {
    error: err instanceof Error ? err.message : err,
  });
  process.exit(1);
});
