import { Router } from 'express';
import { AuditController } from './audit.controller';
import {
  authenticateToken,
  requireAuth,
  requireRole,
  rateLimit
} from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

/**
 * @route   GET /audit/logs
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (All authenticated users can see their own logs, Admin/Super Admin can see more)
 * @query   { page?: number, limit?: number, userId?: string, category?: AuditCategory, level?: AuditLevel, action?: string, resourceType?: string, resourceId?: string, startDate?: string, endDate?: string, search?: string }
 */
router.get(
  '/logs',
  rateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  AuditController.getAuditLogs
);

/**
 * @route   GET /audit/logs/:id
 * @desc    Get audit log by ID
 * @access  Private (Users can see their own logs, Admin/Super Admin can see more)
 * @params  { id: string }
 */
router.get(
  '/logs/:id',
  rateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  AuditController.getAuditLogById
);

/**
 * @route   GET /audit/security-events
 * @desc    Get security events with filtering and pagination
 * @access  Private (Admin and Super Admin only)
 * @query   { page?: number, limit?: number, eventType?: string, severity?: AuditLevel, resolved?: boolean, userId?: string, startDate?: string, endDate?: string, search?: string }
 */
router.get(
  '/security-events',
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  rateLimit(50, 15 * 60 * 1000), // 50 requests per 15 minutes
  AuditController.getSecurityEvents
);

/**
 * @route   PUT /audit/security-events/:id/resolve
 * @desc    Resolve a security event
 * @access  Private (Admin and Super Admin only)
 * @params  { id: string }
 */
router.put(
  '/security-events/:id/resolve',
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  rateLimit(20, 15 * 60 * 1000), // 20 requests per 15 minutes
  AuditController.resolveSecurityEvent
);

/**
 * @route   GET /audit/statistics
 * @desc    Get audit statistics and analytics
 * @access  Private (Admin and Super Admin only)
 * @query   { startDate?: string, endDate?: string }
 */
router.get(
  '/statistics',
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  rateLimit(30, 15 * 60 * 1000), // 30 requests per 15 minutes
  AuditController.getAuditStatistics
);

export default router;
