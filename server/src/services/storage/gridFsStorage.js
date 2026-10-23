import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

let bucket;
function getBucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected; private document storage is unavailable.');
  if (!bucket) bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'privateDocuments' });
  return bucket;
}
export function storeBuffer(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const id = new ObjectId();
    const stream = getBucket().openUploadStreamWithId(id, filename, { contentType, metadata });
    stream.on('error', reject);
    stream.on('finish', () => resolve(id));
    stream.end(buffer);
  });
}
export function openReadStream(id) {
  return getBucket().openDownloadStream(new ObjectId(String(id)));
}
export async function removeStoredFile(id) {
  try { await getBucket().delete(new ObjectId(String(id))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
export async function readStoredFile(id, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const stream = openReadStream(id);
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) { stream.destroy(new Error('Stored file exceeded the configured read limit.')); return; }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
