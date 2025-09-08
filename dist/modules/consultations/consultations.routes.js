"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consultationsRoutes = void 0;
const express_1 = require("express");
const consultations_controller_1 = require("./consultations.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.consultationsRoutes = router;
const consultationsController = new consultations_controller_1.ConsultationsController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Create consultation from appointment (doctors only)
router.post('/create', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), consultationsController.createConsultation.bind(consultationsController));
// Create direct consultation from doctor-meet (doctors only)
router.post('/create-direct', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), consultationsController.createDirectConsultation.bind(consultationsController));
// Get consultation details (patients and doctors with access)
router.get('/:consultationId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), consultationsController.getConsultation.bind(consultationsController));
// Update consultation (doctors only)
router.put('/:consultationId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), consultationsController.updateConsultation.bind(consultationsController));
// Create health scan (doctors only)
router.post('/health-scan', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), consultationsController.createHealthScan.bind(consultationsController));
// Get health scan (patients and doctors with access)
router.get('/health-scan/:scanId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), consultationsController.getHealthScan.bind(consultationsController));
// Join consultation with code validation (patients and doctors)
router.post('/join', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), consultationsController.joinConsultation.bind(consultationsController));
// Update consultation privacy settings (patient or doctor)
router.patch('/:consultationId/privacy', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), consultationsController.updateConsultationPrivacy.bind(consultationsController));
// Share consultation with specific doctor (patient or doctor)
router.post('/:consultationId/share', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), consultationsController.shareConsultation.bind(consultationsController));
