import User from '../models/User.js';
import Document from '../models/Document.js';
import EligibilityAssessment from '../models/EligibilityAssessment.js';
import AuditLog from '../models/AuditLog.js';
import AppError from '../utils/AppError.js';
import { ok } from '../utils/respond.js';
import { audit } from '../utils/audit.js';

export async function overview(req, res) {
  const [users, documents, review, assessments, auditEvents] = await Promise.all([User.countDocuments(), Document.countDocuments(), Document.countDocuments({ status: 'needs_review' }), EligibilityAssessment.countDocuments(), AuditLog.countDocuments()]);
  return ok(res, { stats: { users, documents, needsReview: review, assessments, auditEvents } });
}
export async function listUsers(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (req.query.search) {
    const needle = String(req.query.search).slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: needle, $options: 'i' } }, { email: { $regex: needle, $options: 'i' } }];
  }
  const [users, total] = await Promise.all([User.find(filter).select('name email role institution createdAt lastLoginAt disabledAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(filter)]);
  return ok(res, { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function reviewDocument(req, res) {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw new AppError(404, 'Document not found.');
  const note = String(req.body.note || '').trim();
  if (note.length < 5 || note.length > 500) throw new AppError(400, 'Add a review explanation between 5 and 500 characters.');
  doc.review = { completed: true, note, reviewer: req.user._id, reviewedAt: new Date() };
  if (doc.status === 'needs_review') doc.status = 'processed';
  doc.fields.forEach((field) => { if (field.reviewStatus === 'unreviewed' || field.reviewStatus === 'needs_review') field.reviewStatus = 'confirmed'; });
  await doc.save(); await audit(req, 'admin.document_reviewed', 'Document', doc._id, { noteLength: note.length });
  return ok(res, { document: doc }, 200, 'Review recorded.');
}
export async function listAudit(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const events = await AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name email role').lean();
  return ok(res, { events, page, limit });
}
