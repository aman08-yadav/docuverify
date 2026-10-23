import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { config } from './config/env.js';
import { recoverPendingProcessing } from './services/ocr/queue.js';

async function start() {
  await connectDatabase();
  const recovery = await recoverPendingProcessing();
  if (recovery.recovered || recovery.markedFailed) console.log(`Recovered OCR jobs: ${recovery.recovered}; overflow marked failed: ${recovery.markedFailed}.`);
  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => console.log(`DocuVerify API listening on port ${config.port} (${config.nodeEnv})`));
  const stop = async (signal) => {
    console.log(`${signal} received; shutting down gracefully.`);
    server.close(async () => { const mongoose = await import('mongoose'); await mongoose.default.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => stop('SIGINT')); process.on('SIGTERM', () => stop('SIGTERM'));
}
start().catch((error) => { console.error('Failed to start DocuVerify:', error.message); process.exit(1); });
