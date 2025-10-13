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
exports.OrganizationsController = void 0;
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const prisma = new client_1.PrismaClient();
class OrganizationsController {
    // Get all organizations (with optional filtering)
    getOrganizations(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const { activeOnly } = req.query;
                // Build where clause based on query parameters
                const whereClause = activeOnly === 'true' ? { isActive: true } : {};
                const organizations = yield prisma.organization.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true,
                        _count: {
                            select: {
                                users: {
                                    where: { role: 'DOCTOR' }
                                }
                            }
                        }
                    },
                    orderBy: { name: 'asc' }
                });
                // Transform the data to include doctorCount and patientCount
                const transformedOrganizations = organizations.map(org => (Object.assign(Object.assign({}, org), { doctorCount: org._count.users, patientCount: 0 // We'll calculate this separately if needed
                 })));
                // Audit log for successful access
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('LIST_ORGANIZATIONS', userId, 'ORGANIZATION', 'list', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    activeOnly: activeOnly,
                    totalOrganizations: transformedOrganizations.length,
                    userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                    auditDescription: `Listed ${transformedOrganizations.length} organizations`
                });
                res.json({
                    success: true,
                    data: transformedOrganizations
                });
            }
            catch (error) {
                console.error('Error fetching organizations:', error);
                // Audit log for failure
                try {
                    const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous';
                    const { activeOnly } = req.query;
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATIONS_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch organizations: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        activeOnly: activeOnly,
                        userRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch organizations',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get organization by ID
    getOrganizationById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            try {
                const { id } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                const organization = yield prisma.organization.findFirst({
                    where: { id, isActive: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true
                    }
                });
                if (!organization) {
                    // Audit log for organization not found
                    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_NOT_FOUND', client_1.AuditLevel.WARNING, `Organization not found: ${id}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        requestedOrganizationId: id,
                        userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role
                    });
                    return res.status(404).json({
                        success: false,
                        message: 'Organization not found'
                    });
                }
                // Audit log for successful access
                const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('VIEW_ORGANIZATION', userId, 'ORGANIZATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: id,
                    organizationName: organization.name,
                    organizationEmail: organization.email,
                    userRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                    auditDescription: `Viewed organization: ${organization.name}`
                });
                res.json({
                    success: true,
                    data: organization
                });
            }
            catch (error) {
                console.error('Error fetching organization:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const userId = ((_e = req.user) === null || _e === void 0 ? void 0 : _e.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch organization: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationId: id,
                        userRole: (_f = req.user) === null || _f === void 0 ? void 0 : _f.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch organization',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get doctors by organization
    getDoctorsByOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const { organizationId } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(organizationId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                const doctors = yield prisma.user.findMany({
                    where: {
                        role: 'DOCTOR',
                        organizationId: organizationId
                    },
                    select: {
                        id: true,
                        email: true,
                        doctorInfo: {
                            select: {
                                firstName: true,
                                lastName: true,
                                specialization: true
                            }
                        }
                    },
                    orderBy: [
                        { doctorInfo: { firstName: 'asc' } },
                        { doctorInfo: { lastName: 'asc' } }
                    ]
                });
                const formattedDoctors = doctors.map(doctor => {
                    var _a;
                    return ({
                        id: doctor.id,
                        name: doctor.doctorInfo
                            ? `Dr. ${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                            : doctor.email,
                        specialization: ((_a = doctor.doctorInfo) === null || _a === void 0 ? void 0 : _a.specialization) || 'General Practice',
                        organizationId: organizationId
                    });
                });
                // Audit log for successful access
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('VIEW_DOCTORS_BY_ORGANIZATION', userId, 'ORGANIZATION', organizationId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: organizationId,
                    doctorCount: formattedDoctors.length,
                    userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                    auditDescription: `Viewed ${formattedDoctors.length} doctors for organization ${organizationId}`
                });
                res.json({
                    success: true,
                    data: formattedDoctors
                });
            }
            catch (error) {
                console.error('Error fetching doctors by organization:', error);
                // Audit log for failure
                try {
                    const { organizationId } = req.params;
                    const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('DOCTORS_BY_ORGANIZATION_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch doctors by organization: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationId: organizationId,
                        userRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch doctors',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Create new organization
    createOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { name, description, address, phone, email, website } = req.body;
                // Validate required fields
                if (!name) {
                    return res.status(400).json({
                        success: false,
                        message: 'Organization name is required'
                    });
                }
                // Check if organization with same name already exists
                const existingOrg = yield prisma.organization.findFirst({
                    where: { name: name.trim() }
                });
                if (existingOrg) {
                    return res.status(409).json({
                        success: false,
                        message: 'Organization with this name already exists'
                    });
                }
                const organization = yield prisma.organization.create({
                    data: {
                        name: name.trim(),
                        description: description === null || description === void 0 ? void 0 : description.trim(),
                        address: address === null || address === void 0 ? void 0 : address.trim(),
                        phone: phone === null || phone === void 0 ? void 0 : phone.trim(),
                        email: email === null || email === void 0 ? void 0 : email.trim(),
                        website: website === null || website === void 0 ? void 0 : website.trim(),
                        isActive: true
                    },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });
                // Audit log for successful creation
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('CREATE', userId, 'ORGANIZATION', organization.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: organization.id,
                    organizationName: organization.name,
                    organizationDescription: organization.description,
                    organizationAddress: organization.address,
                    organizationPhone: organization.phone,
                    organizationEmail: organization.email,
                    organizationWebsite: organization.website,
                    isActive: organization.isActive,
                    createdBy: userId,
                    auditDescription: `Organization created: ${organization.name}`
                });
                res.status(201).json({
                    success: true,
                    data: organization,
                    message: 'Organization created successfully'
                });
            }
            catch (error) {
                console.error('Error creating organization:', error);
                // Audit log for failure
                try {
                    const { name, description, address, phone, email, website } = req.body;
                    const userId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_CREATION_FAILED', client_1.AuditLevel.ERROR, `Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationName: name,
                        organizationDescription: description,
                        organizationAddress: address,
                        organizationPhone: phone,
                        organizationEmail: email,
                        organizationWebsite: website,
                        createdBy: userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to create organization',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Update organization
    updateOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { id } = req.params;
                const { name, description, address, phone, email, website, isActive } = req.body;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                // Check if organization exists
                const existingOrg = yield prisma.organization.findUnique({
                    where: { id }
                });
                if (!existingOrg) {
                    return res.status(404).json({
                        success: false,
                        message: 'Organization not found'
                    });
                }
                // Check if name is being changed and if new name already exists
                if (name && name.trim() !== existingOrg.name) {
                    const nameExists = yield prisma.organization.findFirst({
                        where: {
                            name: name.trim(),
                            id: { not: id }
                        }
                    });
                    if (nameExists) {
                        return res.status(409).json({
                            success: false,
                            message: 'Organization with this name already exists'
                        });
                    }
                }
                const organization = yield prisma.organization.update({
                    where: { id },
                    data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (name && { name: name.trim() })), (description !== undefined && { description: description === null || description === void 0 ? void 0 : description.trim() })), (address !== undefined && { address: address === null || address === void 0 ? void 0 : address.trim() })), (phone !== undefined && { phone: phone === null || phone === void 0 ? void 0 : phone.trim() })), (email !== undefined && { email: email === null || email === void 0 ? void 0 : email.trim() })), (website !== undefined && { website: website === null || website === void 0 ? void 0 : website.trim() })), (isActive !== undefined && { isActive })),
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });
                // Audit log for successful update
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('UPDATE', userId, 'ORGANIZATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: id,
                    organizationName: organization.name,
                    oldOrganizationName: existingOrg.name,
                    oldOrganizationDescription: existingOrg.description,
                    newOrganizationDescription: organization.description,
                    oldOrganizationAddress: existingOrg.address,
                    newOrganizationAddress: organization.address,
                    oldOrganizationPhone: existingOrg.phone,
                    newOrganizationPhone: organization.phone,
                    oldOrganizationEmail: existingOrg.email,
                    newOrganizationEmail: organization.email,
                    oldOrganizationWebsite: existingOrg.website,
                    newOrganizationWebsite: organization.website,
                    oldIsActive: existingOrg.isActive,
                    newIsActive: organization.isActive,
                    updatedBy: userId,
                    auditDescription: `Organization updated: ${organization.name}`
                });
                res.json({
                    success: true,
                    data: organization,
                    message: 'Organization updated successfully'
                });
            }
            catch (error) {
                console.error('Error updating organization:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const { name, description, address, phone, email, website, isActive } = req.body;
                    const userId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_UPDATE_FAILED', client_1.AuditLevel.ERROR, `Failed to update organization: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationId: id,
                        organizationName: name,
                        organizationDescription: description,
                        organizationAddress: address,
                        organizationPhone: phone,
                        organizationEmail: email,
                        organizationWebsite: website,
                        isActive: isActive,
                        updatedBy: userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to update organization',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Delete organization
    deleteOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { id } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                // Check if organization exists
                const existingOrg = yield prisma.organization.findUnique({
                    where: { id }
                });
                if (!existingOrg) {
                    return res.status(404).json({
                        success: false,
                        message: 'Organization not found'
                    });
                }
                // Check if organization has users
                const userCount = yield prisma.user.count({
                    where: { organizationId: id }
                });
                if (userCount > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot delete organization with existing users. Please reassign or remove users first.'
                    });
                }
                yield prisma.organization.delete({
                    where: { id }
                });
                // Audit log for successful deletion
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('DELETE', userId, 'ORGANIZATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: id,
                    organizationName: existingOrg.name,
                    organizationDescription: existingOrg.description,
                    organizationAddress: existingOrg.address,
                    organizationPhone: existingOrg.phone,
                    organizationEmail: existingOrg.email,
                    organizationWebsite: existingOrg.website,
                    isActive: existingOrg.isActive,
                    createdAt: existingOrg.createdAt,
                    deletedBy: userId,
                    deletedAt: new Date(),
                    auditDescription: `Organization deleted: ${existingOrg.name}`
                });
                res.json({
                    success: true,
                    message: 'Organization deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting organization:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const userId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_DELETE_FAILED', client_1.AuditLevel.ERROR, `Failed to delete organization: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationId: id,
                        deletedBy: userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete organization',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Toggle organization status
    toggleOrganizationStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { id } = req.params;
                const { isActive } = req.body;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                // Check if organization exists
                const existingOrg = yield prisma.organization.findUnique({
                    where: { id }
                });
                if (!existingOrg) {
                    return res.status(404).json({
                        success: false,
                        message: 'Organization not found'
                    });
                }
                const organization = yield prisma.organization.update({
                    where: { id },
                    data: { isActive },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });
                // Audit log for successful status change
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
                yield audit_service_1.AuditService.logDataModification('UPDATE', userId, 'ORGANIZATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    organizationId: id,
                    organizationName: organization.name,
                    oldIsActive: existingOrg.isActive,
                    newIsActive: organization.isActive,
                    statusChange: isActive ? 'ACTIVATED' : 'DEACTIVATED',
                    updatedBy: userId,
                    auditDescription: `Organization ${isActive ? 'activated' : 'deactivated'}: ${organization.name}`
                });
                res.json({
                    success: true,
                    data: organization,
                    message: `Organization ${isActive ? 'activated' : 'deactivated'} successfully`
                });
            }
            catch (error) {
                console.error('Error toggling organization status:', error);
                // Audit log for failure
                try {
                    const { id } = req.params;
                    const { isActive } = req.body;
                    const userId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'system';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_STATUS_TOGGLE_FAILED', client_1.AuditLevel.ERROR, `Failed to toggle organization status: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        organizationId: id,
                        isActive: isActive,
                        updatedBy: userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to toggle organization status',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get organization statistics
    getOrganizationStatistics(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // Get total organizations
                const totalOrganizations = yield prisma.organization.count();
                // Get active organizations
                const activeOrganizations = yield prisma.organization.count({
                    where: { isActive: true }
                });
                // Get total doctors across all organizations
                const totalDoctors = yield prisma.user.count({
                    where: { role: 'DOCTOR' }
                });
                // Get total patients
                const totalPatients = yield prisma.user.count({
                    where: { role: 'PATIENT' }
                });
                // Audit log for successful access
                const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                yield audit_service_1.AuditService.logDataAccess('VIEW_ORGANIZATION_STATISTICS', userId, 'ORGANIZATION', 'statistics', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    totalOrganizations: totalOrganizations,
                    activeOrganizations: activeOrganizations,
                    totalDoctors: totalDoctors,
                    totalPatients: totalPatients,
                    userRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                    auditDescription: `Viewed organization statistics: ${totalOrganizations} total, ${activeOrganizations} active`
                });
                res.json({
                    success: true,
                    data: {
                        totalOrganizations,
                        activeOrganizations,
                        totalDoctors,
                        totalPatients
                    }
                });
            }
            catch (error) {
                console.error('Error fetching organization statistics:', error);
                // Audit log for failure
                try {
                    const userId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous';
                    yield audit_service_1.AuditService.logSecurityEvent('ORGANIZATION_STATISTICS_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch organization statistics: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        userRole: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch organization statistics',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
}
exports.OrganizationsController = OrganizationsController;
