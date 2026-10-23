// An isolated, known test-only signing secret keeps unit/API tests independent of developer .env files.
// NODE_ENV=production is never overwritten, so production safety checks still apply.
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (process.env.NODE_ENV === 'test' && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'docuverify-test-only-secret-not-for-deployment-2026';
}
