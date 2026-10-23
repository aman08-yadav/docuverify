import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, maxlength: 80, default: '' },
  targetId: { type: String, maxlength: 100, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipHash: { type: String, default: '' }
}, { timestamps: true, versionKey: false });
auditLogSchema.index({ createdAt: -1 });
export default mongoose.model('AuditLog', auditLogSchema);
