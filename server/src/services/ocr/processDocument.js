import { createWorker } from 'tesseract.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import Document from '../../models/Document.js';
import { config } from '../../config/env.js';
import { readStoredFile } from '../storage/gridFsStorage.js';
import { classifyDocument } from '../classification/classifyDocument.js';
import { extractFields } from '../extraction/extractFields.js';
import { redactIdentityNumbers } from '../../utils/normalize.js';

async function processImage(buffer, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && Number.isFinite(message.progress)) onProgress(message.progress, 'Recognizing text');
      else if (message.status) onProgress(null, message.status);
    }
  });
  try {
    const result = await worker.recognize(buffer);
    const data = result.data || {};
    const words = (data.words || []).map((word) => ({ text: word.text, confidence: word.confidence }));
    const valid = words.map((word) => word.confidence).filter((value) => Number.isFinite(value) && value >= 0);
    return { text: data.text || '', words, confidences: valid, pages: 1 };
  } finally { await worker.terminate(); }
}

async function processPdf(buffer, onProgress = () => {}) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  if (pdf.numPages > config.maxPdfPages) throw new Error(`This PDF has ${pdf.numPages} pages; the current limit is ${config.maxPdfPages}.`);
  const textParts = []; const words = []; const confidences = [];
  let scannedPages = 0;
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str || '').join(' ').replace(/[ \t]+/g, ' ').trim();
    if (text.length >= 45) {
      textParts.push(`--- Page ${pageNo} ---\n${text}`);
      onProgress(pageNo / pdf.numPages, 'Extracting PDF text');
    } else {
      scannedPages += 1;
      const naturalViewport = page.getViewport({ scale: 1 });
      if (!Number.isFinite(naturalViewport.width) || !Number.isFinite(naturalViewport.height) || naturalViewport.width <= 0 || naturalViewport.height <= 0) throw new Error(`PDF page ${pageNo} has invalid dimensions.`);
      const scale = Math.min(1.6, 3000 / naturalViewport.width, 3000 / naturalViewport.height);
      if (!Number.isFinite(scale) || scale < 0.1) throw new Error(`PDF page ${pageNo} exceeds the supported rendering dimensions.`);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const result = await processImage(await canvas.encode('png'), (pageProgress, stage) => {
        if (Number.isFinite(pageProgress)) onProgress(((pageNo - 1) + pageProgress) / pdf.numPages, stage);
        else onProgress(null, stage);
      });
      textParts.push(`--- Page ${pageNo} (OCR) ---\n${result.text}`);
      words.push(...result.words); confidences.push(...result.confidences);
    }
    page.cleanup();
  }
  await pdf.cleanup();
  return { text: textParts.join('\n\n'), words, confidences, pages: pdf.numPages, engine: scannedPages ? (scannedPages === pdf.numPages ? 'Tesseract.js + PDF.js' : 'PDF.js + Tesseract.js') : 'PDF.js text extraction' };
}

export async function runOcrForDocument(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) return;
  let persistedProgress = 5;
  let persistedStage = 'Preparing document';
  let progressWrite = Promise.resolve();
  const reportProgress = (fraction, stage = 'Processing document') => {
    if (Number.isFinite(fraction)) {
      const next = Math.max(5, Math.min(95, Math.round(5 + Math.max(0, Math.min(1, fraction)) * 90)));
      if (next < persistedProgress + 8 && stage === persistedStage && next < 95) return;
      persistedProgress = next;
    }
    if (stage) persistedStage = String(stage).slice(0, 80);
    progressWrite = progressWrite.then(() => Document.updateOne({ _id: doc._id, status: 'processing' }, {
      $set: { 'ocr.progressPercent': persistedProgress, 'ocr.stage': persistedStage }
    })).catch(() => {});
  };
  try {
    doc.status = 'processing'; doc.processingError = '';
    doc.ocr = { engine: doc.mimeType === 'application/pdf' ? 'PDF.js + Tesseract.js' : 'Tesseract.js', language: 'eng', startedAt: new Date(), progressPercent: 5, stage: 'Preparing document' };
    await doc.save();
    const buffer = await readStoredFile(doc.gridFsId, config.maxUploadBytes);
    let result;
    if (doc.mimeType === 'application/pdf') result = await processPdf(buffer, reportProgress);
    else result = { ...(await processImage(buffer, reportProgress)), engine: 'Tesseract.js' };
    await progressWrite;
    const cleanedText = redactIdentityNumbers(result.text).slice(0, 120000);
    const classification = classifyDocument(cleanedText);
    const extractionType = classification.type === 'unknown' ? doc.declaredType : classification.type;
    const fields = extractFields(cleanedText, extractionType, result.words);
    const confidence = result.confidences.length ? Math.round(result.confidences.reduce((a, b) => a + b, 0) / result.confidences.length) : null;
    doc.extractedText = cleanedText;
    doc.consistencyChecks = [];
    doc.predictedType = classification.type;
    doc.classification = { confidence: classification.confidence, evidence: classification.evidence, method: classification.method };
    doc.fields = fields;
    doc.ocr = { engine: result.engine || 'Tesseract.js', language: 'eng', startedAt: doc.ocr?.startedAt || new Date(), processedAt: new Date(), pagesProcessed: result.pages || 1, averageWordConfidence: confidence, progressPercent: 100, stage: 'Processing complete' };
    doc.status = !cleanedText.trim() || classification.reviewRequired || classification.type === 'unknown' || fields.length === 0 ? 'needs_review' : 'processed';
    if (!cleanedText.trim()) doc.processingError = 'No readable text was extracted. Try a clearer image or review the source document manually.';
    await doc.save();
  } catch (error) {
    await Document.findByIdAndUpdate(documentId, { $set: { status: 'failed', processingError: String(error.message || 'OCR processing failed').slice(0, 500) } });
    throw error;
  }
}
