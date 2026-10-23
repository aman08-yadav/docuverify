import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  originalValue: { type: mongoose.Schema.Types.Mixed, default: null },
  evidence: { type: String, default: '' },
  confidence: { type: Number, min: 0, max: 100, default: null },
  confidenceKind: { type: String, enum: ['ocr', 'heuristic', 'unavailable'], default: 'unavailable' },
  reviewStatus: { type: String, enum: ['unreviewed', 'confirmed', 'corrected', 'needs_review'], default: 'unreviewed' },
  correctionHistory: [{ value: mongoose.Schema.Types.Mixed, changedAt: Date, changedBy: mongoose.Schema.Types.ObjectId, reason: String }]
}, { _id: false });

const documentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, maxlength: 240 },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
  size: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true, index: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
  declaredType: { type: String, enum: ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other'], default: 'other' },
  predictedType: { type: String, enum: ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other', 'unknown'], default: 'unknown' },
  classification: { confidence: { type: Number, min: 0, max: 100, default: 0 }, evidence: [{ type: String }], method: { type: String, default: 'keyword-rules-v1' } },
  status: { type: String, enum: ['uploaded', 'queued', 'processing', 'processed', 'needs_review', 'failed'], default: 'uploaded', index: true },
  extractedText: { type: String, default: '' },
  fields: [fieldSchema],
  ocr: { engine: String, language: { type: String, default: 'eng' }, startedAt: Date, processedAt: Date, pagesProcessed: Number, averageWordConfidence: { type: Number, default: null }, progressPercent: { type: Number, min: 0, max: 100, default: 0 }, stage: { type: String, default: '' } },
  consistencyChecks: [{ check: String, outcome: String, explanation: String, compared: mongoose.Schema.Types.Mixed, evidence: [String], checkedAt: Date }],
  processingError: { type: String, default: '' },
  review: { completed: { type: Boolean, default: false }, note: { type: String, default: '' }, reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, reviewedAt: Date }
}, { timestamps: true, versionKey: false });
documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ owner: 1, status: 1, createdAt: -1 });
documentSchema.index({ owner: 1, declaredType: 1 });
export default mongoose.model('Document', documentSchema);
