"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prescriptionsRoutes = void 0;
const express_1 = require("express");
const prescriptions_controller_1 = __importDefault(require("./prescriptions.controller"));
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.prescriptionsRoutes = router;
const prescriptionsController = new prescriptions_controller_1.default();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Get available patients (doctors only)
router.get('/patients', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), prescriptionsController.getAvailablePatients.bind(prescriptionsController));
// Create prescription (doctors only)
router.post('/create', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), prescriptionsController.createPrescription.bind(prescriptionsController));
// Get prescriptions for a patient (patients and doctors with access)
router.get('/patient/:patientId', prescriptionsController.getPatientPrescriptions.bind(prescriptionsController));
// Get prescriptions by doctor (doctors only)
router.get('/doctor/:doctorId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), prescriptionsController.getDoctorPrescriptions.bind(prescriptionsController));
// Get prescription details (patients and doctors with access)
router.get('/:id', prescriptionsController.getPrescriptionById.bind(prescriptionsController));
// Update prescription (doctors only)
router.put('/:id', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), prescriptionsController.updatePrescription.bind(prescriptionsController));
// Delete prescription (doctors only)
router.delete('/:id', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), prescriptionsController.deletePrescription.bind(prescriptionsController));
// Get prescriptions for a consultation (doctors and patients with access)
router.get('/consultation/:consultationId', prescriptionsController.getConsultationPrescriptions.bind(prescriptionsController));
