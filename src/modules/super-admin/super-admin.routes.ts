import { Router } from 'express';
import { SuperAdminController } from './super-admin.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const superAdminController = new SuperAdminController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);
router.use(requireRole([Role.SUPER_ADMIN]));

// System statistics and health
router.get('/statistics', superAdminController.getSystemStatistics.bind(superAdminController));
router.get('/health', superAdminController.getSystemHealth.bind(superAdminController));

// Organizations with statistics
router.get('/organizations', superAdminController.getOrganizationsWithStats.bind(superAdminController));

// Activities and logs
router.get('/activities', superAdminController.getRecentActivities.bind(superAdminController));

// User statistics
router.get('/users/statistics', superAdminController.getUserStatistics.bind(superAdminController));

// Security events
router.get('/security/events', superAdminController.getSecurityEvents.bind(superAdminController));
router.patch('/security/events/:eventId/resolve', superAdminController.resolveSecurityEvent.bind(superAdminController));

export { router as superAdminRoutes };

