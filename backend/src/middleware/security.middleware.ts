import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { Express } from 'express';
import { env } from '../config/env';

export function applySecurityMiddleware(app: Express): void {
  // Helmet for security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: [
        env.CORS_ORIGIN_USER,
        env.CORS_ORIGIN_ADMIN,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
      maxAge: 86400,
    })
  );

  // Compression
  app.use(compression());

  // Disable x-powered-by
  app.disable('x-powered-by');
}
