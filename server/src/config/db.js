import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  return mongoose.connection;
}

export function databaseHealth() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return { connected: mongoose.connection.readyState === 1, state: states[mongoose.connection.readyState] || 'unknown' };
}
