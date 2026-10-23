import crypto from 'node:crypto';
import { validateUploadBuffer } from '../services/storage/validateUpload.js';
import Document from '../models/Document.js';
import { storeBuffer, openReadStream, removeStoredFile } from '../services/storage/gridFsStorage.js';
import { enqueueProcessing } from '../services/ocr/queue.js';
import { buildConsistencyChecks } from '../services/verification/consistency.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { audit } from '../utils/audit.js';

function mongoId(value) { return /^[a-f\d]{24}$/i.test(String(value || '')); }
async function accessibleDocument(req, id) {
  if (!mongoId(id)) throw new AppError(400, 'Invalid document ID.', 'INVALID_ID');
  const query = req.user.role === 'admin' ? { _id: id } : { _id: id, owner: req.user._id };
  const doc = await Document.findOne(query);
  if (!doc) throw new AppError(404, 'Document not found or you do not have access.', 'DOCUMENT_NOT_FOUND');
  return doc;
}
export async function uploadDocument(req, res) {
  const file = req.file;
  if (!file) throw new AppError(400, 'Choose a PDF, JPG, JPEG, or PNG document to upload.', 'FILE_REQUIRED');
  const detected = await validateUploadBuffer(file.buffer, file.mimetype, config.maxUploadBytes);
  const declaredType = ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other'].includes(req.body.documentType) ? req.body.documentType : 'other';
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const duplicate = await Document.findOne({ owner: req.user._id, sha256 });
  const gridFsId = await storeBuffer(file.buffer, file.originalname.replace(/[\r\n]/g, '').slice(0, 200), detected.mime, { ownerId: String(req.user._id), sha256 });
  let doc;
  try {
    doc = await Document.create({ owner: req.user._id, originalName: file.originalname.replace(/[\r\n]/g, '').slice(0, 240), mimeType: detected.mime, size: file.size, sha256, gridFsId, declaredType, status: 'uploaded' });
    const enqueue = await enqueueProcessing(doc._id);
    doc = await Document.findById(doc._id);
    await audit(req, 'document.uploaded', 'Document', doc._id, { mimeType: doc.mimeType, size: doc.size, duplicateDetected: Boolean(duplicate), queuePosition: enqueue.queuePosition });
    return ok(res, { document: doc, duplicateDetected: Boolean(duplicate), queue: enqueue }, 201, 'Document uploaded and queued for processing.');
  } catch (error) {
    if (doc?._id) await Document.deleteOne({ _id: doc._id });
    await removeStoredFile(gridFsId).catch(() => {});
    throw error;
  }
}
export async function listDocuments(req, res) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 10));
  const filter = req.user.role === 'admin' && (req.isAdminAll === true || req.query.all === 'true') ? {} : { owner: req.user._id };
  if (req.query.status && ['uploaded', 'queued', 'processing', 'processed', 'needs_review', 'failed'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.type && ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other'].includes(req.query.type)) {
    filter.$or = [
      { predictedType: req.query.type },
      { declaredType: req.query.type, predictedType: { $in: ['unknown', null] } }
    ];
  }
  if (req.query.search) filter.originalName = { $regex: String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [documents, total] = await Promise.all([Document.find(filter).select('-extractedText').populate('owner', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Document.countDocuments(filter)]);
  return ok(res, { documents, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function getDocument(req, res) {
  const doc = await accessibleDocument(req, req.params.id);
  return ok(res, { document: doc });
}
export async function streamDocument(req, res) {
  const doc = await accessibleDocument(req, req.params.id);
  res.set({ 'Content-Type': doc.mimeType, 'Content-Length': String(doc.size), 'Content-Disposition': `inline; filename="${doc.originalName.replace(/["\\\r\n]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  const stream = openReadStream(doc.gridFsId);
  stream.on('error', (error) => { if (!res.headersSent) res.status(404).json({ success: false, message: 'Stored file is unavailable.' }); else res.destroy(error); });
  stream.pipe(res);
}
export async function reprocessDocument(req, res) {
  const doc = await accessibleDocument(req, req.params.id);
  if (['queued', 'processing'].includes(doc.status)) throw new AppError(409, 'This document is already queued or processing.');
  const queue = await enqueueProcessing(doc._id);
  await audit(req, 'document.reprocess_requested', 'Document', doc._id);
  return ok(res, { queue }, 202, 'Processing retry accepted.');
}
export async function updateFields(req, res) {
  const doc = await accessibleDocument(req, req.params.id);
  if (doc.status === 'queued' || doc.status === 'processing') throw new AppError(409, 'Wait until processing finishes before reviewing extracted fields.');
  const changes = Array.isArray(req.body.fields) ? req.body.fields : [];
  if (!changes.length || changes.length > 40) throw new AppError(400, 'Provide between 1 and 40 field changes.');
  const updated = [];
  for (const change of changes) {
    const field = doc.fields.find((item) => item.key === change.key);
    if (!field) continue;
    if (typeof change.key !== 'string' || change.key.length > 80) throw new AppError(400, 'Invalid field key.');
    if (typeof change.value !== 'string' && typeof change.value !== 'number' && change.value !== null) throw new AppError(400, `Invalid value for ${change.key}.`);
    if (typeof change.value === 'string' && change.value.length > 500) throw new AppError(400, `The value for ${change.key} is too long.`);
    if (typeof change.value === 'number' && !Number.isFinite(change.value)) throw new AppError(400, `The numeric value for ${change.key} is invalid.`);
    field.correctionHistory.push({ value: field.value, changedAt: new Date(), changedBy: req.user._id, reason: String(change.reason || 'Student review').slice(0, 240) });
    field.originalValue = field.originalValue ?? field.value;
    field.value = change.value; field.reviewStatus = 'corrected'; updated.push(field.key);
  }
  doc.markModified('fields'); if (doc.status === 'needs_review' && doc.fields.every((item) => item.reviewStatus === 'confirmed' || item.reviewStatus === 'corrected')) doc.status = 'processed';
  await doc.save(); await audit(req, 'document.fields_corrected', 'Document', doc._id, { changedFieldKeys: updated });
  return ok(res, { document: doc }, 200, 'Reviewed fields saved.');
}
export async function deleteDocument(req, res) {
  const doc = await accessibleDocument(req, req.params.id);
  await removeStoredFile(doc.gridFsId);
  await Document.deleteOne({ _id: doc._id }); await audit(req, 'document.deleted', 'Document', doc._id);
  return ok(res, {}, 200, 'Document deleted.');
}
export async function consistency(req, res) {
  const documents = await Document.find({ owner: req.user._id, status: { $in: ['processed', 'needs_review'] } }).select('originalName sha256 fields status declaredType predictedType createdAt').lean();
  const checks = buildConsistencyChecks(documents);
  if (documents.length > 0) {
    await Document.bulkWrite(documents.map((doc) => ({ updateOne: { filter: { _id: doc._id }, update: { $set: { consistencyChecks: checks.filter((check) => check.evidence.includes(doc.originalName)) } } } })), { ordered: false }).catch(() => {});
  }
  return ok(res, { checks, documentsCompared: documents.length });
}
export const deleteDocAsync = asyncHandler(deleteDocument);
