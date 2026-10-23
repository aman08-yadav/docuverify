import { connectDatabase } from '../src/config/db.js';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const name = String(process.env.ADMIN_NAME || 'DocuVerify Administrator').trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to the intended administrator email address.');
if (password.length < 16 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Set ADMIN_PASSWORD to a unique password of at least 16 characters including letters and numbers.');
try {
  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate({ email }, { $set: { name, email, passwordHash, role: 'admin', disabledAt: null } }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
  console.log(`Administrator account prepared for ${user.email}. No password was printed.`);
} finally { const mongoose = await import('mongoose'); await mongoose.default.disconnect(); }
