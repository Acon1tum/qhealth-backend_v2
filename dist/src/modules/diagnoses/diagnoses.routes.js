"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosesRoutes = void 0;
const express_1 = require("express");
const diagnoses_controller_1 = require("./diagnoses.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.diagnosesRoutes = router;
const diagnosesController = new diagnoses_controller_1.DiagnosesController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Create diagnosis (doctors only)
router.post('/create', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), diagnosesController.createDiagnosis.bind(diagnosesController));
// Get diagnoses for a specific patient
router.get('/patient/:patientId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), diagnosesController.getPatientDiagnoses.bind(diagnosesController));
// Get diagnoses by a specific doctor
router.get('/doctor', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), diagnosesController.getDoctorDiagnoses.bind(diagnosesController));
// Update diagnosis (doctors only)
router.put('/:diagnosisId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), diagnosesController.updateDiagnosis.bind(diagnosesController));
// Delete diagnosis (doctors only)
router.delete('/:diagnosisId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), diagnosesController.deleteDiagnosis.bind(diagnosesController));
