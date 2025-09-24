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
exports.LabRequestsController = void 0;
const client_1 = require("@prisma/client");
const lab_requests_service_js_1 = require("./lab-requests.service.js");
const auth_service_1 = require("../../shared/services/auth.service");
const audit_service_1 = require("../../shared/services/audit.service");
const prisma = new client_1.PrismaClient();
const labRequestService = new lab_requests_service_js_1.LabRequestService();
const authService = new auth_service_1.AuthService();
const auditService = new audit_service_1.AuditService();
class LabRequestsController {
    // Get all lab requests with optional filtering
    getLabRequests(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { patientId, doctorId, organizationId, status, dateFrom, dateTo } = req.query;
                // Build filter object
                const filter = {};
                if (patientId)
                    filter.patientId = patientId;
                if (doctorId)
                    filter.doctorId = doctorId;
                if (organizationId)
                    filter.organizationId = organizationId;
                if (status)
                    filter.status = status;
                // Add date filtering
                if (dateFrom || dateTo) {
                    filter.requestedDate = {};
                    if (dateFrom)
                        filter.requestedDate.gte = new Date(dateFrom);
                    if (dateTo)
                        filter.requestedDate.lte = new Date(dateTo);
                }
                const labRequests = yield labRequestService.getLabRequests(filter);
                // Add display names for better frontend experience
                const labRequestsWithNames = yield Promise.all(labRequests.map((request) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const [patient, doctor, organization] = yield Promise.all([
                        prisma.user.findUnique({
                            where: { id: request.patientId },
                            include: { patientInfo: true }
                        }),
                        prisma.user.findUnique({
                            where: { id: request.doctorId },
                            include: { doctorInfo: true }
                        }),
                        prisma.organization.findUnique({
                            where: { id: request.organizationId }
                        })
                    ]);
                    return Object.assign(Object.assign({}, request), { patientName: ((_a = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Patient', doctorName: (doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo)
                            ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                            : 'Unknown Doctor', organizationName: (organization === null || organization === void 0 ? void 0 : organization.name) || 'Unknown Organization' });
                })));
                res.json(labRequestsWithNames);
            }
            catch (error) {
                console.error('Error fetching lab requests:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch lab requests',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get lab request by ID
    getLabRequestById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const labRequest = yield labRequestService.getLabRequestById(id);
                if (!labRequest) {
                    res.status(404).json({
                        success: false,
                        message: 'Lab request not found'
                    });
                    return;
                }
                // Add display names
                const [patient, doctor, organization] = yield Promise.all([
                    prisma.user.findUnique({
                        where: { id: labRequest.patientId },
                        include: { patientInfo: true }
                    }),
                    prisma.user.findUnique({
                        where: { id: labRequest.doctorId },
                        include: { doctorInfo: true }
                    }),
                    prisma.organization.findUnique({
                        where: { id: labRequest.organizationId }
                    })
                ]);
                const labRequestWithNames = Object.assign(Object.assign({}, labRequest), { patientName: ((_a = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Patient', doctorName: (doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo)
                        ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                        : 'Unknown Doctor', organizationName: (organization === null || organization === void 0 ? void 0 : organization.name) || 'Unknown Organization' });
                res.json(labRequestWithNames);
            }
            catch (error) {
                console.error('Error fetching lab request:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch lab request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Create new lab request
    createLabRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                console.log('🔍 Lab Request Controller - Received request:', req.body);
                console.log('🔍 Lab Request Controller - Headers:', req.headers);
                console.log('🔍 Lab Request Controller - Authorization header:', req.headers.authorization);
                console.log('🔍 Lab Request Controller - User:', req.user);
                const { patientId, doctorId, organizationId, consultationId, notes } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    console.error('❌ No user ID found in request');
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                // Validate required fields
                if (!patientId || !doctorId || !organizationId) {
                    console.error('❌ Missing required fields:', { patientId, doctorId, organizationId });
                    res.status(400).json({
                        success: false,
                        message: 'Patient ID, Doctor ID, and Organization ID are required'
                    });
                    return;
                }
                const labRequestData = {
                    patientId,
                    doctorId,
                    organizationId,
                    notes: notes || '',
                    status: 'PENDING',
                    createdBy: userId
                };
                console.log('🔍 Lab Request Controller - Sending data to service:', labRequestData);
                const labRequest = yield labRequestService.createLabRequest(labRequestData);
                console.log('✅ Lab Request Controller - Lab request created successfully:', labRequest.id);
                // Log audit event
                try {
                    yield audit_service_1.AuditService.logUserActivity(userId, 'CREATE_LAB_REQUEST', 'DATA_MODIFICATION', `Created lab request for patient ${patientId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'LAB_REQUEST', labRequest.id, { patientId, doctorId, organizationId });
                    console.log('✅ Audit log created successfully');
                }
                catch (auditError) {
                    console.error('⚠️ Failed to create audit log:', auditError);
                    // Don't fail the request if audit logging fails
                }
                res.status(201).json({
                    success: true,
                    message: 'Lab request created successfully',
                    data: labRequest
                });
            }
            catch (error) {
                console.error('❌ Error creating lab request:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create lab request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Update lab request
    updateLabRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const updateData = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                const labRequest = yield labRequestService.updateLabRequest(id, updateData);
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_LAB_REQUEST', 'DATA_MODIFICATION', `Updated lab request ${id}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'LAB_REQUEST', id, updateData);
                res.json({
                    success: true,
                    message: 'Lab request updated successfully',
                    data: labRequest
                });
            }
            catch (error) {
                console.error('Error updating lab request:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update lab request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Update lab request status
    updateLabRequestStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const { status, notes } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                if (!status) {
                    res.status(400).json({
                        success: false,
                        message: 'Status is required'
                    });
                    return;
                }
                const updateData = { status };
                // Set appropriate date based on status
                if (status === 'APPROVED') {
                    updateData.approvedDate = new Date();
                }
                else if (status === 'COMPLETED') {
                    updateData.completedDate = new Date();
                }
                if (notes) {
                    updateData.notes = notes;
                }
                const labRequest = yield labRequestService.updateLabRequest(id, updateData);
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_LAB_REQUEST_STATUS', 'DATA_MODIFICATION', `Updated lab request ${id} status to ${status}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'LAB_REQUEST', id, { status, notes });
                res.json({
                    success: true,
                    message: `Lab request ${status.toLowerCase()} successfully`,
                    data: labRequest
                });
            }
            catch (error) {
                console.error('Error updating lab request status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update lab request status',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Add test results to lab request
    addTestResults(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const { testResults, attachments } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                if (!testResults) {
                    res.status(400).json({
                        success: false,
                        message: 'Test results are required'
                    });
                    return;
                }
                const updateData = {
                    testResults,
                    status: 'COMPLETED',
                    completedDate: new Date()
                };
                if (attachments && Array.isArray(attachments)) {
                    updateData.attachments = attachments;
                }
                const labRequest = yield labRequestService.updateLabRequest(id, updateData);
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(userId, 'ADD_LAB_RESULTS', 'DATA_MODIFICATION', `Added test results to lab request ${id}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'LAB_REQUEST', id, {
                    hasResults: true,
                    attachmentsCount: (attachments === null || attachments === void 0 ? void 0 : attachments.length) || 0
                });
                res.json({
                    success: true,
                    message: 'Test results added successfully',
                    data: labRequest
                });
            }
            catch (error) {
                console.error('Error adding test results:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to add test results',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Delete lab request
    deleteLabRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                yield labRequestService.deleteLabRequest(id);
                // Log audit event
                yield audit_service_1.AuditService.logUserActivity(userId, 'DELETE_LAB_REQUEST', 'DATA_MODIFICATION', `Deleted lab request ${id}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'LAB_REQUEST', id);
                res.json({
                    success: true,
                    message: 'Lab request deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting lab request:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete lab request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get lab requests for specific patient
    getPatientLabRequests(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { patientId } = req.params;
                const labRequests = yield labRequestService.getLabRequests({ patientId });
                // Add display names
                const labRequestsWithNames = yield Promise.all(labRequests.map((request) => __awaiter(this, void 0, void 0, function* () {
                    const [doctor, organization] = yield Promise.all([
                        prisma.user.findUnique({
                            where: { id: request.doctorId },
                            include: { doctorInfo: true }
                        }),
                        prisma.organization.findUnique({
                            where: { id: request.organizationId }
                        })
                    ]);
                    return Object.assign(Object.assign({}, request), { doctorName: (doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo)
                            ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                            : 'Unknown Doctor', organizationName: (organization === null || organization === void 0 ? void 0 : organization.name) || 'Unknown Organization' });
                })));
                res.json(labRequestsWithNames);
            }
            catch (error) {
                console.error('Error fetching patient lab requests:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch patient lab requests',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get lab requests for specific doctor
    getDoctorLabRequests(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { doctorId } = req.params;
                const labRequests = yield labRequestService.getLabRequests({ doctorId });
                // Add display names
                const labRequestsWithNames = yield Promise.all(labRequests.map((request) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const [patient, organization] = yield Promise.all([
                        prisma.user.findUnique({
                            where: { id: request.patientId },
                            include: { patientInfo: true }
                        }),
                        prisma.organization.findUnique({
                            where: { id: request.organizationId }
                        })
                    ]);
                    return Object.assign(Object.assign({}, request), { patientName: ((_a = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Patient', organizationName: (organization === null || organization === void 0 ? void 0 : organization.name) || 'Unknown Organization' });
                })));
                res.json(labRequestsWithNames);
            }
            catch (error) {
                console.error('Error fetching doctor lab requests:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch doctor lab requests',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Export lab request as PDF
    exportLabRequestAsPDF(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const labRequest = yield labRequestService.getLabRequestById(id);
                if (!labRequest) {
                    res.status(404).json({
                        success: false,
                        message: 'Lab request not found'
                    });
                    return;
                }
                // For now, return a simple JSON response
                // In a real implementation, you would generate a PDF here
                res.json({
                    success: true,
                    message: 'PDF export functionality will be implemented',
                    data: labRequest
                });
            }
            catch (error) {
                console.error('Error exporting lab request PDF:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to export lab request PDF',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
}
exports.LabRequestsController = LabRequestsController;
