import mongoose from 'mongoose';
const scholarshipSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 1800 },
  criteria: {
    minAcademicScore: { type: Number, min: 0, max: 100, default: null },
    maxAnnualIncome: { type: Number, min: 0, default: null },
    requiredDocumentTypes: [{ type: String, enum: ['marksheet', 'identity', 'income_certificate', 'domicile_certificate', 'caste_certificate', 'other'] }],
    requiredFields: [{ type: String }]
  },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true, index: true },
  isDemo: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });
export default mongoose.model('Scholarship', scholarshipSchema);
