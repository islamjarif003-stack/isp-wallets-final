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
        env.CORS_ORIGIN_USER || 'http://localhost:3000',
        env.CORS_ORIGIN_ADMIN || 'http://localhost:3001',
        'http://192.168.1.117:3000',
        'http://192.168.1.117:3001',
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
