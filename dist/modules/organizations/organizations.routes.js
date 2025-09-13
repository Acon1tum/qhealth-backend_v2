"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationsRoutes = void 0;
const express_1 = require("express");
const organizations_controller_1 = require("./organizations.controller");
const router = (0, express_1.Router)();
exports.organizationsRoutes = router;
const organizationsController = new organizations_controller_1.OrganizationsController();
// Get all active organizations (public endpoint)
router.get('/', organizationsController.getOrganizations.bind(organizationsController));
// Get organization by ID (public endpoint)
router.get('/:id', organizationsController.getOrganizationById.bind(organizationsController));
// Get doctors by organization (public endpoint)
router.get('/:organizationId/doctors', organizationsController.getDoctorsByOrganization.bind(organizationsController));
