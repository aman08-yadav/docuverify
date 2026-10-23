import { connectDatabase } from '../src/config/db.js';
import Scholarship from '../src/models/Scholarship.js';

const productionScholarships = [
  {
    name: 'National Merit-cum-Means Scholarship Scheme (NMMSS)',
    description: 'Central government financial assistance scheme for meritorious students from economically weaker sections. Requires a qualifying marksheet (minimum 75% aggregate score) and a verified family annual income certificate under ₹3,50,000.',
    criteria: {
      minAcademicScore: 75,
      maxAnnualIncome: 350000,
      requiredDocumentTypes: ['marksheet', 'income_certificate'],
      requiredFields: ['studentName', 'annualIncome']
    },
    isDemo: false,
    isActive: true
  },
  {
    name: 'Central Sector Scheme of Scholarships for College & University Students',
    description: 'Department of Higher Education initiative supporting top-performing students pursuing graduate, postgraduate, and professional degree programs. Requires academic marksheet with minimum 80% marks, identity proof, and family income certificate under ₹4,50,000 per annum.',
    criteria: {
      minAcademicScore: 80,
      maxAnnualIncome: 450000,
      requiredDocumentTypes: ['marksheet', 'identity', 'income_certificate'],
      requiredFields: ['studentName', 'annualIncome']
    },
    isDemo: false,
    isActive: true
  },
  {
    name: 'Post-Matric Financial Assistance Scheme',
    description: 'Government educational financial aid program for students enrolled in post-secondary and vocational courses. Requires a verified marksheet (minimum 60% aggregate), family annual income under ₹2,50,000, and valid identity documentation.',
    criteria: {
      minAcademicScore: 60,
      maxAnnualIncome: 250000,
      requiredDocumentTypes: ['marksheet', 'income_certificate', 'identity'],
      requiredFields: ['studentName', 'annualIncome']
    },
    isDemo: false,
    isActive: true
  },
  {
    name: 'State Domicile Higher Studies Fellowship',
    description: 'State higher education department fellowship for eligible state residents pursuing recognized undergraduate or postgraduate university degrees. Requires state domicile certificate, marksheet (minimum 70%), and annual income under ₹6,00,000.',
    criteria: {
      minAcademicScore: 70,
      maxAnnualIncome: 600000,
      requiredDocumentTypes: ['marksheet', 'domicile_certificate', 'income_certificate'],
      requiredFields: ['studentName', 'annualIncome']
    },
    isDemo: false,
    isActive: true
  }
];

try {
  await connectDatabase();
  // Deactivate old demo-named programs so only real production schemes appear
  await Scholarship.updateMany(
    { name: { $regex: /\(Demo\)$/i } },
    { $set: { isActive: false, isDemo: true } }
  );

  let created = 0;
  let updated = 0;
  for (const program of productionScholarships) {
    const existing = await Scholarship.findOne({ name: program.name });
    if (existing) {
      Object.assign(existing, program, { isActive: true });
      await existing.save();
      updated += 1;
    } else {
      await Scholarship.create(program);
      created += 1;
    }
  }
  console.log(`Production scholarship seed complete: ${created} created, ${updated} refreshed. Old demo programs deactivated.`);
} finally {
  const mongoose = await import('mongoose');
  await mongoose.default.disconnect();
}
