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
exports.PrescriptionsController = void 0;
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../shared/services/audit.service");
const prisma = new client_1.PrismaClient();
class PrescriptionsController {
    // Get available patients for prescription (doctors only)
    getAvailablePatients(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                // Get all patients with their basic info
                const patients = yield prisma.user.findMany({
                    where: { role: 'PATIENT' },
                    include: {
                        patientInfo: {
                            select: {
                                fullName: true,
                                contactNumber: true,
                                bloodType: true
                            }
                        }
                    },
                    orderBy: { id: 'asc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Available patients retrieved successfully',
                    data: patients.map(patient => {
                        var _a, _b, _c;
                        return ({
                            id: patient.id,
                            email: patient.email,
                            fullName: ((_a = patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown',
                            contactNumber: ((_b = patient.patientInfo) === null || _b === void 0 ? void 0 : _b.contactNumber) || '',
                            bloodType: ((_c = patient.patientInfo) === null || _c === void 0 ? void 0 : _c.bloodType) || '',
                            createdAt: patient.createdAt
                        });
                    })
                });
            }
            catch (error) {
                console.error('Error getting available patients:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get patient info by user ID (for doctor-meet component)
    getPatientInfoByUserId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = parseInt(req.params.userId);
                const doctorId = req.user.id;
                if (isNaN(userId)) {
                    res.status(400).json({
                        success: false,
                        message: 'Invalid user ID'
                    });
                    return;
                }
                // Get patient info by user ID
                const patientInfo = yield prisma.patientInfo.findFirst({
                    where: { userId: userId }
                });
                if (!patientInfo) {
                    res.status(404).json({
                        success: false,
                        message: 'Patient not found'
                    });
                    return;
                }
                res.status(200).json({
                    success: true,
                    message: 'Patient info retrieved successfully',
                    data: patientInfo
                });
            }
            catch (error) {
                console.error('Error getting patient info:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Create a new prescription
    createPrescription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                const { patientId, consultationId, medicationName, dosage, frequency, duration, instructions, quantity, refills = 0, expiresAt, notes } = req.body;
                // Validate required fields
                if (!patientId || !medicationName || !dosage || !frequency || !duration) {
                    res.status(400).json({
                        success: false,
                        message: 'Missing required fields: patientId, medicationName, dosage, frequency, duration'
                    });
                    return;
                }
                // Verify patient exists
                const patient = yield prisma.user.findUnique({
                    where: { id: parseInt(patientId) },
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
                        where: { id: parseInt(consultationId) }
                    });
                    if (!consultation) {
                        res.status(404).json({
                            success: false,
                            message: 'Consultation not found'
                        });
                        return;
                    }
                }
                // Create prescription
                const prescription = yield prisma.prescription.create({
                    data: {
                        patientId: parseInt(patientId),
                        doctorId,
                        consultationId: consultationId ? parseInt(consultationId) : null,
                        medicationName,
                        dosage,
                        frequency,
                        duration,
                        instructions,
                        quantity: quantity ? parseInt(quantity) : null,
                        refills: parseInt(refills),
                        expiresAt: expiresAt ? new Date(expiresAt) : null,
                        notes
                    },
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    }
                });
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'CREATE_PRESCRIPTION', 'DATA_MODIFICATION', `Doctor created prescription for patient ${patientId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'PRESCRIPTION', prescription.id.toString(), {
                    medicationName,
                    patientId: parseInt(patientId),
                    consultationId: consultationId ? parseInt(consultationId) : null
                });
                res.status(201).json({
                    success: true,
                    message: 'Prescription created successfully',
                    data: prescription
                });
            }
            catch (error) {
                console.error('Error creating prescription:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get prescriptions for a specific patient
    getPatientPrescriptions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const patientId = parseInt(req.params.patientId);
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
                        message: 'Access denied: You can only view your own prescriptions'
                    });
                    return;
                }
                // Get prescriptions
                const prescriptions = yield prisma.prescription.findMany({
                    where: { patientId },
                    include: {
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    },
                    orderBy: { prescribedAt: 'desc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Prescriptions retrieved successfully',
                    data: prescriptions
                });
            }
            catch (error) {
                console.error('Error getting patient prescriptions:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get prescriptions by a specific doctor
    getDoctorPrescriptions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const doctorId = parseInt(req.params.doctorId);
                // Verify doctor exists
                const doctor = yield prisma.user.findUnique({
                    where: { id: doctorId },
                    include: { doctorInfo: true }
                });
                if (!doctor || doctor.role !== 'DOCTOR') {
                    res.status(404).json({
                        success: false,
                        message: 'Doctor not found'
                    });
                    return;
                }
                // Check access permissions
                if (userId !== doctorId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view your own prescriptions'
                    });
                    return;
                }
                // Get prescriptions
                const prescriptions = yield prisma.prescription.findMany({
                    where: { doctorId },
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        consultation: true
                    },
                    orderBy: { prescribedAt: 'desc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Prescriptions retrieved successfully',
                    data: prescriptions
                });
            }
            catch (error) {
                console.error('Error getting doctor prescriptions:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get prescription by ID
    getPrescriptionById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const prescriptionId = parseInt(req.params.id);
                // Get prescription
                const prescription = yield prisma.prescription.findUnique({
                    where: { id: prescriptionId },
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    }
                });
                if (!prescription) {
                    res.status(404).json({
                        success: false,
                        message: 'Prescription not found'
                    });
                    return;
                }
                // Check access permissions
                if (userRole === 'PATIENT' && prescription.patientId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view your own prescriptions'
                    });
                    return;
                }
                if (userRole === 'DOCTOR' && prescription.doctorId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view prescriptions you created'
                    });
                    return;
                }
                res.status(200).json({
                    success: true,
                    message: 'Prescription retrieved successfully',
                    data: prescription
                });
            }
            catch (error) {
                console.error('Error getting prescription:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Update prescription
    updatePrescription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                const prescriptionId = parseInt(req.params.id);
                const updateData = req.body;
                // Get existing prescription
                const existingPrescription = yield prisma.prescription.findUnique({
                    where: { id: prescriptionId }
                });
                if (!existingPrescription) {
                    res.status(404).json({
                        success: false,
                        message: 'Prescription not found'
                    });
                    return;
                }
                // Check if doctor owns this prescription
                if (existingPrescription.doctorId !== doctorId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only update prescriptions you created'
                    });
                    return;
                }
                // Prepare update data
                const updateFields = {};
                if (updateData.medicationName)
                    updateFields.medicationName = updateData.medicationName;
                if (updateData.dosage)
                    updateFields.dosage = updateData.dosage;
                if (updateData.frequency)
                    updateFields.frequency = updateData.frequency;
                if (updateData.duration)
                    updateFields.duration = updateData.duration;
                if (updateData.instructions !== undefined)
                    updateFields.instructions = updateData.instructions;
                if (updateData.quantity !== undefined)
                    updateFields.quantity = updateData.quantity ? parseInt(updateData.quantity) : null;
                if (updateData.refills !== undefined)
                    updateFields.refills = parseInt(updateData.refills);
                if (updateData.expiresAt !== undefined)
                    updateFields.expiresAt = updateData.expiresAt ? new Date(updateData.expiresAt) : null;
                if (updateData.notes !== undefined)
                    updateFields.notes = updateData.notes;
                if (updateData.isActive !== undefined)
                    updateFields.isActive = updateData.isActive;
                // Update prescription
                const updatedPrescription = yield prisma.prescription.update({
                    where: { id: prescriptionId },
                    data: updateFields,
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    }
                });
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'UPDATE_PRESCRIPTION', 'DATA_MODIFICATION', `Doctor updated prescription ${prescriptionId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'PRESCRIPTION', prescriptionId.toString(), updateFields);
                res.status(200).json({
                    success: true,
                    message: 'Prescription updated successfully',
                    data: updatedPrescription
                });
            }
            catch (error) {
                console.error('Error updating prescription:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Delete prescription
    deletePrescription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctorId = req.user.id;
                const prescriptionId = parseInt(req.params.id);
                // Get existing prescription
                const existingPrescription = yield prisma.prescription.findUnique({
                    where: { id: prescriptionId }
                });
                if (!existingPrescription) {
                    res.status(404).json({
                        success: false,
                        message: 'Prescription not found'
                    });
                    return;
                }
                // Check if doctor owns this prescription
                if (existingPrescription.doctorId !== doctorId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only delete prescriptions you created'
                    });
                    return;
                }
                // Delete prescription
                yield prisma.prescription.delete({
                    where: { id: prescriptionId }
                });
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'DELETE_PRESCRIPTION', 'DATA_MODIFICATION', `Doctor deleted prescription ${prescriptionId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'PRESCRIPTION', prescriptionId.toString(), {
                    medicationName: existingPrescription.medicationName,
                    patientId: existingPrescription.patientId
                });
                res.status(200).json({
                    success: true,
                    message: 'Prescription deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting prescription:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
    // Get prescriptions for a consultation
    getConsultationPrescriptions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const consultationId = parseInt(req.params.consultationId);
                // Get consultation
                const consultation = yield prisma.consultation.findUnique({
                    where: { id: consultationId },
                    include: {
                        doctor: true,
                        patient: true
                    }
                });
                if (!consultation) {
                    res.status(404).json({
                        success: false,
                        message: 'Consultation not found'
                    });
                    return;
                }
                // Check access permissions
                if (userRole === 'PATIENT' && consultation.patientId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view prescriptions from your own consultations'
                    });
                    return;
                }
                if (userRole === 'DOCTOR' && consultation.doctorId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied: You can only view prescriptions from your own consultations'
                    });
                    return;
                }
                // Get prescriptions for consultation
                const prescriptions = yield prisma.prescription.findMany({
                    where: { consultationId },
                    include: {
                        patient: {
                            include: { patientInfo: true }
                        },
                        doctor: {
                            include: { doctorInfo: true }
                        },
                        consultation: true
                    },
                    orderBy: { prescribedAt: 'desc' }
                });
                res.status(200).json({
                    success: true,
                    message: 'Consultation prescriptions retrieved successfully',
                    data: prescriptions
                });
            }
            catch (error) {
                console.error('Error getting consultation prescriptions:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error : undefined
                });
            }
        });
    }
}
exports.PrescriptionsController = PrescriptionsController;
exports.default = PrescriptionsController;
