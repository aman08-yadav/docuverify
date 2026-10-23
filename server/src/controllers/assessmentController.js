import Scholarship from '../models/Scholarship.js';
import Document from '../models/Document.js';
import EligibilityAssessment from '../models/EligibilityAssessment.js';
import AppError from '../utils/AppError.js';
import { ok } from '../utils/respond.js';
import { audit } from '../utils/audit.js';
import { assessEligibility } from '../services/eligibility/assessEligibility.js';
import { buildConsistencyChecks } from '../services/verification/consistency.js';

export async function createAssessment(req, res) {
  const scholarship = await Scholarship.findById(req.params.scholarshipId);
  if (!scholarship || !scholarship.isActive) throw new AppError(404, 'Active scholarship not found.');
  const documents = await Document.find({ owner: req.user._id }).select('originalName declaredType predictedType status fields classification consistencyChecks sha256').lean();
  const consistency = buildConsistencyChecks(documents.filter((doc) => ['processed', 'needs_review'].includes(doc.status)));
  const byDocument = new Map();
  for (const check of consistency) {
    const ids = check.compared?.documentIds || [check.compared?.left?.documentId, check.compared?.right?.documentId].filter(Boolean);
    for (const id of ids) {
      if (!byDocument.has(String(id))) byDocument.set(String(id), []);
      byDocument.get(String(id)).push(check);
    }
  }
  for (const doc of documents) doc.consistencyChecks = byDocument.get(String(doc._id)) || [];
  const result = assessEligibility(scholarship, documents);
  const assessment = await EligibilityAssessment.create({ owner: req.user._id, scholarship: scholarship._id, scholarshipSnapshot: { name: scholarship.name, criteria: scholarship.criteria.toObject?.() || scholarship.criteria }, ...result });
  await audit(req, 'assessment.created', 'EligibilityAssessment', assessment._id, { scholarshipId: String(scholarship._id), outcome: result.outcome });
  return ok(res, { assessment }, 201, 'Preliminary assessment completed.');
}
export async function listAssessments(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 10));
  const filter = req.user.role === 'admin' && (req.isAdminAll === true || req.query.all === 'true') ? {} : { owner: req.user._id };
  const [assessments, total] = await Promise.all([EligibilityAssessment.find(filter).populate('scholarship', 'name isActive isDemo').sort({ assessedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), EligibilityAssessment.countDocuments(filter)]);
  return ok(res, { assessments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function getAssessment(req, res) {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
  const assessment = await EligibilityAssessment.findOne(filter).populate('scholarship', 'name description criteria isDemo').lean();
  if (!assessment) throw new AppError(404, 'Assessment not found or you do not have access.');
  return ok(res, { assessment });
}
