import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getAccountWalletDb } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RoleName } from '@prisma/account-wallet-client';

interface JwtPayload {
  userId: string;
  role: RoleName;
  walletId: string;
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Invalid token format');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw new UnauthorizedError('Token verification failed');
    }

    if (!decoded.userId || !decoded.role) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const db = getAccountWalletDb();
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(
        `Account is ${user.status.toLowerCase()}`
      );
    }

    // Attach user information to the request object as per requirements
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      walletId: decoded.walletId,
    };

    req.ipAddress =
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

    next();
  } catch (error) {
    next(error);
  }
}