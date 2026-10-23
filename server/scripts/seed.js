import { connectDatabase } from '../src/config/db.js';
import Scholarship from '../src/models/Scholarship.js';

const programs = [
  { name: 'DocuVerify Student Merit Grant (Demo)', description: 'Synthetic portfolio-demo program for demonstrating academic-score checks. These criteria are sample values only, not official scholarship rules.', criteria: { minAcademicScore: 80, maxAnnualIncome: null, requiredDocumentTypes: ['marksheet'], requiredFields: ['studentName'] }, isDemo: true },
  { name: 'Access & Opportunity Award (Demo)', description: 'Synthetic portfolio-demo program illustrating income and academic criteria, missing evidence, and review outcomes.', criteria: { minAcademicScore: 65, maxAnnualIncome: 350000, requiredDocumentTypes: ['marksheet', 'income_certificate'], requiredFields: ['studentName', 'annualIncome'] }, isDemo: true },
  { name: 'Community Learning Support (Demo)', description: 'Synthetic portfolio-demo program that demonstrates required identity and domicile documents. It does not represent any government scheme.', criteria: { minAcademicScore: null, maxAnnualIncome: 500000, requiredDocumentTypes: ['identity', 'domicile_certificate', 'income_certificate'], requiredFields: ['studentName'] }, isDemo: true }
];
try {
  await connectDatabase();
  let created = 0; let updated = 0;
  for (const program of programs) {
    const existing = await Scholarship.findOne({ name: program.name });
    if (existing) { Object.assign(existing, program, { isActive: true }); await existing.save(); updated += 1; }
    else { await Scholarship.create(program); created += 1; }
  }
  console.log(`Demo scholarship seed complete: ${created} created, ${updated} refreshed. No fake student documents were created.`);
} finally { const mongoose = await import('mongoose'); await mongoose.default.disconnect(); }
