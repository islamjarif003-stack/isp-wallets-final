import express from 'express';
import { rateLimiterMiddleware } from './middleware/rateLimiter.middleware';
import { applySecurityMiddleware } from './middleware/security.middleware';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { walletRoutes } from './modules/wallet/wallet.routes';
import { serviceRoutes } from './modules/services/service.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { reportingRoutes } from './modules/reporting/reporting.routes';
import { notificationRoutes } from './modules/notification/notification.routes';
import { systemRoutes } from './modules/system/system.routes';

export const app = express();

// Middleware
applySecurityMiddleware(app);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiterMiddleware);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const apiBase = `/api/${env.API_VERSION}`;
app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/wallet`, walletRoutes);
app.use(`${apiBase}/services`, serviceRoutes);
app.use(`${apiBase}/notifications`, notificationRoutes);
app.use(`${apiBase}/admin`, adminRoutes);
app.use(`${apiBase}/reports`, reportingRoutes);
app.use(`${apiBase}/system`, systemRoutes);

app.use(errorHandler);

export default app;
