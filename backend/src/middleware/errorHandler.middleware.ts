import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';

const logger = getLogger();

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Error caught by handler', {
    message: err.message,
    stack: env.isDevelopment() ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  if (err instanceof ZodError) {
    const errors = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  const errName = err.constructor?.name || '';

  if (errName === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    switch (prismaErr.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          message: 'A record with this information already exists',
        });
        return;
      case 'P2025':
        res.status(404).json({
          success: false,
          message: 'Record not found',
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          message: 'Related record not found',
        });
        return;
      default:
        res.status(500).json({
          success: false,
          message: 'Database error occurred',
        });
        return;
    }
  }

  if (errName === 'PrismaClientValidationError') {
    res.status(400).json({
      success: false,
      message: 'Invalid data provided',
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: env.isProduction()
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
}
