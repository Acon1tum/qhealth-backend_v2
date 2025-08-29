"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.medicalRecordsRoutes = void 0;
const express_1 = require("express");
const medical_records_controller_1 = require("./medical-records.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.medicalRecordsRoutes = router;
const medicalRecordsController = new medical_records_controller_1.MedicalRecordsController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Create medical record (doctors and patients)
router.post('/create', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.createMedicalRecord.bind(medicalRecordsController));
// Get patient medical records (doctors and patients)
router.get('/patient/:patientId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.getPatientMedicalRecords.bind(medicalRecordsController));
// Get patient medical records with summary and trends (for dashboard)
router.get('/patient/:patientId/summary', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.getPatientMedicalRecordsSummary.bind(medicalRecordsController));
// Update medical record (creator only)
router.put('/:recordId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.updateMedicalRecord.bind(medicalRecordsController));
// Update privacy settings (patient or creator)
router.patch('/:recordId/privacy', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.updatePrivacySettings.bind(medicalRecordsController));
// Share medical record with specific doctor
router.post('/:recordId/share', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.shareMedicalRecord.bind(medicalRecordsController));
// Delete medical record (patient or creator)
router.delete('/:recordId', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR, client_1.Role.PATIENT]), medicalRecordsController.deleteMedicalRecord.bind(medicalRecordsController));
