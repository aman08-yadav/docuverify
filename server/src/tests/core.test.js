import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocument } from '../services/classification/classifyDocument.js';
import { extractFields } from '../services/extraction/extractFields.js';
import { compareNames, buildConsistencyChecks } from '../services/verification/consistency.js';
import { assessEligibility } from '../services/eligibility/assessEligibility.js';
import { normalizeName, redactIdentityNumbers, nameSimilarity } from '../utils/normalize.js';

const demoText = `MARKSHEET\nStudent Name: AMAN KUMAR\nInstitution: Sample Technical University\nRoll Number: STU12345\nCGPA: 8.25\nPercentage: 82.5%\nPassing Year: 2025`;

test('keyword classifier identifies a marksheet with explainable evidence', () => {
  const result = classifyDocument(demoText);
  assert.equal(result.type, 'marksheet'); assert.ok(result.evidence.includes('marksheet')); assert.ok(result.confidence > 0 && result.confidence <= 95); assert.equal(result.method, 'keyword-rules-v1');
});
test('classifier returns unknown rather than guessing from weak evidence', () => {
  const result = classifyDocument('A clean page with a few unrelated words.');
  assert.equal(result.type, 'unknown'); assert.equal(result.confidence, null); assert.equal(result.reviewRequired, true);
});
test('field extraction preserves value-to-source evidence and does not fabricate OCR confidence', () => {
  const fields = extractFields(demoText, 'marksheet');
  const percentage = fields.find((field) => field.key === 'percentage');
  const student = fields.find((field) => field.key === 'studentName');
  assert.equal(percentage.value, 82.5); assert.match(percentage.evidence, /82\.5%/); assert.equal(percentage.confidence, null); assert.equal(percentage.confidenceKind, 'unavailable');
  assert.equal(student.value, 'AMAN KUMAR');
});
test('OCR confidence is calculated from matched engine words when available', () => {
  const fields = extractFields('Percentage: 82.5%', 'marksheet', [{ text: '82.5%', confidence: 96 }, { text: 'Percentage', confidence: 88 }]);
  const score = fields.find((field) => field.key === 'percentage');
  assert.equal(score.confidenceKind, 'ocr'); assert.equal(score.confidence, 96);
});
test('normalization handles casing, punctuation, and common honorifics', () => {
  assert.equal(normalizeName('Mr. Aman-Kumar'), 'aman kumar');
  assert.equal(compareNames('Mr. Aman-Kumar', 'AMAN KUMAR').outcome, 'match');
  assert.equal(compareNames('Aman Kumar', 'Aman Kumr').outcome, 'potential_match');
  assert.equal(compareNames('Aman Kumar', 'Rahul Singh').outcome, 'mismatch');
  assert.equal(compareNames('', 'Rahul Singh').outcome, 'not_enough_information');
  assert.ok(nameSimilarity('Aman Kumar', 'Aman Kumr') > 0.78);
});
test('recognizable twelve-digit identifiers are masked in retained text', () => {
  assert.match(redactIdentityNumbers('Identity: 1234 5678 9012'), /XXXX-XXXX-9012/);
});
test('eligibility engine returns eligible when all required sample criteria pass', () => {
  const scholarship = { isActive: true, criteria: { minAcademicScore: 75, maxAnnualIncome: 400000, requiredDocumentTypes: ['marksheet', 'income_certificate'], requiredFields: ['studentName'] } };
  const documents = [
    { _id: 'a', originalName: 'marksheet-demo.png', status: 'processed', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'studentName', value: 'Aman Kumar', evidence: 'Student Name: Aman Kumar' }, { key: 'percentage', value: 82.5, evidence: 'Percentage: 82.5%' }] },
    { _id: 'b', originalName: 'income-demo.png', status: 'processed', declaredType: 'income_certificate', predictedType: 'income_certificate', fields: [{ key: 'studentName', value: 'Aman Kumar', evidence: 'Applicant: Aman Kumar' }, { key: 'annualIncome', value: 280000, evidence: 'Annual income: 280000' }] }
  ];
  assert.equal(assessEligibility(scholarship, documents).outcome, 'eligible');
});
test('missing evidence leads to needs_review, never automatic eligibility', () => {
  const scholarship = { isActive: true, criteria: { minAcademicScore: 75, maxAnnualIncome: 300000, requiredDocumentTypes: ['marksheet', 'income_certificate'] } };
  const documents = [{ _id: 'a', originalName: 'marksheet-demo.png', status: 'processed', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'percentage', value: 88, evidence: 'Percentage: 88%' }] }];
  const result = assessEligibility(scholarship, documents);
  assert.equal(result.outcome, 'needs_review'); assert.ok(result.missingDocuments.includes('Income certificate')); assert.ok(result.criteriaResults.some((row) => row.result === 'review'));
});
test('a conclusive configured threshold failure is explained as not eligible', () => {
  const scholarship = { isActive: true, criteria: { minAcademicScore: 80, requiredDocumentTypes: ['marksheet'] } };
  const documents = [{ _id: 'a', originalName: 'marksheet-demo.png', status: 'processed', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'percentage', value: 62, evidence: 'Percentage: 62%' }] }];
  const result = assessEligibility(scholarship, documents);
  assert.equal(result.outcome, 'not_eligible'); assert.match(result.criteriaResults.find((row) => row.key === 'minAcademicScore').explanation, /below/);
});
test('CGPA is never compared directly to a percentage threshold', () => {
  const scholarship = { isActive: true, criteria: { minAcademicScore: 75, requiredDocumentTypes: ['marksheet'] } };
  const documents = [{ _id: 'a', originalName: 'marksheet-demo.png', status: 'processed', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'cgpa', value: 8.9, evidence: 'CGPA: 8.9' }] }];
  const result = assessEligibility(scholarship, documents);
  assert.equal(result.outcome, 'needs_review'); assert.match(result.criteriaResults.find((row) => row.key === 'minAcademicScore').explanation, /not compared directly/);
});

