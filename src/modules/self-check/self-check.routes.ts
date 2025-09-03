import { Router } from 'express';
import { SelfCheckController } from './self-check.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const selfCheckController = new SelfCheckController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Save self-check results (patients only)
router.post('/save', 
  requireRole([Role.PATIENT]), 
  selfCheckController.saveSelfCheckResults.bind(selfCheckController)
);

// Get user's self-check history (patients only)
router.get('/history', 
  requireRole([Role.PATIENT]), 
  selfCheckController.getSelfCheckHistory.bind(selfCheckController)
);

// Get specific self-check result (patients only)
router.get('/:consultationId', 
  requireRole([Role.PATIENT]), 
  selfCheckController.getSelfCheckResult.bind(selfCheckController)
);

// Delete self-check result (patients only)
router.delete('/:consultationId', 
  requireRole([Role.PATIENT]), 
  selfCheckController.deleteSelfCheckResult.bind(selfCheckController)
);

export { router as selfCheckRoutes };
