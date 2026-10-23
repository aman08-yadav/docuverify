import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { sessionCookieOptions, csrfCookieOptions } from '../middleware/csrf.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { ok } from '../utils/respond.js';

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, issuer: 'docuverify', audience: 'docuverify-web' });
  res.cookie('dv_session', token, sessionCookieOptions());
}
export async function register(req, res) {
  const name = String(req.body.name || '').trim(); const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 100) throw new AppError(400, 'Name must be between 2 and 100 characters.', 'INVALID_NAME');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new AppError(400, 'Password must be 10–128 characters and include letters and numbers.', 'WEAK_PASSWORD');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'student', institution: String(req.body.institution || '').trim().slice(0, 160) });
  issueSession(res, user); await audit(req, 'account.registered', 'User', user._id);
  return ok(res, { user: user.toSafeJSON() }, 201, 'Your account has been created.');
}
export async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid || user.disabledAt) { await audit(req, 'auth.login_failed', 'User', user?._id || '', { reason: 'invalid_credentials' }); throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS'); }
  user.lastLoginAt = new Date(); await user.save(); issueSession(res, user); await audit(req, 'auth.login', 'User', user._id);
  return ok(res, { user: user.toSafeJSON() }, 200, 'Welcome back.');
}
export async function logout(req, res) {
  res.clearCookie('dv_session', { ...sessionCookieOptions(), maxAge: undefined });
  res.clearCookie('dv_csrf', { ...csrfCookieOptions(), maxAge: undefined });
  if (req.user?._id) await audit(req, 'auth.logout', 'User', req.user._id);
  return ok(res, {}, 200, 'You are signed out.');
}
export async function me(req, res) { return ok(res, { user: req.user.toSafeJSON() }); }
export async function updateProfile(req, res) {
  const name = req.body.name === undefined ? req.user.name : String(req.body.name).trim();
  const institution = req.body.institution === undefined ? req.user.institution : String(req.body.institution).trim();
  if (name.length < 2 || name.length > 100) throw new AppError(400, 'Name must be between 2 and 100 characters.');
  req.user.name = name; req.user.institution = institution.slice(0, 160); await req.user.save();
  await audit(req, 'account.profile_updated', 'User', req.user._id);
  return ok(res, { user: req.user.toSafeJSON() }, 200, 'Profile updated.');
}