test('conflicting academic values across marksheets are flagged for review', () => {
  const docs = [
    { _id: 'a', originalName: 'term-one.png', sha256: 'a', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'percentage', value: 78 }] },
    { _id: 'b', originalName: 'term-two.png', sha256: 'b', declaredType: 'marksheet', predictedType: 'marksheet', fields: [{ key: 'percentage', value: 91 }] }
  ];
  const checks = buildConsistencyChecks(docs);
  assert.ok(checks.some((check) => check.check === 'academic_value_consistency' && check.outcome === 'mismatch'));
});
test('an unresolved cross-document name mismatch adds a visible review criterion', () => {
  const docs = [
    { _id: 'a', originalName: 'marksheet.png', sha256: 'a', declaredType: 'marksheet', predictedType: 'marksheet', status: 'processed', fields: [{ key: 'studentName', value: 'Aman Kumar', evidence: 'Student Name: Aman Kumar' }, { key: 'percentage', value: 82, evidence: 'Percentage: 82%' }] },
    { _id: 'b', originalName: 'income.png', sha256: 'b', declaredType: 'income_certificate', predictedType: 'income_certificate', status: 'processed', fields: [{ key: 'studentName', value: 'Rahul Singh', evidence: 'Applicant: Rahul Singh' }, { key: 'annualIncome', value: 100000, evidence: 'Annual income: 100000' }] }
  ];
  const checks = buildConsistencyChecks(docs);
  docs.forEach((doc) => { doc.consistencyChecks = checks.filter((check) => (check.compared?.documentIds || [check.compared?.left?.documentId, check.compared?.right?.documentId]).filter(Boolean).includes(String(doc._id))); });
  const scholarship = { isActive: true, criteria: { minAcademicScore: 70, maxAnnualIncome: 200000, requiredDocumentTypes: ['marksheet', 'income_certificate'] } };
  const result = assessEligibility(scholarship, docs);
  assert.equal(result.outcome, 'needs_review');
  assert.ok(result.criteriaResults.some((item) => item.key === 'documentConsistency' && item.result === 'review'));
});
