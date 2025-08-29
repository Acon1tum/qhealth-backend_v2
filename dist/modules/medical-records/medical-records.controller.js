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
exports.MedicalRecordsController = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const audit_service_1 = require("../../shared/services/audit.service");
const prisma = new client_1.PrismaClient();
class MedicalRecordsController {
    // Create medical record
    createMedicalRecord(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { patientId, consultationId, recordType, title, content, isPublic, isSensitive } = req.body;
                const userId = req.user.id;
                const userRole = req.user.role;
                // Verify permissions
                if (userRole === client_2.Role.PATIENT && userId !== patientId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Patients can only create records for themselves'
                    });
                }
                if (userRole === client_2.Role.DOCTOR) {
                    // Check if doctor has access to this patient
                    const hasAccess = yield this.checkDoctorAccess(userId, patientId);
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'You do not have access to this patient'
                        });
                    }
                }
                // Create medical record
                const medicalRecord = yield prisma.patientMedicalHistory.create({
                    data: {
                        patientId,
                        consultationId,
                        recordType,
                        title,
                        content,
                        isPublic: isPublic || false,
                        isSensitive: isSensitive || false,
                        createdBy: userId
                    },
                    include: {
                        patient: {
                            select: {
                                id: true,
                                email: true,
                                patientInfo: { select: { fullName: true } }
                            }
                        },
                        creator: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                                doctorInfo: { select: { firstName: true, lastName: true } }
                            }
                        }
                    }
                });
                // Create default privacy settings
                yield this.createDefaultPrivacySettings(medicalRecord.id);
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'CREATE_MEDICAL_RECORD', 'DATA_MODIFICATION', `Medical record created for patient ${(_a = medicalRecord.patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'MEDICAL_RECORD', medicalRecord.id.toString());
                res.status(201).json({
                    success: true,
                    message: 'Medical record created successfully',
                    data: medicalRecord
                });
            }
            catch (error) {
                console.error('Error creating medical record:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create medical record',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get patient medical records
    getPatientMedicalRecords(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { patientId } = req.params;
                const userId = req.user.id;
                const userRole = req.user.role;
                const { recordType, isPublic, page = 1, limit = 10 } = req.query;
                // Verify permissions
                if (userRole === client_2.Role.PATIENT && userId !== Number(patientId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only view your own medical records'
                    });
                }
                if (userRole === client_2.Role.DOCTOR) {
                    // Check if doctor has access to this patient
                    const hasAccess = yield this.checkDoctorAccess(userId, Number(patientId));
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'You do not have access to this patient'
                        });
                    }
                }
                let whereClause = { patientId: Number(patientId) };
                if (recordType) {
                    whereClause.recordType = recordType;
                }
                if (isPublic !== undefined) {
                    whereClause.isPublic = isPublic === 'true';
                }
                // If doctor, check what they can see based on privacy settings
                if (userRole === client_2.Role.DOCTOR) {
                    whereClause.OR = [
                        { isPublic: true },
                        {
                            privacySettings: {
                                some: {
                                    settingType: 'PUBLIC_READ',
                                    isEnabled: true
                                }
                            }
                        }
                    ];
                }
                const skip = (Number(page) - 1) * Number(limit);
                const [records, total] = yield Promise.all([
                    prisma.patientMedicalHistory.findMany({
                        where: whereClause,
                        include: {
                            creator: {
                                select: {
                                    id: true,
                                    email: true,
                                    role: true,
                                    doctorInfo: { select: { firstName: true, lastName: true } }
                                }
                            },
                            privacySettings: true
                        },
                        orderBy: { createdAt: 'desc' },
                        skip,
                        take: Number(limit)
                    }),
                    prisma.patientMedicalHistory.count({ where: whereClause })
                ]);
                res.json({
                    success: true,
                    data: records,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit))
                    }
                });
            }
            catch (error) {
                console.error('Error fetching medical records:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch medical records',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Update medical record
    updateMedicalRecord(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { recordId } = req.params;
                const { title, content, isPublic, isSensitive } = req.body;
                const userId = req.user.id;
                // Get medical record
                const medicalRecord = yield prisma.patientMedicalHistory.findFirst({
                    where: { id: Number(recordId) },
                    include: { creator: true }
                });
                if (!medicalRecord) {
                    return res.status(404).json({
                        success: false,
                        message: 'Medical record not found'
                    });
                }
                // Verify permissions
                if (medicalRecord.createdBy !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only update records you created'
                    });
                }
                // Update medical record
                const updatedRecord = yield prisma.patientMedicalHistory.update({
                    where: { id: Number(recordId) },
                    data: {
                        title,
                        content,
                        isPublic,
                        isSensitive,
                        updatedAt: new Date()
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_MEDICAL_RECORD', 'DATA_MODIFICATION', `Medical record ${recordId} updated`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'MEDICAL_RECORD', recordId);
                res.json({
                    success: true,
                    message: 'Medical record updated successfully',
                    data: updatedRecord
                });
            }
            catch (error) {
                console.error('Error updating medical record:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update medical record',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Update privacy settings
    updatePrivacySettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { recordId } = req.params;
                const { privacySettings } = req.body;
                const userId = req.user.id;
                // Get medical record
                const medicalRecord = yield prisma.patientMedicalHistory.findFirst({
                    where: { id: Number(recordId) },
                    include: { patient: true }
                });
                if (!medicalRecord) {
                    return res.status(404).json({
                        success: false,
                        message: 'Medical record not found'
                    });
                }
                // Verify permissions (patient or creator)
                if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to update privacy settings'
                    });
                }
                // Update privacy settings
                for (const setting of privacySettings) {
                    yield prisma.medicalRecordPrivacy.upsert({
                        where: {
                            medicalRecordId_settingType: {
                                medicalRecordId: Number(recordId),
                                settingType: setting.settingType
                            }
                        },
                        update: {
                            isEnabled: setting.isEnabled
                        },
                        create: {
                            medicalRecordId: Number(recordId),
                            settingType: setting.settingType,
                            isEnabled: setting.isEnabled
                        }
                    });
                }
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_PRIVACY_SETTINGS', 'DATA_MODIFICATION', `Privacy settings updated for medical record ${recordId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'MEDICAL_RECORD', recordId);
                res.json({
                    success: true,
                    message: 'Privacy settings updated successfully'
                });
            }
            catch (error) {
                console.error('Error updating privacy settings:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update privacy settings',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Share medical record with specific doctor
    shareMedicalRecord(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { recordId } = req.params;
                const { doctorId, accessLevel, expiresAt } = req.body;
                const userId = req.user.id;
                // Get medical record
                const medicalRecord = yield prisma.patientMedicalHistory.findFirst({
                    where: { id: Number(recordId) },
                    include: { patient: true }
                });
                if (!medicalRecord) {
                    return res.status(404).json({
                        success: false,
                        message: 'Medical record not found'
                    });
                }
                // Verify permissions (patient or creator)
                if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to share this record'
                    });
                }
                // Verify doctor exists
                const doctor = yield prisma.user.findFirst({
                    where: { id: doctorId, role: client_2.Role.DOCTOR }
                });
                if (!doctor) {
                    return res.status(404).json({
                        success: false,
                        message: 'Doctor not found'
                    });
                }
                // Create sharing record
                const sharing = yield prisma.consultationSharing.create({
                    data: {
                        consultationId: medicalRecord.consultationId || 0,
                        sharedWithDoctorId: doctorId,
                        accessLevel: accessLevel || client_2.AccessLevel.READ_ONLY,
                        sharedBy: userId,
                        expiresAt: expiresAt ? new Date(expiresAt) : null
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'SHARE_MEDICAL_RECORD', 'DATA_ACCESS', `Medical record ${recordId} shared with doctor ${doctorId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'MEDICAL_RECORD', recordId);
                res.status(201).json({
                    success: true,
                    message: 'Medical record shared successfully',
                    data: sharing
                });
            }
            catch (error) {
                console.error('Error sharing medical record:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to share medical record',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Delete medical record
    deleteMedicalRecord(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { recordId } = req.params;
                const userId = req.user.id;
                // Get medical record
                const medicalRecord = yield prisma.patientMedicalHistory.findFirst({
                    where: { id: Number(recordId) }
                });
                if (!medicalRecord) {
                    return res.status(404).json({
                        success: false,
                        message: 'Medical record not found'
                    });
                }
                // Verify permissions (patient or creator)
                if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to delete this record'
                    });
                }
                // Delete medical record (cascade will handle related records)
                yield prisma.patientMedicalHistory.delete({
                    where: { id: Number(recordId) }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'DELETE_MEDICAL_RECORD', 'DATA_MODIFICATION', `Medical record ${recordId} deleted`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'MEDICAL_RECORD', recordId);
                res.json({
                    success: true,
                    message: 'Medical record deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting medical record:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete medical record',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Private method to check doctor access
    checkDoctorAccess(doctorId, patientId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if doctor has any consultation with this patient
            const consultation = yield prisma.consultation.findFirst({
                where: {
                    doctorId,
                    patientId
                }
            });
            if (consultation)
                return true;
            // Check if doctor has been shared any consultations with this patient
            const sharedConsultation = yield prisma.consultationSharing.findFirst({
                where: {
                    sharedWithDoctorId: doctorId,
                    consultation: {
                        patientId
                    }
                }
            });
            return !!sharedConsultation;
        });
    }
    // Private method to create default privacy settings
    createDefaultPrivacySettings(recordId) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultSettings = [
                { settingType: client_2.PrivacySettingType.PUBLIC_READ, isEnabled: false },
                { settingType: client_2.PrivacySettingType.SHARED_SPECIFIC, isEnabled: true },
                { settingType: client_2.PrivacySettingType.PATIENT_APPROVED, isEnabled: true }
            ];
            for (const setting of defaultSettings) {
                yield prisma.medicalRecordPrivacy.create({
                    data: {
                        medicalRecordId: recordId,
                        settingType: setting.settingType,
                        isEnabled: setting.isEnabled
                    }
                });
            }
        });
    }
}
exports.MedicalRecordsController = MedicalRecordsController;
