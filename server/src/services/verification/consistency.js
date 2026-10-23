import { nameSimilarity, normalizeName } from '../../utils/normalize.js';

export function compareNames(a, b) {
  const left = normalizeName(a); const right = normalizeName(b);
  if (!left || !right) return { outcome: 'not_enough_information', similarity: null, explanation: 'One or both name fields are missing.' };
  const similarity = nameSimilarity(a, b);
  if (similarity >= 0.96) return { outcome: 'match', similarity, explanation: 'Names match after normalizing case, punctuation, honorifics, and whitespace.' };
  if (similarity >= 0.78) return { outcome: 'potential_match', similarity, explanation: 'Names are similar but not identical; manual review is recommended.' };
  return { outcome: 'mismatch', similarity, explanation: 'The normalized names differ materially; confirm the source documents before drawing a conclusion.' };
}
export function buildConsistencyChecks(documents) {
  const checks = [];
  for (let i = 0; i < documents.length; i += 1) {
    for (let j = i + 1; j < documents.length; j += 1) {
      const a = documents[i]; const b = documents[j];
      if (a.sha256 && b.sha256 && a.sha256 === b.sha256) {
        checks.push({ check: 'duplicate_file', outcome: 'potential_match', explanation: 'These uploads have identical SHA-256 hashes.', compared: { documentIds: [String(a._id), String(b._id)] }, evidence: [a.originalName, b.originalName], checkedAt: new Date() });
      }
      const nameA = a.fields?.find((field) => ['studentName', 'applicantName', 'name'].includes(field.key))?.value;
      const nameB = b.fields?.find((field) => ['studentName', 'applicantName', 'name'].includes(field.key))?.value;
      if (nameA || nameB) {
        const result = compareNames(nameA, nameB);
        checks.push({ check: 'name_consistency', outcome: result.outcome, explanation: result.explanation, compared: { left: { documentId: String(a._id), value: nameA || null }, right: { documentId: String(b._id), value: nameB || null }, similarity: result.similarity }, evidence: [a.originalName, b.originalName], checkedAt: new Date() });
      }
      const isAcademicA = [a.predictedType, a.declaredType].includes('marksheet');
      const isAcademicB = [b.predictedType, b.declaredType].includes('marksheet');
      if (isAcademicA && isAcademicB) {
        for (const key of ['percentage', 'cgpa']) {
          const fieldA = a.fields?.find((field) => field.key === key && Number.isFinite(Number(field.value)));
          const fieldB = b.fields?.find((field) => field.key === key && Number.isFinite(Number(field.value)));
          if (fieldA && fieldB && Math.abs(Number(fieldA.value) - Number(fieldB.value)) > 0.05) {
            checks.push({
              check: 'academic_value_consistency', outcome: 'mismatch',
              explanation: `The two marksheets report different ${key === 'percentage' ? 'percentages' : 'CGPAs'}. Check the original academic records before relying on either value.`,
              compared: { field: key, left: { documentId: String(a._id), value: fieldA.value }, right: { documentId: String(b._id), value: fieldB.value } },
              evidence: [a.originalName, b.originalName], checkedAt: new Date()
            });
          }
        }
      }
    }
  }
  return checks;
}
