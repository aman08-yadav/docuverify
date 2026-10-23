import Document from '../../models/Document.js';
import { config } from '../../config/env.js';
import { runOcrForDocument } from './processDocument.js';

let active = 0;
const pending = [];
const maxPending = 12;
function pump() {
  while (active < config.ocrConcurrency && pending.length) {
    const job = pending.shift(); active += 1;
    runOcrForDocument(job.id)
      .catch((error) => console.error('Document processing failed:', error.message))
      .finally(() => { active -= 1; pump(); });
  }
}
export async function enqueueProcessing(documentId) {
  if (pending.length >= maxPending) { const error = new Error('The document-processing queue is busy. Please retry in a few minutes.'); error.statusCode = 503; error.code = 'OCR_QUEUE_FULL'; throw error; }
  const id = String(documentId);
  await Document.findByIdAndUpdate(id, { $set: { status: 'queued', processingError: '', 'ocr.progressPercent': 0, 'ocr.stage': 'Waiting for OCR worker' } });
  pending.push({ id }); pump();
  return { accepted: true, queuePosition: pending.length };
}
export async function recoverPendingProcessing() {
  const capacity = maxPending + config.ocrConcurrency;
  const stranded = await Document.find({ status: { $in: ['uploaded', 'queued', 'processing'] } })
    .select('_id').sort({ createdAt: 1 }).limit(capacity).lean();
  const recoverIds = stranded.map((doc) => doc._id);
  await Document.updateMany({
    status: { $in: ['uploaded', 'queued', 'processing'] },
    _id: { $nin: recoverIds }
  }, {
    $set: { status: 'failed', processingError: 'Processing was interrupted by a server restart and the recovery queue was at capacity. Retry this document.' }
  });
  let recovered = 0;
  for (const doc of stranded) {
    await enqueueProcessing(doc._id);
    recovered += 1;
  }
  return { recovered, markedFailed: Math.max(0, await Document.countDocuments({ status: 'failed', processingError: 'Processing was interrupted by a server restart and the recovery queue was at capacity. Retry this document.' })) };
}
export const queueHealth = () => ({ active, pending: pending.length, concurrency: config.ocrConcurrency, maxPending });
