"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationsRoutes = void 0;
const express_1 = require("express");
const organizations_controller_1 = require("./organizations.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const router = (0, express_1.Router)();
exports.organizationsRoutes = router;
const organizationsController = new organizations_controller_1.OrganizationsController();
// Public endpoints
// Get all organizations (public endpoint)
router.get('/', organizationsController.getOrganizations.bind(organizationsController));
// Get organization statistics (public endpoint) - MUST come before /:id route
router.get('/statistics', organizationsController.getOrganizationStatistics.bind(organizationsController));
// Get doctors by organization (public endpoint)
router.get('/:organizationId/doctors', organizationsController.getDoctorsByOrganization.bind(organizationsController));
// Get organization by ID (public endpoint) - MUST come after specific routes
router.get('/:id', organizationsController.getOrganizationById.bind(organizationsController));
// Protected endpoints (require authentication)
// Create new organization
router.post('/', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, organizationsController.createOrganization.bind(organizationsController));
// Update organization
router.put('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, organizationsController.updateOrganization.bind(organizationsController));
// Delete organization
router.delete('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, organizationsController.deleteOrganization.bind(organizationsController));
// Toggle organization status
router.patch('/:id/status', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, organizationsController.toggleOrganizationStatus.bind(organizationsController));
