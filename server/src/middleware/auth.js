import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.dv_session;
    if (!token) throw new AppError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'docuverify', audience: 'docuverify-web' });
    const user = await User.findById(payload.sub);
    if (!user || user.disabledAt) throw new AppError(401, 'This session is no longer valid.', 'SESSION_INVALID');
    req.user = user; next();
  } catch (error) { next(error instanceof AppError ? error : new AppError(401, 'Your session is invalid or expired. Please sign in again.', 'SESSION_INVALID')); }
}
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new AppError(403, 'Administrator access is required.', 'FORBIDDEN'));
  next();
}
