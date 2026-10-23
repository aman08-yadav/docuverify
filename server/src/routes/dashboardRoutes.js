import { Router } from 'express';
import { dashboard } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router(); router.use(requireAuth); router.get('/', asyncHandler(dashboard)); export default router;
