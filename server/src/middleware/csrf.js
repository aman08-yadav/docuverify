import crypto from 'node:crypto';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
const cookieOptions = (httpOnly) => ({ httpOnly, secure: config.production, sameSite: config.production ? 'none' : 'lax', path: '/', ...(config.cookieDomain ? { domain: config.cookieDomain } : {}), maxAge: 8 * 60 * 60 * 1000 });
export function getCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('dv_csrf', token, cookieOptions(false));
  res.json({ success: true, message: 'CSRF token issued.', data: { csrfToken: token } });
}
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.cookies?.dv_csrf || '';
  const header = req.get('x-csrf-token') || '';
  const cookieBytes = Buffer.from(cookie);
  const headerBytes = Buffer.from(header);
  const validShape = /^[a-f0-9]{64}$/i.test(cookie) && /^[a-f0-9]{64}$/i.test(header);
  if (!validShape || cookieBytes.length !== headerBytes.length || !crypto.timingSafeEqual(cookieBytes, headerBytes)) return next(new AppError(403, 'Security token missing or expired. Refresh and try again.', 'CSRF_INVALID'));
  next();
}
export const sessionCookieOptions = () => cookieOptions(true);
