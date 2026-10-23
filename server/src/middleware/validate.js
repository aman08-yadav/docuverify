import AppError from '../utils/AppError.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.slice(0, 6).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
      return next(new AppError(400, `Request validation failed. ${details.join('; ')}`, 'VALIDATION_ERROR'));
    }
    req.body = result.data;
    return next();
  };
}
