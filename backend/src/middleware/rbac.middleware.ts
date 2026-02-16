import { Request, Response, NextFunction } from 'express';
import { RoleName } from '@prisma/account-wallet-client';
import { ForbiddenError } from '../utils/errors';

export function requireRoles(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.role) {
      return next(new ForbiddenError('Role not determined'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

export function requireAdmin() {
  return requireRoles('SUPER_ADMIN', 'ADMIN');
}

export function requireSuperAdmin() {
  return requireRoles('SUPER_ADMIN');
}

export function requireManager() {
  return requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER');
}

export function requireUser() {
  return requireRoles('USER', 'SUPER_ADMIN', 'ADMIN', 'MANAGER');
}