"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosesController = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const audit_service_1 = require("../../shared/services/audit.service");
const notification_service_1 = require("../notifications/notification.service");
const prisma = new client_1.PrismaClient();
class DiagnosesController {
    // Create a new diagnosis
    createDiagnosis(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const doctorId = req.user.id;
                const { patientId, consultationId, diagnosisCode, diagnosisName, description, severity = client_2.DiagnosisSeverity.MILD, status = client_2.DiagnosisStatus.ACTIVE, onsetDate, resolvedAt, notes, isPrimary = false } = req.body;
                // Validate required fields
                if (!patientId || !diagnosisName) {
                    res.status(400).json({
                        success: false,
                        message: 'Missing required fields: patientId, diagnosisName'
                    });
                    return;
                }
                // Verify patient exists
                const patient = yield prisma.user.findUnique({
                    where: { id: patientId },
                    include: { patientInfo: true }
                });
                if (!patient || patient.role !== 'PATIENT') {
                    res.status(404).json({
                        success: false,
                        message: 'Patient not found'
                    });
                    return;
                }
                // Verify consultation exists if provided
                if (consultationId) {
                    const consultation = yield prisma.consultation.findUnique({
                        where: { id: consultationId }
                    });
                    if (!consultation) {
                        res.status(404).json({
                            success: false,
                            message: 'Consultation not found'
                        });
                        return;
                    }
                }
                // Create diagnosis
                const diagnosis = yield prisma.diagnosis.create({
                    data: {
                        patientId: patientId,
                        doctorId,
                        consultationId: consultationId ? consultationId : null,
                        diagnosisCode: diagnosisCode || null,
                        diagnosisName,
                        description: description || null,
                        severity,
                        status,
                        onsetDate: onsetDate ? new Date(onsetDate) : null,
                        diagnosedAt: new Date(),
                        resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
                        notes: notes || null,
                        isPrimary
                    },
                    include: {
                        patient: {
                            select: {
                                id: true,
                                email: true,
                                patientInfo: { select: { fullName: true } }
                            }
                        },
                        doctor: {
                            select: {
                                id: true,
                                email: true,
                                doctorInfo: { select: { firstName: true, lastName: true } }
                            }
                        },
                        consultation: {
                            select: {
                                id: true,
                                consultationCode: true
                            }
                        }
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'CREATE_DIAGNOSIS', 'DATA_MODIFICATION', `Diagnosis created for patient ${(_a = diagnosis.patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName}: ${diagnosisName}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'DIAGNOSIS', diagnosis.id.toString());
                // Send notification to patient
                yield notification_service_1.NotificationService.notifyDiagnosisAdded(diagnosis.id, patientId, doctorId, diagnosisName);
                res.status(201).json({
                    success: true,
                    message: 'Diagnosis created successfully',
                    data: diagnosis
                });
            }
            catch (error) {
                console.error('Error creating diagnosis:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create diagnosis',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get diagnoses for a specific patient
    getPatientDiagnoses(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const patientId = req.params.patientId;
                // Verify patient exists
                const patient = yield prisma.user.findUnique({
                    where: { id: patientId },
                    include: { patientInfo: true }
                });
                if (!patient || patient.role !== 'PATIENT') {
                    res.status(404).json({
                        success: false,
                        message: 'Patient not found'
                    });
                    return;
                }
                // Check access permissions
                if (userRole === 'PATIENT' && userId !== patientId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view your own diagnoses'
                    });
                    return;
                }
                // Get diagnoses
                const diagnoses = yield prisma.diagnosis.findMany({
                    where: { patientId },
                    include: {
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    },
                    orderBy: { diagnosedAt: 'desc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Diagnoses retrieved successfully',
                    data: diagnoses
                });
            }
            catch (error) {
                console.error('Error getting patient diagnoses:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get diagnoses by a specific doctor
    getDoctorDiagnoses(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                // Get diagnoses
                const diagnoses = yield prisma.diagnosis.findMany({
                    where: { doctorId },
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        consultation: true
                    },
                    orderBy: { diagnosedAt: 'desc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Diagnoses retrieved successfully',
                    data: diagnoses
                });
            }
            catch (error) {
                console.error('Error getting doctor diagnoses:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Update diagnosis
    updateDiagnosis(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                const diagnosisId = req.params.diagnosisId;
                const { diagnosisCode, diagnosisName, description, severity, status, onsetDate, resolvedAt, notes, isPrimary } = req.body;
                // Verify diagnosis exists and doctor owns it
                const existingDiagnosis = yield prisma.diagnosis.findFirst({
                    where: { id: diagnosisId, doctorId }
                });
                if (!existingDiagnosis) {
                    res.status(404).json({
                        success: false,
                        message: 'Diagnosis not found or access denied'
                    });
                    return;
                }
                // Update diagnosis
                const diagnosis = yield prisma.diagnosis.update({
                    where: { id: diagnosisId },
                    data: {
                        diagnosisCode: diagnosisCode !== undefined ? diagnosisCode : existingDiagnosis.diagnosisCode,
                        diagnosisName: diagnosisName || existingDiagnosis.diagnosisName,
                        description: description !== undefined ? description : existingDiagnosis.description,
                        severity: severity || existingDiagnosis.severity,
                        status: status || existingDiagnosis.status,
                        onsetDate: onsetDate ? new Date(onsetDate) : existingDiagnosis.onsetDate,
                        resolvedAt: resolvedAt ? new Date(resolvedAt) : existingDiagnosis.resolvedAt,
                        notes: notes !== undefined ? notes : existingDiagnosis.notes,
                        isPrimary: isPrimary !== undefined ? isPrimary : existingDiagnosis.isPrimary
                    },
                    include: {
                        patient: {
                            select: {
                                id: true,
                                email: true,
                                patientInfo: { select: { fullName: true } }
                            }
                        },
                        doctor: {
                            select: {
                                id: true,
                                email: true,
                                doctorInfo: { select: { firstName: true, lastName: true } }
                            }
                        },
                        consultation: {
                            select: {
                                id: true,
                                consultationCode: true
                            }
                        }
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'UPDATE_DIAGNOSIS', 'DATA_MODIFICATION', `Diagnosis updated: ${diagnosisName}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'DIAGNOSIS', diagnosis.id.toString());
                res.status(200).json({
                    success: true,
                    message: 'Diagnosis updated successfully',
                    data: diagnosis
                });
            }
            catch (error) {
                console.error('Error updating diagnosis:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update diagnosis',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Delete diagnosis
    deleteDiagnosis(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                const diagnosisId = req.params.diagnosisId;
                // Verify diagnosis exists and doctor owns it
                const existingDiagnosis = yield prisma.diagnosis.findFirst({
                    where: { id: diagnosisId, doctorId }
                });
                if (!existingDiagnosis) {
                    res.status(404).json({
                        success: false,
                        message: 'Diagnosis not found or access denied'
                    });
                    return;
                }
                // Delete diagnosis
                yield prisma.diagnosis.delete({
                    where: { id: diagnosisId }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'DELETE_DIAGNOSIS', 'DATA_MODIFICATION', `Diagnosis deleted: ${existingDiagnosis.diagnosisName}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'DIAGNOSIS', diagnosisId.toString());
                res.status(200).json({
                    success: true,
                    message: 'Diagnosis deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting diagnosis:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete diagnosis',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
}
exports.DiagnosesController = DiagnosesController;
