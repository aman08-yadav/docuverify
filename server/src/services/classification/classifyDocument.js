const RULES = [
  {
    type: 'marksheet',
    terms: [
      'marksheet', 'mark sheet', 'statement of marks', 'grade sheet', 'grade card', 'cgpa', 'sgpa',
      'semester', 'total marks', 'percentage', 'university examination', 'board of secondary',
      'higher secondary', 'intermediate examination', 'secondary school', 'cbse', 'icse',
      'marks obtained', 'maximum marks', 'result: pass', 'provisional certificate', 'academic transcript'
    ]
  },
  {
    type: 'income_certificate',
    terms: [
      'income certificate', 'annual income', 'family income', 'tehsildar', 'tahsildar',
      'income from all sources', 'revenue department', 'sub-divisional magistrate', 'sdm',
      'gross annual income', 'competent authority'
    ]
  },
  {
    type: 'domicile_certificate',
    terms: [
      'domicile certificate', 'resident certificate', 'permanent resident', 'proof of residence',
      'certificate of domicile', 'bonafide resident', 'state resident'
    ]
  },
  {
    type: 'caste_certificate',
    terms: [
      'caste certificate', 'scheduled caste', 'scheduled tribe', 'other backward class',
      'community certificate', 'social welfare department', 'ews certificate'
    ]
  },
  {
    type: 'identity',
    terms: [
      'identity card', 'date of birth', 'aadhaar', 'passport', 'driving licence', 'driving license',
      'identity number', 'unique identification', 'voter id', 'election commission', 'pan card'
    ]
  }
];
export function classifyDocument(text = '') {
  const normalized = String(text).toLowerCase().replace(/\s+/g, ' ');
  const scores = RULES.map((rule) => ({
    type: rule.type,
    evidence: rule.terms.filter((term) => normalized.includes(term)),
    score: rule.terms.filter((term) => normalized.includes(term)).reduce((sum, term) => sum + (term.includes(' ') ? 2 : 1), 0)
  })).sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score < 2 || (scores[1] && scores[1].score === best.score)) {
    return { type: 'unknown', confidence: null, evidence: best?.evidence || [], method: 'keyword-rules-v1', reviewRequired: true };
  }
  const matchedWeight = best.evidence.reduce((sum, term) => sum + (term.includes(' ') ? 2 : 1), 0);
  const confidence = Math.min(95, Math.round(42 + matchedWeight * 9));
  return { type: best.type, confidence, evidence: best.evidence, method: 'keyword-rules-v1', reviewRequired: confidence < 60 };
}
