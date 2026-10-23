const DOC_LABELS = {
  marksheet: 'Marksheet', identity: 'Identity document', income_certificate: 'Income certificate',
  domicile_certificate: 'Domicile certificate', caste_certificate: 'Caste certificate', other: 'Other document'
};
const activeField = (documents, keys) => documents.flatMap((doc) => (doc.fields || []).map((field) => ({ ...field.toObject?.() || field, doc }))).find((field) => keys.includes(field.key) && field.value !== null && field.value !== undefined && String(field.value).trim() !== '');
const proof = (entry) => entry ? [`${entry.doc.originalName}: ${entry.evidence || entry.label} = ${entry.value}`] : [];
const hasLowOcrConfidence = (entry) => entry?.confidenceKind === 'ocr' && Number.isFinite(entry.confidence) && entry.confidence < 60;

export function assessEligibility(scholarship, documents, now = new Date()) {
  const criteriaResults = []; const missingDocuments = []; const missingEvidence = []; const limitations = [
    'This is a preliminary rules-based assessment, not an official scholarship decision.',
    'OCR extraction and consistency checks do not establish document authenticity; original records may require issuer-level validation.'
  ];
  const criteria = scholarship.criteria || {};
  const processed = documents.filter((doc) => ['processed', 'needs_review'].includes(doc.status));
  const getDocType = (doc) => doc.predictedType && doc.predictedType !== 'unknown' ? doc.predictedType : doc.declaredType;
  const types = new Set(processed.map(getDocType));
  for (const type of criteria.requiredDocumentTypes || []) {
    const hasType = types.has(type);
    if (!hasType) missingDocuments.push(DOC_LABELS[type] || type);
    criteriaResults.push({ key: `document:${type}`, criterion: `Required document: ${DOC_LABELS[type] || type}`, expected: 'At least one uploaded and processed document', actual: hasType ? 'Provided' : 'Missing', result: hasType ? 'pass' : 'review', explanation: hasType ? 'A document of this type is available.' : 'The required document is missing; eligibility cannot be assumed.', evidence: processed.filter((doc) => getDocType(doc) === type).map((doc) => doc.originalName) });
  }
  const academic = activeField(processed.filter((doc) => getDocType(doc) === 'marksheet'), ['percentage', 'cgpa']);
  if (Number.isFinite(criteria.minAcademicScore)) {
    if (!academic) {
      criteriaResults.push({ key: 'minAcademicScore', criterion: 'Minimum academic score', expected: `At least ${criteria.minAcademicScore}%`, actual: null, result: 'review', explanation: 'No readable percentage/score field was found in a marksheet.', evidence: [] });
      missingEvidence.push('A readable academic score from a marksheet');
    } else if (academic.key === 'cgpa') {
      criteriaResults.push({ key: 'minAcademicScore', criterion: 'Minimum academic score', expected: `At least ${criteria.minAcademicScore}%`, actual: `CGPA ${academic.value}`, result: 'review', explanation: 'CGPA is not compared directly to a percentage threshold. Confirm the institution’s official conversion method.', evidence: proof(academic) });
      missingEvidence.push('An official percentage or documented CGPA conversion');
    } else if (hasLowOcrConfidence(academic)) {
      criteriaResults.push({ key: 'minAcademicScore', criterion: 'Minimum academic score', expected: `At least ${criteria.minAcademicScore}%`, actual: `${academic.value}%`, result: 'review', explanation: 'The OCR engine reported low recognition confidence for this score; confirm it against the original document before evaluating the threshold.', evidence: proof(academic) });
      missingEvidence.push('Confirm the low-confidence academic score against the original document');
    } else {
      const value = Number(academic.value); const scorePass = Number.isFinite(value) && value >= criteria.minAcademicScore;
      criteriaResults.push({ key: 'minAcademicScore', criterion: 'Minimum academic score', expected: `At least ${criteria.minAcademicScore}%`, actual: `${value}%`, result: scorePass ? 'pass' : 'fail', explanation: scorePass ? 'The extracted percentage meets the configured threshold.' : 'The extracted percentage is below the configured threshold.', evidence: proof(academic) });
    }
  }
  const income = activeField(processed.filter((doc) => getDocType(doc) === 'income_certificate'), ['annualIncome']);
  if (Number.isFinite(criteria.maxAnnualIncome)) {
    if (!income) {
      criteriaResults.push({ key: 'maxAnnualIncome', criterion: 'Maximum annual family income', expected: `At most ₹${criteria.maxAnnualIncome.toLocaleString('en-IN')}`, actual: null, result: 'review', explanation: 'No readable annual-income field was found in an income certificate.', evidence: [] });
      missingEvidence.push('A readable annual income from an income certificate');
    } else if (hasLowOcrConfidence(income)) {
      criteriaResults.push({ key: 'maxAnnualIncome', criterion: 'Maximum annual family income', expected: `At most ₹${criteria.maxAnnualIncome.toLocaleString('en-IN')}`, actual: String(income.value), result: 'review', explanation: 'The OCR engine reported low recognition confidence for this income value; confirm it against the original document before evaluating the threshold.', evidence: proof(income) });
      missingEvidence.push('Confirm the low-confidence income value against the original document');
    } else {
      const value = Number(income.value); const incomePass = Number.isFinite(value) && value <= criteria.maxAnnualIncome;
      criteriaResults.push({ key: 'maxAnnualIncome', criterion: 'Maximum annual family income', expected: `At most ₹${criteria.maxAnnualIncome.toLocaleString('en-IN')}`, actual: `₹${value.toLocaleString('en-IN')}`, result: incomePass ? 'pass' : 'fail', explanation: incomePass ? 'The extracted annual income is within the configured limit.' : 'The extracted annual income is above the configured limit.', evidence: proof(income) });
    }
  }
  for (const fieldKey of criteria.requiredFields || []) {
    const field = activeField(processed, [fieldKey]);
    criteriaResults.push({ key: `field:${fieldKey}`, criterion: `Required field: ${fieldKey}`, expected: 'Must be present', actual: field?.value ?? null, result: field ? 'pass' : 'review', explanation: field ? 'The field was extracted from an uploaded document.' : 'The field is missing or unreadable and requires review.', evidence: proof(field) });
    if (!field) missingEvidence.push(`Field: ${fieldKey}`);
  }
  const inWindow = (!scholarship.startsAt || new Date(scholarship.startsAt) <= now) && (!scholarship.endsAt || new Date(scholarship.endsAt) >= now);
  if (!inWindow || scholarship.isActive === false) {
    criteriaResults.push({ key: 'availability', criterion: 'Scholarship currently active', expected: 'Active within validity dates', actual: 'Inactive or outside validity dates', result: 'fail', explanation: 'The scholarship is not currently open according to its configured dates/status.', evidence: [] });
  }
  const seenConsistency = new Set();
  const consistencyFindings = documents.flatMap((doc) => doc.consistencyChecks || []).filter((check) => {
    if (!['mismatch', 'potential_match', 'not_enough_information'].includes(check.outcome)) return false;
    const ids = check.compared?.documentIds || [check.compared?.left?.documentId, check.compared?.right?.documentId].filter(Boolean);
    const identity = `${check.check}:${[...ids].sort().join(':')}:${check.compared?.field || ''}:${check.outcome}`;
    if (seenConsistency.has(identity)) return false;
    seenConsistency.add(identity);
    return true;
  });
  if (consistencyFindings.length) {
    criteriaResults.push({
      key: 'documentConsistency', criterion: 'Cross-document consistency', expected: 'No unresolved conflicting or ambiguous evidence',
      actual: `${consistencyFindings.length} finding(s) need review`, result: 'review',
      explanation: 'One or more names, academic values, or duplicate-file checks are ambiguous. Review the exact source values before relying on this assessment.',
      evidence: [...new Set(consistencyFindings.flatMap((check) => check.evidence || []))]
    });
  }
  const failed = criteriaResults.some((item) => item.result === 'fail');
  const uncertainConsistency = consistencyFindings.length > 0;
  const lowConfidenceEvidence = documents.some((doc) => (doc.fields || []).some((field) => hasLowOcrConfidence(field)));
  const review = criteriaResults.some((item) => item.result === 'review') || missingDocuments.length > 0 || uncertainConsistency || lowConfidenceEvidence || documents.some((doc) => doc.status === 'needs_review' || doc.predictedType === 'unknown');
  const outcome = failed ? 'not_eligible' : review ? 'needs_review' : 'eligible';
  return { outcome, criteriaResults, consistencyFindings, missingDocuments, missingEvidence: [...new Set(missingEvidence)], limitations };
}
