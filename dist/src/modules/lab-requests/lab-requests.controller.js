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
                    filter.createdAt = {};
                    if (dateFrom)
                        filter.createdAt.gte = new Date(dateFrom);
                    if (dateTo)
                        filter.createdAt.lte = new Date(dateTo);
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
                const { patientId, doctorId, organizationId, note, priority, requestedTests, instructions } = req.body;
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
                    note: note || '',
                    priority: priority || 'NORMAL',
                    status: 'PENDING',
                    createdBy: userId
                };
                // Add optional fields if provided
                if (requestedTests) {
                    labRequestData.requestedTests = requestedTests;
                }
                if (instructions) {
                    labRequestData.instructions = instructions;
                }
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
                // Add notes if provided
                if (notes) {
                    updateData.note = notes;
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
                // Get patient, doctor, and organization details
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
                // Generate HTML for PDF
                const html = this.generateLabRequestHTML(labRequest, patient, doctor, organization);
                // Set response headers for HTML
                res.setHeader('Content-Type', 'text/html');
                // Send HTML that will be opened in new window for print-to-PDF
                res.send(html);
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
    // Generate HTML template for lab request PDF
    generateLabRequestHTML(labRequest, patient, doctor, organization) {
        var _a, _b, _c, _d, _e, _f, _g;
        const patientName = ((_a = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Patient';
        const patientContact = ((_b = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _b === void 0 ? void 0 : _b.contactNumber) || '';
        const patientAge = ((_c = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _c === void 0 ? void 0 : _c.dateOfBirth)
            ? Math.floor((new Date().getTime() - new Date(patient.patientInfo.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : '';
        const patientGender = ((_d = patient === null || patient === void 0 ? void 0 : patient.patientInfo) === null || _d === void 0 ? void 0 : _d.gender) || '';
        const doctorName = (doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo)
            ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
            : 'Unknown Doctor';
        const doctorSpecialization = ((_e = doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo) === null || _e === void 0 ? void 0 : _e.specialization) || '';
        const doctorLicense = ((_f = doctor === null || doctor === void 0 ? void 0 : doctor.doctorInfo) === null || _f === void 0 ? void 0 : _f.licenseNumber) || '';
        const organizationName = (organization === null || organization === void 0 ? void 0 : organization.name) || 'Unknown Organization';
        const organizationAddress = (organization === null || organization === void 0 ? void 0 : organization.address) || '';
        const organizationContact = (organization === null || organization === void 0 ? void 0 : organization.phone) || '';
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Laboratory Request Form - ${labRequest.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 50px; 
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.6;
    }
    
    .document-header { 
      border: 2px solid #0066cc; 
      padding: 25px 30px; 
      margin-bottom: 35px;
      background: linear-gradient(to bottom, #f8fbff 0%, #ffffff 100%);
    }
    
    .logo-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .clinic-info h1 { 
      color: #0066cc; 
      font-size: 24px; 
      font-weight: 700;
      margin-bottom: 5px;
      letter-spacing: -0.5px;
    }
    
    .clinic-info p { 
      color: #666; 
      font-size: 11px; 
      margin: 2px 0;
    }
    
    .doc-type {
      text-align: right;
    }
    
    .doc-type h2 { 
      color: #0066cc; 
      font-size: 20px; 
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .doc-type .doc-id { 
      color: #666; 
      font-size: 10px; 
      font-family: 'Courier New', monospace;
    }
    
    .meta-info {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .meta-item {
      background: #ffffff;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    }
    
    .meta-item label { 
      font-size: 9px; 
      color: #666; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 3px;
    }
    
    .meta-item .value { 
      font-size: 11px; 
      color: #1a1a1a; 
      font-weight: 600;
    }
    
    .section { 
      margin-bottom: 25px; 
      page-break-inside: avoid;
    }
    
    .section-header { 
      background: #f0f4f8; 
      padding: 10px 15px; 
      margin-bottom: 15px;
      border-left: 4px solid #0066cc;
    }
    
    .section-header h3 { 
      font-size: 13px; 
      color: #0066cc; 
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    .info-table tr {
      border-bottom: 1px solid #f0f0f0;
    }
    
    .info-table td {
      padding: 10px 15px;
      font-size: 12px;
    }
    
    .info-table td:first-child {
      width: 180px;
      font-weight: 600;
      color: #555;
      background: #fafafa;
    }
    
    .info-table td:last-child {
      color: #1a1a1a;
    }
    
    .content-box { 
      background: #ffffff; 
      padding: 15px 20px; 
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.8;
      min-height: 60px;
      white-space: pre-wrap;
    }
    
    .status-badge { 
      display: inline-block; 
      padding: 5px 12px; 
      border-radius: 3px; 
      font-size: 10px; 
      font-weight: 700; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .status-in-progress { background: #cfe2ff; color: #084298; border: 1px solid #0d6efd; }
    .status-completed { background: #d1e7dd; color: #0f5132; border: 1px solid #198754; }
    .status-rejected { background: #f8d7da; color: #842029; border: 1px solid #dc3545; }
    .status-cancelled { background: #e9ecef; color: #495057; border: 1px solid #6c757d; }
    .status-on-hold { background: #ffe5d0; color: #cc5500; border: 1px solid #fd7e14; }
    
    .priority-high { color: #dc3545; font-weight: 700; }
    .priority-urgent { color: #dc3545; font-weight: 700; text-decoration: underline; }
    .priority-normal { color: #0066cc; }
    .priority-low { color: #6c757d; }
    
    .signature-section {
      margin-top: 50px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    
    .signature-box {
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fafafa;
    }
    
    .signature-box label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      display: block;
      margin-bottom: 40px;
    }
    
    .signature-line {
      border-top: 2px solid #1a1a1a;
      padding-top: 8px;
      margin-top: 40px;
    }
    
    .signature-name {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .signature-title {
      font-size: 10px;
      color: #666;
    }
    
    .footer { 
      margin-top: 50px; 
      padding: 20px; 
      border-top: 2px solid #0066cc; 
      text-align: center; 
      background: #f8fbff;
    }
    
    .footer p { 
      color: #666; 
      font-size: 10px; 
      margin: 5px 0;
    }
    
    .footer .qhealth { 
      font-weight: 700; 
      color: #0066cc; 
      font-size: 12px;
    }
    
    .confidential {
      text-align: center;
      color: #999;
      font-size: 9px;
      font-style: italic;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #f0f0f0;
    }
    
    @media print { 
      body { padding: 30px; }
      .no-print { display: none; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <div class="document-header">
    <div class="logo-section">
      <div class="clinic-info">
        <h1>QHEALTH</h1>
        <p>Healthcare Management System</p>
        <p>Laboratory Request Management</p>
      </div>
      <div class="doc-type">
        <h2>LABORATORY REQUEST FORM</h2>
        <p class="doc-id">REF: ${labRequest.id.substring(0, 8).toUpperCase()}</p>
      </div>
    </div>
    
    <div class="meta-info">
      <div class="meta-item">
        <label>Date Issued</label>
        <div class="value">${formatDate(labRequest.createdAt)}</div>
      </div>
      <div class="meta-item">
        <label>Status</label>
        <div class="value">
          <span class="status-badge status-${labRequest.status.toLowerCase().replace('_', '-')}">${labRequest.status.replace('_', ' ')}</span>
        </div>
      </div>
      <div class="meta-item">
        <label>Priority</label>
        <div class="value priority-${((_g = labRequest.priority) === null || _g === void 0 ? void 0 : _g.toLowerCase()) || 'normal'}">${labRequest.priority || 'NORMAL'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>I. Patient Information</h3>
    </div>
    <table class="info-table">
      <tr>
        <td>Patient Name:</td>
        <td><strong>${patientName}</strong></td>
      </tr>
      ${patientAge ? `
      <tr>
        <td>Age:</td>
        <td>${patientAge} years old</td>
      </tr>
      ` : ''}
      ${patientGender ? `
      <tr>
        <td>Gender:</td>
        <td>${patientGender}</td>
      </tr>
      ` : ''}
      ${patientContact ? `
      <tr>
        <td>Contact Number:</td>
        <td>${patientContact}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>II. Requesting Physician</h3>
    </div>
    <table class="info-table">
      <tr>
        <td>Physician Name:</td>
        <td><strong>${doctorName}</strong></td>
      </tr>
      ${doctorSpecialization ? `
      <tr>
        <td>Specialization:</td>
        <td>${doctorSpecialization}</td>
      </tr>
      ` : ''}
      ${doctorLicense ? `
      <tr>
        <td>License Number:</td>
        <td>${doctorLicense}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>III. Laboratory/Testing Facility</h3>
    </div>
    <table class="info-table">
      <tr>
        <td>Facility Name:</td>
        <td><strong>${organizationName}</strong></td>
      </tr>
      ${organizationAddress ? `
      <tr>
        <td>Address:</td>
        <td>${organizationAddress}</td>
      </tr>
      ` : ''}
      ${organizationContact ? `
      <tr>
        <td>Contact Number:</td>
        <td>${organizationContact}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>IV. Laboratory Tests Requested</h3>
    </div>
    <div class="content-box">${labRequest.requestedTests ? labRequest.requestedTests.replace(/\n/g, '<br>') : '<em style="color: #999;">No tests specified</em>'}</div>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>V. Special Instructions / Clinical Information</h3>
    </div>
    <div class="content-box">${labRequest.instructions ? labRequest.instructions.replace(/\n/g, '<br>') : '<em style="color: #999;">No special instructions</em>'}</div>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>VI. Additional Remarks</h3>
    </div>
    <div class="content-box">${labRequest.note ? labRequest.note.replace(/\n/g, '<br>') : '<em style="color: #999;">No additional remarks</em>'}</div>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <label>Requesting Physician</label>
      <div class="signature-line">
        <div class="signature-name">${doctorName}</div>
        <div class="signature-title">${doctorSpecialization || 'Physician'}</div>
        ${doctorLicense ? `<div class="signature-title">Lic. No.: ${doctorLicense}</div>` : ''}
      </div>
    </div>
    
    <div class="signature-box">
      <label>Laboratory Technician / Pathologist</label>
      <div class="signature-line">
        <div class="signature-name">_______________________________</div>
        <div class="signature-title">Name & Signature</div>
        <div class="signature-title">Date: _______________</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p class="qhealth">QHEALTH</p>
    <p>Healthcare Management System - Laboratory Request Module</p>
    <p>Document Generated: ${formatDate(new Date())}</p>
    <div class="confidential">
      <p>CONFIDENTIAL MEDICAL DOCUMENT</p>
      <p>This document contains privileged medical information. Unauthorized disclosure is prohibited.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    }
}
exports.LabRequestsController = LabRequestsController;
