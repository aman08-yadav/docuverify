import mongoose from 'mongoose';
import multer from 'multer';
export function notFound(req, res) { res.status(404).json({ success: false, message: 'The requested API endpoint was not found.', code: 'NOT_FOUND' }); }
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.statusCode || 500; let message = error.message || 'Unexpected server error.'; let code = error.code || 'INTERNAL_ERROR';
  if (error.message === 'Origin is not allowed by the CORS policy.') {
    status = 403; message = 'This origin is not allowed to access the API.'; code = 'CORS_ORIGIN_DENIED';
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  if (error instanceof multer.MulterError) { status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400; message = error.code === 'LIMIT_FILE_SIZE' ? 'File is larger than the configured upload limit.' : 'The upload request is invalid.'; code = error.code; }
  if (error instanceof mongoose.Error.ValidationError) { status = 400; message = 'One or more fields did not pass validation.'; code = 'VALIDATION_ERROR'; }
  if (error instanceof mongoose.Error.CastError) { status = 400; message = 'The supplied record ID is invalid.'; code = 'INVALID_ID'; }
  if (error?.code === 11000) {
    status = 409;
    message = error.keyPattern?.email ? 'An account with that email already exists.' : 'A record with that unique key already exists.';
    code = 'DUPLICATE_VALUE';
  }
  if (!error.statusCode && status === 500) console.error('Unhandled request error:', error.stack || error.message);
  if (process.env.NODE_ENV === 'production' && status === 500) message = 'An unexpected error occurred. Please try again.';
  res.status(status).json({ success: false, message, code });
}
