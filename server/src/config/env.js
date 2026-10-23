import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32 || /replace-with|change-me|example-secret/i.test(jwtSecret)) {
  throw new Error('Set JWT_SECRET in your environment to a unique random value of at least 32 characters; do not use the example placeholder.');
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  production: isProduction,
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/docuverify',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  maxUploadBytes: Math.max(1, Number(process.env.MAX_UPLOAD_MB || 10)) * 1024 * 1024,
  maxPdfPages: Math.min(12, Math.max(1, Number(process.env.MAX_PDF_PAGES || 8))),
  ocrConcurrency: Math.min(2, Math.max(1, Number(process.env.OCR_CONCURRENCY || 1)))
};
