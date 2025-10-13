"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminRoutes = void 0;
const express_1 = require("express");
const super_admin_controller_1 = require("./super-admin.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.superAdminRoutes = router;
const superAdminController = new super_admin_controller_1.SuperAdminController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
router.use((0, auth_middleware_1.requireRole)([client_1.Role.SUPER_ADMIN]));
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
