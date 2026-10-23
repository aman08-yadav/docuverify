import Scholarship from '../models/Scholarship.js';
import AppError from '../utils/AppError.js';
import { ok } from '../utils/respond.js';
import { audit } from '../utils/audit.js';

function validateScholarship(body) {
  const name = String(body.name || '').trim(); const description = String(body.description || '').trim();
  if (name.length < 4 || name.length > 160 || description.length < 20 || description.length > 1800) throw new AppError(400, 'Enter a scholarship name and a description of 20–1800 characters.');
  const criteria = body.criteria || {};
  const minAcademicScore = criteria.minAcademicScore === '' || criteria.minAcademicScore == null ? null : Number(criteria.minAcademicScore);
  const maxAnnualIncome = criteria.maxAnnualIncome === '' || criteria.maxAnnualIncome == null ? null : Number(criteria.maxAnnualIncome);
  if (minAcademicScore !== null && (!Number.isFinite(minAcademicScore) || minAcademicScore < 0 || minAcademicScore > 100)) throw new AppError(400, 'Minimum academic percentage must be from 0 to 100.');
  if (maxAnnualIncome !== null && (!Number.isFinite(maxAnnualIncome) || maxAnnualIncome < 0)) throw new AppError(400, 'Maximum income must be zero or greater.');
  const allowed = ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other'];
  const requiredDocumentTypes = Array.isArray(criteria.requiredDocumentTypes) ? [...new Set(criteria.requiredDocumentTypes)] : [];
  if (requiredDocumentTypes.some((type) => !allowed.includes(type))) throw new AppError(400, 'One or more required document types are invalid.');
  return { name, description, criteria: { minAcademicScore, maxAnnualIncome, requiredDocumentTypes, requiredFields: Array.isArray(criteria.requiredFields) ? criteria.requiredFields.map((f) => String(f).slice(0, 60)).slice(0, 20) : [] }, startsAt: body.startsAt || null, endsAt: body.endsAt || null, isActive: body.isActive !== false, isDemo: body.isDemo !== false };
}
export async function listScholarships(req, res) {
  const filter = req.user.role === 'admin' && req.query.includeInactive === 'true' ? {} : { isActive: true };
  const scholarships = await Scholarship.find(filter).sort({ createdAt: -1 }).lean();
  return ok(res, { scholarships });
}
export async function getScholarship(req, res) {
  const scholarship = await Scholarship.findById(req.params.id);
  if (!scholarship || (!scholarship.isActive && req.user.role !== 'admin')) throw new AppError(404, 'Scholarship not found.');
  return ok(res, { scholarship });
}
export async function createScholarship(req, res) {
  const values = validateScholarship(req.body);
  const scholarship = await Scholarship.create({ ...values, createdBy: req.user._id });
  await audit(req, 'scholarship.created', 'Scholarship', scholarship._id, { isDemo: scholarship.isDemo });
  return ok(res, { scholarship }, 201, 'Scholarship created.');
}
export async function updateScholarship(req, res) {
  const scholarship = await Scholarship.findById(req.params.id);
  if (!scholarship) throw new AppError(404, 'Scholarship not found.');
  Object.assign(scholarship, validateScholarship({ ...scholarship.toObject(), ...req.body, criteria: { ...(scholarship.criteria?.toObject?.() || scholarship.criteria || {}), ...(req.body.criteria || {}) } }));
  await scholarship.save(); await audit(req, 'scholarship.updated', 'Scholarship', scholarship._id);
  return ok(res, { scholarship }, 200, 'Scholarship updated.');
}
export async function deleteScholarship(req, res) {
  const scholarship = await Scholarship.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { returnDocument: 'after' });
  if (!scholarship) throw new AppError(404, 'Scholarship not found.');
  await audit(req, 'scholarship.deactivated', 'Scholarship', scholarship._id);
  return ok(res, { scholarship }, 200, 'Scholarship deactivated. Assessment history remains available.');
}
