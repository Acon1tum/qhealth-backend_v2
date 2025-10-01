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
exports.LabRequestService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class LabRequestService {
    // Get all lab requests with optional filtering
    getLabRequests() {
        return __awaiter(this, arguments, void 0, function* (filter = {}) {
            try {
                const where = {};
                if (filter.patientId) {
                    where.patientId = filter.patientId;
                }
                if (filter.doctorId) {
                    where.doctorId = filter.doctorId;
                }
                if (filter.organizationId) {
                    where.organizationId = filter.organizationId;
                }
                if (filter.status) {
                    where.status = filter.status;
                }
                if (filter.dateFrom || filter.dateTo) {
                    where.createdAt = {};
                    if (filter.dateFrom) {
                        where.createdAt.gte = filter.dateFrom;
                    }
                    if (filter.dateTo) {
                        where.createdAt.lte = filter.dateTo;
                    }
                }
                const labRequests = yield prisma.labRequest.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc'
                    }
                });
                return labRequests;
            }
            catch (error) {
                console.error('Error fetching lab requests:', error);
                throw new Error('Failed to fetch lab requests');
            }
        });
    }
    // Get lab request by ID
    getLabRequestById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const labRequest = yield prisma.labRequest.findUnique({
                    where: { id }
                });
                return labRequest;
            }
            catch (error) {
                console.error('Error fetching lab request by ID:', error);
                throw new Error('Failed to fetch lab request');
            }
        });
    }
    // Create new lab request
    createLabRequest(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('🔍 Lab Request Service - Creating lab request with data:', data);
                // Validate required fields
                if (!data.patientId) {
                    throw new Error('Patient ID is required');
                }
                if (!data.doctorId) {
                    throw new Error('Doctor ID is required');
                }
                if (!data.organizationId) {
                    throw new Error('Organization ID is required');
                }
                if (!data.createdBy) {
                    throw new Error('CreatedBy is required');
                }
                // Validate that patient exists
                const patient = yield prisma.user.findUnique({
                    where: { id: data.patientId }
                });
                if (!patient) {
                    console.error('❌ Patient not found:', data.patientId);
                    throw new Error('Patient not found');
                }
                console.log('✅ Patient found:', patient.email);
                // Validate that doctor exists
                const doctor = yield prisma.user.findUnique({
                    where: { id: data.doctorId }
                });
                if (!doctor) {
                    console.error('❌ Doctor not found:', data.doctorId);
                    throw new Error('Doctor not found');
                }
                console.log('✅ Doctor found:', doctor.email);
                // Validate that organization exists
                const organization = yield prisma.organization.findUnique({
                    where: { id: data.organizationId }
                });
                if (!organization) {
                    console.error('❌ Organization not found:', data.organizationId);
                    throw new Error('Organization not found');
                }
                console.log('✅ Organization found:', organization.name);
                // Note: consultationId is not stored in the database schema
                // It's only used for context in the frontend
                const labRequestData = {
                    patientId: data.patientId,
                    doctorId: data.doctorId,
                    organizationId: data.organizationId,
                    note: data.notes || data.note || '', // Map notes to note field (singular)
                    status: data.status || 'PENDING',
                    priority: data.priority || 'NORMAL',
                    requestedTests: data.requestedTests || null,
                    instructions: data.instructions || null,
                    createdBy: data.createdBy, // Use the authenticated user ID
                    updatedBy: data.createdBy // Set updatedBy to the same as createdBy
                };
                console.log('🔍 Lab Request Service - Creating with data:', labRequestData);
                const labRequest = yield prisma.labRequest.create({
                    data: labRequestData
                });
                console.log('✅ Lab Request created successfully:', labRequest.id);
                console.log('✅ Lab Request data saved to database:', {
                    id: labRequest.id,
                    patientId: labRequest.patientId,
                    doctorId: labRequest.doctorId,
                    organizationId: labRequest.organizationId,
                    note: labRequest.note,
                    status: labRequest.status,
                    createdBy: labRequest.createdBy,
                    createdAt: labRequest.createdAt
                });
                return labRequest;
            }
            catch (error) {
                console.error('Error creating lab request:', error);
                throw new Error(error instanceof Error ? error.message : 'Failed to create lab request');
            }
        });
    }
    // Update lab request
    updateLabRequest(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if lab request exists
                const existingLabRequest = yield prisma.labRequest.findUnique({
                    where: { id }
                });
                if (!existingLabRequest) {
                    throw new Error('Lab request not found');
                }
                const labRequest = yield prisma.labRequest.update({
                    where: { id },
                    data: Object.assign(Object.assign({}, data), { updatedAt: new Date() })
                });
                return labRequest;
            }
            catch (error) {
                console.error('Error updating lab request:', error);
                throw new Error(error instanceof Error ? error.message : 'Failed to update lab request');
            }
        });
    }
    // Update lab request status
    updateLabRequestStatus(id, status, note) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updateData = { status };
                // Add note if provided
                if (note) {
                    updateData.note = note;
                }
                return yield this.updateLabRequest(id, updateData);
            }
            catch (error) {
                console.error('Error updating lab request status:', error);
                throw new Error(error instanceof Error ? error.message : 'Failed to update lab request status');
            }
        });
    }
    // Delete lab request
    deleteLabRequest(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if lab request exists
                const existingLabRequest = yield prisma.labRequest.findUnique({
                    where: { id }
                });
                if (!existingLabRequest) {
                    throw new Error('Lab request not found');
                }
                yield prisma.labRequest.delete({
                    where: { id }
                });
            }
            catch (error) {
                console.error('Error deleting lab request:', error);
                throw new Error(error instanceof Error ? error.message : 'Failed to delete lab request');
            }
        });
    }
    // Get lab requests for specific patient
    getPatientLabRequests(patientId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.getLabRequests({ patientId });
            }
            catch (error) {
                console.error('Error fetching patient lab requests:', error);
                throw new Error('Failed to fetch patient lab requests');
            }
        });
    }
    // Get lab requests for specific doctor
    getDoctorLabRequests(doctorId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.getLabRequests({ doctorId });
            }
            catch (error) {
                console.error('Error fetching doctor lab requests:', error);
                throw new Error('Failed to fetch doctor lab requests');
            }
        });
    }
    // Get lab request statistics
    getLabRequestStats(doctorId, patientId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {};
                if (doctorId)
                    where.doctorId = doctorId;
                if (patientId)
                    where.patientId = patientId;
                const [total, pending, approved, completed, rejected, cancelled] = yield Promise.all([
                    prisma.labRequest.count({ where }),
                    prisma.labRequest.count({ where: Object.assign(Object.assign({}, where), { status: 'PENDING' }) }),
                    prisma.labRequest.count({ where: Object.assign(Object.assign({}, where), { status: 'APPROVED' }) }),
                    prisma.labRequest.count({ where: Object.assign(Object.assign({}, where), { status: 'COMPLETED' }) }),
                    prisma.labRequest.count({ where: Object.assign(Object.assign({}, where), { status: 'REJECTED' }) }),
                    prisma.labRequest.count({ where: Object.assign(Object.assign({}, where), { status: 'CANCELLED' }) })
                ]);
                return {
                    total,
                    pending,
                    approved,
                    completed,
                    rejected,
                    cancelled
                };
            }
            catch (error) {
                console.error('Error fetching lab request stats:', error);
                throw new Error('Failed to fetch lab request statistics');
            }
        });
    }
}
exports.LabRequestService = LabRequestService;
