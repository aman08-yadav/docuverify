import { fileTypeFromBuffer } from 'file-type';
import AppError from '../../utils/AppError.js';

const supported = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export async function validateUploadBuffer(buffer, declaredMime = '', maxBytes = 10 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) throw new AppError(415, 'The uploaded file is empty or too small to validate.', 'INVALID_FILE');
  if (buffer.length > maxBytes) throw new AppError(413, `File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`, 'FILE_TOO_LARGE');
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !supported.has(detected.mime)) throw new AppError(415, 'File signature is not a supported PDF, JPEG, or PNG.', 'UNSUPPORTED_FILE');
  if (declaredMime && !['application/octet-stream', detected.mime].includes(declaredMime)) throw new AppError(415, 'The file contents do not match the declared file type.', 'MIME_MISMATCH');
  if (detected.mime === 'application/pdf' && !buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new AppError(415, 'PDF file signature could not be verified.', 'INVALID_SIGNATURE');
  return detected;
}
