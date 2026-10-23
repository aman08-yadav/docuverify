import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { databaseHealth } from './config/db.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import scholarshipRoutes from './routes/scholarshipRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { queueHealth } from './services/ocr/queue.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', config.production ? 1 : false);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'", config.clientOrigin], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } } }));
  app.use(cors({ origin(origin, callback) {
    if (!origin || origin === config.clientOrigin) return callback(null, true);
    return callback(new Error('Origin is not allowed by the CORS policy.'));
  }, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'], maxAge: 600 }));
  app.use(express.json({ limit: '100kb' })); app.use(express.urlencoded({ extended: false, limit: '100kb' })); app.use(cookieParser());
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/documents', rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api', csrfProtection);
  app.get('/api/health', (req, res) => {
    const db = databaseHealth(); const healthy = db.connected;
    res.status(healthy ? 200 : 503).json({ success: healthy, message: healthy ? 'DocuVerify API is available.' : 'API is running but the database is not connected.', data: { status: healthy ? 'ok' : 'degraded', database: db, processing: queueHealth(), timestamp: new Date().toISOString() } });
  });
  app.use('/api/auth', authRoutes); app.use('/api/documents', documentRoutes); app.use('/api/scholarships', scholarshipRoutes);
  app.use('/api/assessments', assessmentRoutes); app.use('/api/dashboard', dashboardRoutes); app.use('/api/admin', adminRoutes);
  app.use('/api', notFound); app.use(errorHandler);
  return app;
}
export default createApp;
