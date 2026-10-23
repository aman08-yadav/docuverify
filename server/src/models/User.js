import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  institution: { type: String, trim: true, maxlength: 160, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },
  disabledAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role, institution: this.institution, createdAt: this.createdAt };
};
export default mongoose.model('User', userSchema);
