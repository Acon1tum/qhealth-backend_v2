"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfCheckRoutes = void 0;
const express_1 = require("express");
const self_check_controller_1 = require("./self-check.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.selfCheckRoutes = router;
const selfCheckController = new self_check_controller_1.SelfCheckController();
// Test database connection (no auth required for testing)
router.get('/test-db', selfCheckController.testDatabaseConnection.bind(selfCheckController));
// Apply authentication middleware to all other routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Save self-check results (patients only)
router.post('/save', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT]), selfCheckController.saveSelfCheckResults.bind(selfCheckController));
// Get user's self-check history (patients only)
router.get('/history', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT]), selfCheckController.getSelfCheckHistory.bind(selfCheckController));
// Get specific self-check result (patients only)
router.get('/:consultationId', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT]), selfCheckController.getSelfCheckResult.bind(selfCheckController));
// Delete self-check result (patients only)
router.delete('/:consultationId', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT]), selfCheckController.deleteSelfCheckResult.bind(selfCheckController));
