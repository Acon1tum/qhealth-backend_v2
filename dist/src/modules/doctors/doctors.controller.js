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
const audit_service_1 = require("../audit/audit.service");
const prisma = new client_1.PrismaClient();
class DoctorsController {
    // GET /doctors
    listDoctors(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
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
                // Audit log for successful access
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('LIST_DOCTORS', userId, 'DOCTOR', 'list', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    page: page,
                    limit: limit,
                    search: search,
                    organizationId: organizationId,
                    totalResults: total,
                    userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                    auditDescription: `Listed ${total} doctors (page ${page}/${Math.ceil(total / limit) || 1})`
                });
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
                // Audit log for failure
                try {
                    const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous';
                    const { page, limit, search, organizationId } = req.query;
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTORS_LIST_FAILED', client_1.AuditLevel.ERROR, `Failed to list doctors: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        page: page,
                        limit: limit,
                        search: search,
                        organizationId: organizationId,
                        userRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({ success: false, message: 'Failed to list doctors' });
            }
        });
    }
    // GET /doctors/:id
    getDoctorById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
                    // Audit log for doctor not found
                    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_NOT_FOUND', client_1.AuditLevel.WARNING, `Doctor not found: ${id}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        requestedDoctorId: id,
                        userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                        organizationId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.organizationId
                    });
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                }
                // Audit log for successful access
                const userId = ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('VIEW_DOCTOR', userId, 'DOCTOR', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    doctorId: id,
                    doctorEmail: doctor.email,
                    doctorName: `${(_e = doctor.doctorInfo) === null || _e === void 0 ? void 0 : _e.firstName} ${(_f = doctor.doctorInfo) === null || _f === void 0 ? void 0 : _f.lastName}`,
                    specialization: (_g = doctor.doctorInfo) === null || _g === void 0 ? void 0 : _g.specialization,
                    organizationId: doctor.organizationId,
                    organizationName: (_h = doctor.organization) === null || _h === void 0 ? void 0 : _h.name,
                    userRole: (_j = req.user) === null || _j === void 0 ? void 0 : _j.role,
                    auditDescription: `Viewed doctor profile: ${doctor.email}`
                });
                res.json({ success: true, data: doctor });
            }
            catch (error) {
                console.error('Error fetching doctor:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const userId = ((_k = req.user) === null || _k === void 0 ? void 0 : _k.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch doctor: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        doctorId: id,
                        userRole: (_l = req.user) === null || _l === void 0 ? void 0 : _l.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
            }
        });
    }
    // POST /doctors
    createDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
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
                // Audit log for successful creation
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('CREATE', userId, 'DOCTOR', user.id.toString(), req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    doctorId: user.id,
                    email: email,
                    organizationId: finalOrganizationId,
                    firstName: firstName,
                    middleName: middleName,
                    lastName: lastName,
                    specialization: specialization,
                    qualifications: qualifications,
                    experience: experience,
                    contactNumber: contactNumber,
                    address: address,
                    bio: bio,
                    createdBy: userId,
                    createdByRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                    auditDescription: `Doctor created: ${email}`
                });
                res.status(201).json({ success: true, data: user, message: 'Doctor created successfully' });
            }
            catch (error) {
                console.error('Error creating doctor:', error);
                // Audit log for failure
                try {
                    const { email, organizationId, firstName, middleName, lastName, specialization, qualifications, experience, contactNumber, address, bio } = req.body || {};
                    const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_CREATION_FAILED', client_1.AuditLevel.ERROR, `Failed to create doctor: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        email: email,
                        organizationId: organizationId,
                        firstName: firstName,
                        lastName: lastName,
                        specialization: specialization,
                        experience: experience,
                        createdBy: userId,
                        createdByRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
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
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            try {
                const { id } = req.params;
                const { organizationId, firstName, middleName, lastName, specialization, qualifications, experience, contactNumber, address, bio, } = req.body || {};
                const whereClause = { id, role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereClause.organizationId = req.user.organizationId;
                }
                const user = yield prisma.user.findFirst({
                    where: whereClause,
                    select: {
                        id: true,
                        email: true,
                        organizationId: true,
                        doctorInfo: {
                            select: {
                                firstName: true,
                                middleName: true,
                                lastName: true,
                                specialization: true,
                                qualifications: true,
                                experience: true,
                                contactNumber: true,
                                address: true,
                                bio: true
                            }
                        }
                    }
                });
                if (!user) {
                    // Audit log for doctor not found
                    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_UPDATE_NOT_FOUND', client_1.AuditLevel.WARNING, `Doctor not found for update: ${id}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        requestedDoctorId: id,
                        userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                        organizationId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.organizationId
                    });
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                }
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
                // Audit log for successful update
                const userId = ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('UPDATE', userId, 'DOCTOR', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    doctorId: id,
                    doctorEmail: user.email,
                    oldOrganizationId: user.organizationId,
                    newOrganizationId: organizationId,
                    oldFirstName: (_e = user.doctorInfo) === null || _e === void 0 ? void 0 : _e.firstName,
                    newFirstName: firstName,
                    oldMiddleName: (_f = user.doctorInfo) === null || _f === void 0 ? void 0 : _f.middleName,
                    newMiddleName: middleName,
                    oldLastName: (_g = user.doctorInfo) === null || _g === void 0 ? void 0 : _g.lastName,
                    newLastName: lastName,
                    oldSpecialization: (_h = user.doctorInfo) === null || _h === void 0 ? void 0 : _h.specialization,
                    newSpecialization: specialization,
                    oldQualifications: (_j = user.doctorInfo) === null || _j === void 0 ? void 0 : _j.qualifications,
                    newQualifications: qualifications,
                    oldExperience: (_k = user.doctorInfo) === null || _k === void 0 ? void 0 : _k.experience,
                    newExperience: experience,
                    oldContactNumber: (_l = user.doctorInfo) === null || _l === void 0 ? void 0 : _l.contactNumber,
                    newContactNumber: contactNumber,
                    oldAddress: (_m = user.doctorInfo) === null || _m === void 0 ? void 0 : _m.address,
                    newAddress: address,
                    oldBio: (_o = user.doctorInfo) === null || _o === void 0 ? void 0 : _o.bio,
                    newBio: bio,
                    updatedBy: userId,
                    updatedByRole: (_p = req.user) === null || _p === void 0 ? void 0 : _p.role,
                    auditDescription: `Doctor updated: ${user.email}`
                });
                res.json({ success: true, data: updated, message: 'Doctor updated successfully' });
            }
            catch (error) {
                console.error('Error updating doctor:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const { organizationId, firstName, middleName, lastName, specialization, qualifications, experience, contactNumber, address, bio } = req.body || {};
                    const userId = ((_q = req.user) === null || _q === void 0 ? void 0 : _q.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_UPDATE_FAILED', client_1.AuditLevel.ERROR, `Failed to update doctor: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        doctorId: id,
                        organizationId: organizationId,
                        firstName: firstName,
                        lastName: lastName,
                        specialization: specialization,
                        experience: experience,
                        updatedBy: userId,
                        updatedByRole: (_r = req.user) === null || _r === void 0 ? void 0 : _r.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({ success: false, message: 'Failed to update doctor' });
            }
        });
    }
    // DELETE /doctors/:id
    deleteDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            try {
                const { id } = req.params;
                const whereClause = { id, role: client_1.Role.DOCTOR };
                // If user is admin, filter by their organization
                if (req.user && req.user.role === client_1.Role.ADMIN) {
                    whereClause.organizationId = req.user.organizationId;
                }
                const user = yield prisma.user.findFirst({
                    where: whereClause,
                    select: {
                        id: true,
                        email: true,
                        organizationId: true,
                        doctorInfo: {
                            select: {
                                firstName: true,
                                middleName: true,
                                lastName: true,
                                specialization: true,
                                qualifications: true,
                                experience: true,
                                contactNumber: true,
                                address: true,
                                bio: true
                            }
                        }
                    }
                });
                if (!user) {
                    // Audit log for doctor not found
                    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_DELETE_NOT_FOUND', client_1.AuditLevel.WARNING, `Doctor not found for deletion: ${id}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        requestedDoctorId: id,
                        userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                        organizationId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.organizationId
                    });
                    return res.status(404).json({ success: false, message: 'Doctor not found' });
                }
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
                // Audit log for successful deletion
                const userId = ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('DELETE', userId, 'DOCTOR', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    doctorId: id,
                    doctorEmail: user.email,
                    organizationId: user.organizationId,
                    firstName: (_e = user.doctorInfo) === null || _e === void 0 ? void 0 : _e.firstName,
                    middleName: (_f = user.doctorInfo) === null || _f === void 0 ? void 0 : _f.middleName,
                    lastName: (_g = user.doctorInfo) === null || _g === void 0 ? void 0 : _g.lastName,
                    specialization: (_h = user.doctorInfo) === null || _h === void 0 ? void 0 : _h.specialization,
                    qualifications: (_j = user.doctorInfo) === null || _j === void 0 ? void 0 : _j.qualifications,
                    experience: (_k = user.doctorInfo) === null || _k === void 0 ? void 0 : _k.experience,
                    contactNumber: (_l = user.doctorInfo) === null || _l === void 0 ? void 0 : _l.contactNumber,
                    address: (_m = user.doctorInfo) === null || _m === void 0 ? void 0 : _m.address,
                    bio: (_o = user.doctorInfo) === null || _o === void 0 ? void 0 : _o.bio,
                    deletedAt: new Date(),
                    deletedBy: userId,
                    deletedByRole: (_p = req.user) === null || _p === void 0 ? void 0 : _p.role,
                    relatedRecordsDeleted: {
                        consultations: true,
                        appointments: true,
                        prescriptions: true,
                        diagnoses: true,
                        schedules: true,
                        doctorInfo: true
                    },
                    auditDescription: `Doctor deleted: ${user.email}`
                });
                res.json({ success: true, message: 'Doctor deleted successfully' });
            }
            catch (error) {
                console.error('Error deleting doctor:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const userId = ((_q = req.user) === null || _q === void 0 ? void 0 : _q.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTOR_DELETE_FAILED', client_1.AuditLevel.ERROR, `Failed to delete doctor: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        doctorId: id,
                        deletedBy: userId,
                        deletedByRole: (_r = req.user) === null || _r === void 0 ? void 0 : _r.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({ success: false, message: 'Failed to delete doctor' });
            }
        });
    }
}
exports.DoctorsController = DoctorsController;
