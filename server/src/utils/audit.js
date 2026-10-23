import AuditLog from '../models/AuditLog.js';
import { createHash } from 'node:crypto';
export async function audit(req, action, targetType = '', targetId = '', metadata = {}) {
  const ip = String(req.ip || '').slice(0, 100);
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : '';
  try { await AuditLog.create({ actor: req.user?._id || null, action, targetType, targetId: String(targetId || ''), metadata, ipHash }); }
  catch (error) { console.error('Audit event could not be persisted:', error.message); }
}
