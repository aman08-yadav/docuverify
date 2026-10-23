export function normalizeName(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(mr|mrs|ms|shri|smt|dr)\b\.?/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function nameSimilarity(a = '', b = '') {
  const left = normalizeName(a); const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const x = left.replace(/\s/g, ''); const y = right.replace(/\s/g, '');
  const previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) {
    let diagonal = previous[0]; previous[0] = i;
    for (let j = 1; j <= y.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (x[i - 1] === y[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return 1 - previous[y.length] / Math.max(x.length, y.length, 1);
}
export function redactIdentityNumbers(text = '') {
  return String(text).replace(/\b(?:\d[ -]?){12}\b/g, (match) => `XXXX-XXXX-${match.replace(/\D/g, '').slice(-4)}`);
}
