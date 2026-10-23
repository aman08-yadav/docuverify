export function formatBytes(bytes = 0) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const value = Number(bytes);
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const rounded = value / (1024 ** index);
  return `${rounded.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function titleCase(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
