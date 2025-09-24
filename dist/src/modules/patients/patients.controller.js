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
exports.PatientsController = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const security_config_1 = require("../../config/security.config");
const auth_service_1 = require("../../shared/services/auth.service");
const prisma = new client_1.PrismaClient();
class PatientsController {
    // GET /patients
    listPatients(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = Math.max(parseInt(req.query.page || '1', 10), 1);
                const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
                const skip = (page - 1) * limit;
                const search = (req.query.search || '').trim();
                const { organizationId } = req.query;
                const whereUser = { role: client_1.Role.PATIENT };
                if (organizationId) {
                    whereUser.organizationId = organizationId;
                }
                if (search) {
                    whereUser.OR = [
                        { email: { contains: search, mode: 'insensitive' } },
                        { patientInfo: { fullName: { contains: search, mode: 'insensitive' } } },
                        { patientInfo: { contactNumber: { contains: search, mode: 'insensitive' } } },
                        { patientInfo: { philHealthId: { contains: search, mode: 'insensitive' } } },
                    ];
                }
                const [total, users] = yield Promise.all([
                    prisma.user.count({ where: whereUser }),
                    prisma.user.findMany({
                        where: whereUser,
                        select: {
                            id: true,
                            email: true,
                            organizationId: true,
                            organization: { select: { id: true, name: true } },
                            patientInfo: {
                                select: {
                                    fullName: true,
                                    gender: true,
                                    dateOfBirth: true,
                                    contactNumber: true,
                                    address: true,
                                    bloodType: true,
                                    philHealthId: true,
                                    philHealthStatus: true,
                                    philHealthIdVerified: true,
                                },
                            },
                        },
                        orderBy: [
                            { patientInfo: { fullName: 'asc' } },
                        ],
                        skip,
                        take: limit,
                    }),
                ]);
                res.json({
                    success: true,
                    data: {
                        items: users,
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit) || 1,
                    },
                });
            }
            catch (error) {
                console.error('Error listing patients:', error);
                res.status(500).json({ success: false, message: 'Failed to list patients' });
            }
        });
    }
    // GET /patients/:id
    getPatientById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const patient = yield prisma.user.findFirst({
                    where: { id, role: client_1.Role.PATIENT },
                    select: {
                        id: true,
                        email: true,
                        organizationId: true,
                        organization: { select: { id: true, name: true } },
                        patientInfo: {
                            include: {
                                emergencyContact: true,
                                insuranceInfo: true,
                            },
                        },
                        emergencyContacts: true,
                        insuranceInfos: true,
                    },
                });
                if (!patient) {
                    return res.status(404).json({ success: false, message: 'Patient not found' });
                }
                res.json({ success: true, data: patient });
            }
            catch (error) {
                console.error('Error fetching patient:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch patient' });
            }
        });
    }
    // POST /patients
    createPatient(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, organizationId, fullName, gender, dateOfBirth, contactNumber, address, weight, height, bloodType, medicalHistory, allergies, medications, philHealthId, philHealthStatus, philHealthCategory, philHealthExpiry, philHealthMemberSince, 
                // Emergency contact
                emergencyContactName, emergencyContactRelationship, emergencyContactNumber, emergencyContactAddress, 
                // Insurance info
                insuranceProviderName, insurancePolicyNumber, insuranceContact, } = req.body || {};
                if (!email || !password || !fullName || !gender || !dateOfBirth || !contactNumber || !address || !bloodType) {
                    return res.status(400).json({ success: false, message: 'Missing required fields' });
                }
                // Validate password strength consistently with AuthService
                if (!auth_service_1.AuthService.validatePasswordStrength(password)) {
                    return res.status(400).json({ success: false, message: 'Password does not meet security requirements' });
                }
                // Basic email uniqueness check
                const existing = yield prisma.user.findUnique({ where: { email: email.toLowerCase() } });
                if (existing) {
                    return res.status(409).json({ success: false, message: 'Email already in use' });
                }
                // Hash password
                const passwordHash = yield (0, bcryptjs_1.hash)(password, security_config_1.securityConfig.password.saltRounds);
                const user = yield prisma.user.create({
                    data: Object.assign(Object.assign({ email: email.toLowerCase(), password: passwordHash, role: client_1.Role.PATIENT, organizationId: organizationId || null, patientInfo: {
                            create: {
                                fullName,
                                gender: gender,
                                dateOfBirth: new Date(dateOfBirth),
                                contactNumber,
                                address,
                                weight: Number(weight) || 0,
                                height: Number(height) || 0,
                                bloodType,
                                medicalHistory: medicalHistory || '',
                                allergies: allergies || '',
                                medications: medications || '',
                                philHealthId: philHealthId || null,
                                philHealthStatus: philHealthStatus || null,
                                philHealthCategory: philHealthCategory || null,
                                philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null,
                                philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null,
                            },
                        } }, (emergencyContactName && emergencyContactNumber && {
                        emergencyContacts: {
                            create: {
                                contactName: emergencyContactName,
                                relationship: emergencyContactRelationship || 'Family',
                                contactNumber: emergencyContactNumber,
                                contactAddress: emergencyContactAddress || null,
                            },
                        },
                    })), (insuranceProviderName && insurancePolicyNumber && insuranceContact && {
                        insuranceInfos: {
                            create: {
                                providerName: insuranceProviderName,
                                policyNumber: insurancePolicyNumber,
                                insuranceContact,
                            },
                        },
                    })),
                    select: { id: true, email: true, organizationId: true },
                });
                res.status(201).json({ success: true, data: user, message: 'Patient created successfully' });
            }
            catch (error) {
                console.error('Error creating patient:', error);
                const message = (error === null || error === void 0 ? void 0 : error.message) || 'Failed to create patient';
                // Handle Prisma unique constraint errors gracefully
                if (message.includes('Unique constraint') || message.includes('Unique constraint failed')) {
                    return res.status(409).json({ success: false, message: 'Email already exists' });
                }
                res.status(500).json({ success: false, message });
            }
        });
    }
    // PUT /patients/:id
    updatePatient(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { organizationId, fullName, gender, dateOfBirth, contactNumber, address, weight, height, bloodType, medicalHistory, allergies, medications, philHealthId, philHealthStatus, philHealthCategory, philHealthExpiry, philHealthMemberSince, 
                // Emergency contact
                emergencyContactName, emergencyContactRelationship, emergencyContactNumber, emergencyContactAddress, 
                // Insurance info
                insuranceProviderName, insurancePolicyNumber, insuranceContact, } = req.body || {};
                const user = yield prisma.user.findFirst({ where: { id, role: client_1.Role.PATIENT }, select: { id: true } });
                if (!user)
                    return res.status(404).json({ success: false, message: 'Patient not found' });
                const updated = yield prisma.user.update({
                    where: { id },
                    data: Object.assign(Object.assign({ organizationId: organizationId !== null && organizationId !== void 0 ? organizationId : undefined, patientInfo: {
                            upsert: {
                                create: {
                                    fullName: fullName || 'Patient',
                                    gender: gender || client_1.Sex.OTHER,
                                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
                                    contactNumber: contactNumber || '',
                                    address: address || '',
                                    weight: Number(weight) || 0,
                                    height: Number(height) || 0,
                                    bloodType: bloodType || 'O+',
                                    medicalHistory: medicalHistory || '',
                                    allergies: allergies || '',
                                    medications: medications || '',
                                    philHealthId: philHealthId || null,
                                    philHealthStatus: philHealthStatus || null,
                                    philHealthCategory: philHealthCategory || null,
                                    philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null,
                                    philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null,
                                },
                                update: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (fullName !== undefined && { fullName })), (gender !== undefined && { gender: gender })), (dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) })), (contactNumber !== undefined && { contactNumber })), (address !== undefined && { address })), (weight !== undefined && { weight: Number(weight) })), (height !== undefined && { height: Number(height) })), (bloodType !== undefined && { bloodType })), (medicalHistory !== undefined && { medicalHistory })), (allergies !== undefined && { allergies })), (medications !== undefined && { medications })), (philHealthId !== undefined && { philHealthId })), (philHealthStatus !== undefined && { philHealthStatus })), (philHealthCategory !== undefined && { philHealthCategory })), (philHealthExpiry !== undefined && { philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null })), (philHealthMemberSince !== undefined && { philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null })),
                            },
                        } }, (emergencyContactName && emergencyContactNumber && {
                        emergencyContacts: {
                            upsert: {
                                create: {
                                    contactName: emergencyContactName,
                                    relationship: emergencyContactRelationship || 'Family',
                                    contactNumber: emergencyContactNumber,
                                    contactAddress: emergencyContactAddress || null,
                                },
                                update: {
                                    contactName: emergencyContactName,
                                    relationship: emergencyContactRelationship || 'Family',
                                    contactNumber: emergencyContactNumber,
                                    contactAddress: emergencyContactAddress || null,
                                },
                            },
                        },
                    })), (insuranceProviderName && insurancePolicyNumber && insuranceContact && {
                        insuranceInfos: {
                            upsert: {
                                create: {
                                    providerName: insuranceProviderName,
                                    policyNumber: insurancePolicyNumber,
                                    insuranceContact,
                                },
                                update: {
                                    providerName: insuranceProviderName,
                                    policyNumber: insurancePolicyNumber,
                                    insuranceContact,
                                },
                            },
                        },
                    })),
                    select: { id: true },
                });
                res.json({ success: true, data: updated, message: 'Patient updated successfully' });
            }
            catch (error) {
                console.error('Error updating patient:', error);
                res.status(500).json({ success: false, message: 'Failed to update patient' });
            }
        });
    }
    // DELETE /patients/:id
    deletePatient(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const user = yield prisma.user.findFirst({ where: { id, role: client_1.Role.PATIENT }, select: { id: true } });
                if (!user)
                    return res.status(404).json({ success: false, message: 'Patient not found' });
                // Clean up related records with safe order
                yield prisma.$transaction([
                    prisma.consultation.deleteMany({ where: { patientId: id } }),
                    prisma.appointmentRequest.deleteMany({ where: { patientId: id } }),
                    prisma.prescription.deleteMany({ where: { patientId: id } }),
                    prisma.diagnosis.deleteMany({ where: { patientId: id } }),
                    prisma.patientMedicalHistory.deleteMany({ where: { patientId: id } }),
                    // prisma.labRequest.deleteMany({ where: { patientId: id } }),
                    prisma.emergencyContact.deleteMany({ where: { patientId: id } }),
                    prisma.insuranceInfo.deleteMany({ where: { patientId: id } }),
                    prisma.patientInfo.deleteMany({ where: { userId: id } }),
                    prisma.user.delete({ where: { id } }),
                ]);
                res.json({ success: true, message: 'Patient deleted successfully' });
            }
            catch (error) {
                console.error('Error deleting patient:', error);
                res.status(500).json({ success: false, message: 'Failed to delete patient' });
            }
        });
    }
    // GET /patients/:id/medical-history
    getPatientMedicalHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const page = Math.max(parseInt(req.query.page || '1', 10), 1);
                const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
                const skip = (page - 1) * limit;
                const patient = yield prisma.user.findFirst({ where: { id, role: client_1.Role.PATIENT }, select: { id: true } });
                if (!patient)
                    return res.status(404).json({ success: false, message: 'Patient not found' });
                const [total, medicalHistory] = yield Promise.all([
                    prisma.patientMedicalHistory.count({ where: { patientId: id } }),
                    prisma.patientMedicalHistory.findMany({
                        where: { patientId: id },
                        include: {
                            consultation: {
                                select: {
                                    id: true,
                                    consultationCode: true,
                                    startTime: true,
                                    doctor: {
                                        select: {
                                            id: true,
                                            doctorInfo: {
                                                select: {
                                                    firstName: true,
                                                    lastName: true,
                                                    specialization: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            creator: {
                                select: {
                                    id: true,
                                    role: true,
                                    doctorInfo: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                        },
                                    },
                                },
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                        skip,
                        take: limit,
                    }),
                ]);
                res.json({
                    success: true,
                    data: {
                        items: medicalHistory,
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit) || 1,
                    },
                });
            }
            catch (error) {
                console.error('Error fetching patient medical history:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch patient medical history' });
            }
        });
    }
    // GET /patients/:id/appointments
    getPatientAppointments(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const page = Math.max(parseInt(req.query.page || '1', 10), 1);
                const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
                const skip = (page - 1) * limit;
                const patient = yield prisma.user.findFirst({ where: { id, role: client_1.Role.PATIENT }, select: { id: true } });
                if (!patient)
                    return res.status(404).json({ success: false, message: 'Patient not found' });
                const [total, appointments] = yield Promise.all([
                    prisma.appointmentRequest.count({ where: { patientId: id } }),
                    prisma.appointmentRequest.findMany({
                        where: { patientId: id },
                        include: {
                            doctor: {
                                select: {
                                    id: true,
                                    doctorInfo: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            specialization: true,
                                        },
                                    },
                                },
                            },
                            consultation: {
                                select: {
                                    id: true,
                                    consultationCode: true,
                                    startTime: true,
                                    endTime: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                        skip,
                        take: limit,
                    }),
                ]);
                res.json({
                    success: true,
                    data: {
                        items: appointments,
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit) || 1,
                    },
                });
            }
            catch (error) {
                console.error('Error fetching patient appointments:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch patient appointments' });
            }
        });
    }
}
exports.PatientsController = PatientsController;
