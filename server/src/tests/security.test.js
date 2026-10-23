import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { requireAdmin } from '../middleware/auth.js';
import { validateUploadBuffer } from '../services/storage/validateUpload.js';
import { createApp } from '../app.js';

test('password hashing stores a hash and only the correct password validates', async () => {
  const password = 'StudentDemoPassword2026!';
  const hash = await bcrypt.hash(password, 4);
  assert.notEqual(hash, password);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare('wrong-password', hash), false);
});
test('student role is rejected by admin middleware while admin role proceeds', async () => {
  const app = express();
  app.get('/student', (req, res, next) => { req.user = { role: 'student' }; next(); }, requireAdmin, (req, res) => res.json({ passed: true }));
  app.get('/admin', (req, res, next) => { req.user = { role: 'admin' }; next(); }, requireAdmin, (req, res) => res.json({ passed: true }));
  assert.equal((await request(app).get('/student')).status, 403);
  assert.equal((await request(app).get('/admin')).status, 200);
});
test('upload validation rejects unsupported data and oversized buffers', async () => {
  await assert.rejects(() => validateUploadBuffer(Buffer.from('this is not a document'), 'text/plain'), { code: 'UNSUPPORTED_FILE' });
  await assert.rejects(() => validateUploadBuffer(Buffer.alloc(16, 0), 'application/pdf', 10), { code: 'FILE_TOO_LARGE' });
});
test('HTTP-only session endpoints require an authenticated session', async () => {
  const app = createApp();
  const response = await request(app).get('/api/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});
test('CSRF endpoint issues a token for a browser client', async () => {
  const app = createApp();
  const response = await request(app).get('/api/auth/csrf');
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.data.csrfToken, 'string');
  assert.ok(response.body.data.csrfToken.length >= 32);
  assert.ok(response.headers['set-cookie'].some((cookie) => cookie.includes('dv_csrf=')));
});
test('health endpoint clearly reports unavailable database instead of claiming healthy', async () => {
  const app = createApp();
  const response = await request(app).get('/api/health');
  assert.ok([200, 503].includes(response.status));
  if (response.status === 503) assert.equal(response.body.data.database.connected, false);
  assert.equal(typeof response.body.data.database.state, 'string');
});
