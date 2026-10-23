const patterns = {
  studentName: { label: 'Student name', regex: [/(?:student|candidate|applicant|name)\s*(?:name)?\s*[:\-]\s*([A-Z][A-Z .'-]{2,70})/i], kind: 'text' },
  institutionName: { label: 'Institution', regex: [/(?:institution|university|college|school)\s*(?:name)?\s*[:\-]\s*([^\n]{3,120})/i], kind: 'text' },
  rollNumber: { label: 'Roll number', regex: [/(?:roll\s*(?:no|number)|registration\s*(?:no|number))\s*[:#\-]?\s*([A-Z0-9/-]{3,30})/i], kind: 'text' },
  cgpa: { label: 'CGPA', regex: [/(?:cgpa|cumulative grade point average)\s*[:\-]?\s*(10\s*\/\s*10|[0-9]{1,2}(?:\.[0-9]{1,2})?)/i], kind: 'number' },
  percentage: { label: 'Percentage', regex: [/(?:percentage|aggregate|overall marks)\s*[:\-]?\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*%/i], kind: 'number' },
  passingYear: { label: 'Passing year', regex: [/(?:passing year|year of passing|academic year)\s*[:\-]?\s*((?:19|20)\d{2})/i], kind: 'number' },
  annualIncome: { label: 'Annual family income', regex: [/(?:annual (?:family )?income|family income|yearly income|income per annum)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i], kind: 'number' },
  currency: { label: 'Currency', regex: [/(?:₹|\bINR\b|\bRs\.?\b)/i], kind: 'currency' },
  issueDate: { label: 'Issue date', regex: [/(?:date of issue|issued on|issue date)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i], kind: 'text' },
  issuingAuthority: { label: 'Issuing authority', regex: [/(?:issued by|issuing authority|competent authority)\s*[:\-]?\s*([^\n]{3,100})/i], kind: 'text' },
  certificateReference: { label: 'Certificate reference', regex: [/(?:certificate (?:no|number)|reference (?:no|number)|application (?:no|number))\s*[:#\-]?\s*([A-Z0-9/-]{3,40})/i], kind: 'text' },
  address: { label: 'Address', regex: [/(?:address)\s*[:\-]\s*([^\n]{8,180})/i], kind: 'text' },
  casteCategory: { label: 'Certificate category', regex: [/(scheduled caste|scheduled tribe|other backward class|general category|ews|sc|st|obc)\b/i], kind: 'text' }
};
function getConfidence(match, words) {
  if (!match || !Array.isArray(words) || !words.length) return { confidence: null, confidenceKind: 'unavailable' };
  const normalized = match.trim().toLowerCase();
  const related = words.filter((word) => word.text?.toLowerCase().includes(normalized) || normalized.includes(word.text?.toLowerCase() || '\0'));
  const good = related.map((word) => word.confidence).filter((value) => Number.isFinite(value) && value >= 0);
  if (!good.length) return { confidence: null, confidenceKind: 'unavailable' };
  return { confidence: Math.round(good.reduce((a, b) => a + b, 0) / good.length), confidenceKind: 'ocr' };
}
function parseValue(value, kind) {
  if (kind === 'number') {
    const n = Number(String(value).replace(/,/g, '').replace(/\s*\/\s*10$/, ''));
    return Number.isFinite(n) ? n : value;
  }
  if (kind === 'currency') return 'INR';
  return String(value).trim().replace(/[;,\s]+$/, '');
}
const categories = {
  marksheet: ['studentName', 'institutionName', 'rollNumber', 'cgpa', 'percentage', 'passingYear'],
  income_certificate: ['studentName', 'annualIncome', 'currency', 'issueDate', 'issuingAuthority', 'certificateReference'],
  identity: ['studentName', 'issueDate', 'address'],
  domicile_certificate: ['studentName', 'issueDate', 'issuingAuthority', 'certificateReference', 'address'],
  caste_certificate: ['studentName', 'casteCategory', 'issueDate', 'issuingAuthority', 'certificateReference'],
  other: ['studentName', 'institutionName', 'annualIncome', 'issueDate']
};
export function extractFields(text = '', type = 'other', words = []) {
  const fields = [];
  for (const key of categories[type] || categories.other) {
    const def = patterns[key];
    if (!def) continue;
    let found = null;
    for (const regex of def.regex) { found = String(text).match(regex); if (found) break; }
    if (!found) continue;
    const raw = found[1] || found[0];
    const value = parseValue(raw, def.kind);
    const confidence = getConfidence(raw, words);
    fields.push({ key, label: def.label, value, originalValue: value, evidence: found[0].trim().slice(0, 240), ...confidence, reviewStatus: 'unreviewed' });
  }
  return fields;
}
