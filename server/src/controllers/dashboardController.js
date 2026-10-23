import Document from '../models/Document.js';
import EligibilityAssessment from '../models/EligibilityAssessment.js';
import { ok } from '../utils/respond.js';
import { queueHealth } from '../services/ocr/queue.js';

export async function dashboard(req, res) {
  const owner = req.user._id;
  const [total, statuses, types, outcomes, recentDocuments, recentAssessments] = await Promise.all([
    Document.countDocuments({ owner }),
    Document.aggregate([{ $match: { owner } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Document.aggregate([{ $match: { owner } }, { $group: { _id: '$predictedType', count: { $sum: 1 } } }]),
    EligibilityAssessment.aggregate([{ $match: { owner } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
    Document.find({ owner }).select('originalName declaredType predictedType status createdAt updatedAt').sort({ createdAt: -1 }).limit(5).lean(),
    EligibilityAssessment.find({ owner }).select('scholarshipSnapshot outcome assessedAt').sort({ assessedAt: -1 }).limit(5).lean()
  ]);
  const byStatus = Object.fromEntries(statuses.map((s) => [s._id, s.count]));
  return ok(res, { stats: { totalDocuments: total, processedDocuments: byStatus.processed || 0, needsReview: byStatus.needs_review || 0, failedProcessing: byStatus.failed || 0, queuedProcessing: (byStatus.queued || 0) + (byStatus.processing || 0), assessments: outcomes.reduce((sum, o) => sum + o.count, 0) }, statusDistribution: statuses.map((item) => ({ name: item._id, value: item.count })), typeDistribution: types.map((item) => ({ name: item._id || 'unknown', value: item.count })), outcomeDistribution: outcomes.map((item) => ({ name: item._id, value: item.count })), recentDocuments, recentAssessments, processingQueue: queueHealth() });
}
