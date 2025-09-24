"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientsRoutes = void 0;
const express_1 = require("express");
const patients_controller_1 = require("./patients.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const router = (0, express_1.Router)();
exports.patientsRoutes = router;
const controller = new patients_controller_1.PatientsController();
// Public list and read endpoints (listing patients doesn't expose sensitive data)
router.get('/', controller.listPatients.bind(controller));
router.get('/:id', controller.getPatientById.bind(controller));
// Protected write endpoints
router.post('/', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, controller.createPatient.bind(controller));
router.put('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, controller.updatePatient.bind(controller));
router.delete('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, controller.deletePatient.bind(controller));
// Additional patient-specific endpoints
router.get('/:id/medical-history', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, controller.getPatientMedicalHistory.bind(controller));
router.get('/:id/appointments', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, controller.getPatientAppointments.bind(controller));
