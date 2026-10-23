import mongoose from 'mongoose';
const assessmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scholarship: { type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship', required: true, index: true },
  scholarshipSnapshot: { name: String, criteria: mongoose.Schema.Types.Mixed },
  outcome: { type: String, enum: ['eligible', 'not_eligible', 'needs_review'], required: true, index: true },
  criteriaResults: [{ key: String, criterion: String, expected: mongoose.Schema.Types.Mixed, actual: mongoose.Schema.Types.Mixed, result: { type: String, enum: ['pass', 'fail', 'review', 'not_applicable'] }, explanation: String, evidence: [String] }],
  consistencyFindings: [{ check: String, outcome: String, explanation: String, compared: mongoose.Schema.Types.Mixed, evidence: [String] }],
  missingDocuments: [String],
  missingEvidence: [String],
  limitations: [String],
  assessedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true, versionKey: false });
assessmentSchema.index({ owner: 1, assessedAt: -1 });
export default mongoose.model('EligibilityAssessment', assessmentSchema);
