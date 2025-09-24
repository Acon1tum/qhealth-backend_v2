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
exports.DoctorsController = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const security_config_1 = require("../../config/security.config");
const auth_service_1 = require("../../shared/services/auth.service");
const prisma = new client_1.PrismaClient();
class DoctorsController {
    // GET /doctors
    listDoctors(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = Math.max(parseInt(req.query.page || '1', 10), 1);
                const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
                const skip = (page - 1) * limit;
                const search = (req.query.search || '').trim();
                const { organizationId } = req.query;
                const whereUser = { role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereUser.organizationId = req.user.organizationId;
                }
                else if (organizationId) {
                    // Only allow organizationId filter for super admin or when no user is authenticated
                    whereUser.organizationId = organizationId;
                }
                if (search) {
                    whereUser.OR = [
                        { email: { contains: search, mode: 'insensitive' } },
                        { doctorInfo: { firstName: { contains: search, mode: 'insensitive' } } },
                        { doctorInfo: { lastName: { contains: search, mode: 'insensitive' } } },
                        { doctorInfo: { specialization: { contains: search, mode: 'insensitive' } } },
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
                            doctorInfo: {
                                select: {
                                    firstName: true,
                                    middleName: true,
                                    lastName: true,
                                    specialization: true,
                                    qualifications: true,
                                    experience: true,
                                    contactNumber: true,
                                },
                            },
                        },
                        orderBy: [
                            { doctorInfo: { lastName: 'asc' } },
                            { doctorInfo: { firstName: 'asc' } },
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
                console.error('Error listing doctors:', error);
                res.status(500).json({ success: false, message: 'Failed to list doctors' });
            }
        });
    }
    // GET /doctors/:id
    getDoctorById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const whereClause = { id, role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereClause.organizationId = req.user.organizationId;
                }
                const doctor = yield prisma.user.findFirst({
                    where: whereClause,
                    select: {
                        id: true,
                        email: true,
                        organizationId: true,
                        organization: { select: { id: true, name: true } },
                        doctorInfo: true,
                        doctorSchedules: true,
                    },
                });
                if (!doctor) {
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                }
                res.json({ success: true, data: doctor });
            }
            catch (error) {
                console.error('Error fetching doctor:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
            }
        });
    }
    // POST /doctors
    createDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, organizationId, firstName, middleName, lastName, specialization, qualifications, experience, contactNumber, address, bio, } = req.body || {};
                if (!email || !password || !firstName || !lastName || !specialization || experience === undefined) {
                    return res.status(400).json({ success: false, message: 'Missing required fields' });
                }
                // If user is admin, they can only create doctors in their organization
                let finalOrganizationId = organizationId;
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    finalOrganizationId = req.user.organizationId;
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
                    data: {
                        email: email.toLowerCase(),
                        password: passwordHash,
                        role: client_1.Role.DOCTOR,
                        organizationId: finalOrganizationId || null,
                        doctorInfo: {
                            create: {
                                firstName,
                                middleName: middleName || null,
                                lastName,
                                gender: 'OTHER',
                                dateOfBirth: new Date('1990-01-01'),
                                contactNumber: contactNumber || '',
                                address: address || '',
                                bio: bio || '',
                                specialization,
                                qualifications,
                                experience: Number(experience) || 0,
                            },
                        },
                    },
                    select: { id: true, email: true, organizationId: true },
                });
                res.status(201).json({ success: true, data: user, message: 'Doctor created successfully' });
            }
            catch (error) {
                console.error('Error creating doctor:', error);
                const message = (error === null || error === void 0 ? void 0 : error.message) || 'Failed to create doctor';
                // Handle Prisma unique constraint errors gracefully
                if (message.includes('Unique constraint') || message.includes('Unique constraint failed')) {
                    return res.status(409).json({ success: false, message: 'Email already exists' });
                }
                res.status(500).json({ success: false, message });
            }
        });
    }
    // PUT /doctors/:id
    updateDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { organizationId, firstName, middleName, lastName, specialization, qualifications, experience, contactNumber, address, bio, } = req.body || {};
                const whereClause = { id, role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereClause.organizationId = req.user.organizationId;
                }
                const user = yield prisma.user.findFirst({ where: whereClause, select: { id: true } });
                if (!user)
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                // If user is admin, they cannot change the organization
                const updateData = {};
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    // Admin cannot change organization, so we don't include organizationId in update
                }
                else {
                    updateData.organizationId = organizationId !== null && organizationId !== void 0 ? organizationId : undefined;
                }
                const updated = yield prisma.user.update({
                    where: { id },
                    data: Object.assign(Object.assign({}, updateData), { doctorInfo: {
                            upsert: {
                                create: {
                                    firstName: firstName || 'Doctor',
                                    middleName: middleName || null,
                                    lastName: lastName || 'User',
                                    gender: 'OTHER',
                                    dateOfBirth: new Date('1990-01-01'),
                                    contactNumber: contactNumber || '',
                                    address: address || '',
                                    bio: bio || '',
                                    specialization: specialization || 'General Practice',
                                    qualifications: qualifications || '',
                                    experience: Number(experience) || 0,
                                },
                                update: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (firstName !== undefined && { firstName })), (middleName !== undefined && { middleName })), (lastName !== undefined && { lastName })), (specialization !== undefined && { specialization })), (qualifications !== undefined && { qualifications })), (experience !== undefined && { experience: Number(experience) })), (contactNumber !== undefined && { contactNumber })), (address !== undefined && { address })), (bio !== undefined && { bio })),
                            },
                        } }),
                    select: { id: true },
                });
                res.json({ success: true, data: updated, message: 'Doctor updated successfully' });
            }
            catch (error) {
                console.error('Error updating doctor:', error);
                res.status(500).json({ success: false, message: 'Failed to update doctor' });
            }
        });
    }
    // DELETE /doctors/:id
    deleteDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const whereClause = { id, role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereClause.organizationId = req.user.organizationId;
                }
                const user = yield prisma.user.findFirst({ where: whereClause, select: { id: true } });
                if (!user)
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                // Clean up related records with safe order
                yield prisma.$transaction([
                    prisma.consultation.deleteMany({ where: { doctorId: id } }),
                    prisma.appointmentRequest.deleteMany({ where: { doctorId: id } }),
                    prisma.prescription.deleteMany({ where: { doctorId: id } }),
                    prisma.diagnosis.deleteMany({ where: { doctorId: id } }),
                    prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
                    prisma.doctorInfo.deleteMany({ where: { userId: id } }),
                    prisma.user.delete({ where: { id } }),
                ]);
                res.json({ success: true, message: 'Doctor deleted successfully' });
            }
            catch (error) {
                console.error('Error deleting doctor:', error);
                res.status(500).json({ success: false, message: 'Failed to delete doctor' });
            }
        });
    }
}
exports.DoctorsController = DoctorsController;
