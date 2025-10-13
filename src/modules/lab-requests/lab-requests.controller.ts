import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LabRequestService } from './lab-requests.service.js';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService } from '../../shared/services/audit.service';
import { NotificationService } from '../notifications/notification.service';

const prisma = new PrismaClient();
const labRequestService = new LabRequestService();
const authService = new AuthService();
const auditService = new AuditService();

export class LabRequestsController {
  // Get all lab requests with optional filtering
  async getLabRequests(req: Request, res: Response): Promise<void> {
    try {
      const { patientId, doctorId, organizationId, status, dateFrom, dateTo } = req.query;

      // Build filter object
      const filter: any = {};
      if (patientId) filter.patientId = patientId as string;
      if (doctorId) filter.doctorId = doctorId as string;
      if (organizationId) filter.organizationId = organizationId as string;
      if (status) filter.status = status as string;

      // Add date filtering
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.gte = new Date(dateFrom as string);
        if (dateTo) filter.createdAt.lte = new Date(dateTo as string);
      }

      const labRequests = await labRequestService.getLabRequests(filter);

      // Add display names for better frontend experience
      const labRequestsWithNames = await Promise.all(
        labRequests.map(async (request: any) => {
          const [patient, doctor, organization] = await Promise.all([
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

          return {
            ...request,
            patientName: patient?.patientInfo?.fullName || 'Unknown Patient',
            doctorName: doctor?.doctorInfo 
              ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
              : 'Unknown Doctor',
            organizationName: organization?.name || 'Unknown Organization'
          };
        })
      );

      res.json(labRequestsWithNames);
    } catch (error) {
      console.error('Error fetching lab requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lab requests',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get lab request by ID
  async getLabRequestById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const labRequest = await labRequestService.getLabRequestById(id);

      if (!labRequest) {
        res.status(404).json({
          success: false,
          message: 'Lab request not found'
        });
        return;
      }

      // Add display names
      const [patient, doctor, organization] = await Promise.all([
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

      const labRequestWithNames = {
        ...labRequest,
        patientName: patient?.patientInfo?.fullName || 'Unknown Patient',
        doctorName: doctor?.doctorInfo 
          ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
          : 'Unknown Doctor',
        organizationName: organization?.name || 'Unknown Organization'
      };

      res.json(labRequestWithNames);
    } catch (error) {
      console.error('Error fetching lab request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lab request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create new lab request
  async createLabRequest(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Lab Request Controller - Received request:', req.body);
      console.log('🔍 Lab Request Controller - Headers:', req.headers);
      console.log('🔍 Lab Request Controller - Authorization header:', req.headers.authorization);
      console.log('🔍 Lab Request Controller - User:', (req as any).user);
      
      const { patientId, doctorId, organizationId, note, priority, requestedTests, instructions } = req.body;
      const userId = (req as any).user?.id;

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

      const labRequestData: any = {
        patientId,
        doctorId,
        organizationId,
        note: note || '',
        priority: priority || 'NORMAL',
        status: 'PENDING' as const,
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

      const labRequest = await labRequestService.createLabRequest(labRequestData);

      console.log('✅ Lab Request Controller - Lab request created successfully:', labRequest.id);

      // Log audit event
      try {
        await AuditService.logUserActivity(
          userId,
          'CREATE_LAB_REQUEST',
          'DATA_MODIFICATION' as any,
          `Created lab request for patient ${patientId}`,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          'LAB_REQUEST',
          labRequest.id,
          { patientId, doctorId, organizationId }
        );
        console.log('✅ Audit log created successfully');
      } catch (auditError) {
        console.error('⚠️ Failed to create audit log:', auditError);
        // Don't fail the request if audit logging fails
      }

      // Send notification to patient
      await NotificationService.notifyLabRequestCreated(
        labRequest.id,
        patientId,
        doctorId
      );

      res.status(201).json({
        success: true,
        message: 'Lab request created successfully',
        data: labRequest
      });
    } catch (error) {
      console.error('❌ Error creating lab request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create lab request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update lab request
  async updateLabRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const labRequest = await labRequestService.updateLabRequest(id, updateData);

      // Log audit event
      await AuditService.logUserActivity(
        userId,
        'UPDATE_LAB_REQUEST',
        'DATA_MODIFICATION' as any,
        `Updated lab request ${id}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'LAB_REQUEST',
        id,
        updateData
      );

      res.json({
        success: true,
        message: 'Lab request updated successfully',
        data: labRequest
      });
    } catch (error) {
      console.error('Error updating lab request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lab request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update lab request status
  async updateLabRequestStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = (req as any).user?.id;

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

      const updateData: any = { status };

      // Add notes if provided
      if (notes) {
        updateData.note = notes;
      }

      const labRequest = await labRequestService.updateLabRequest(id, updateData);

      // Log audit event
      await AuditService.logUserActivity(
        userId,
        'UPDATE_LAB_REQUEST_STATUS',
        'DATA_MODIFICATION' as any,
        `Updated lab request ${id} status to ${status}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'LAB_REQUEST',
        id,
        { status, notes }
      );

      // Send notification when lab results are available
      if (status === 'COMPLETED') {
        await NotificationService.notifyLabResultsAvailable(
          id,
          labRequest.patientId,
          labRequest.doctorId
        );
      }

      res.json({
        success: true,
        message: `Lab request ${status.toLowerCase()} successfully`,
        data: labRequest
      });
    } catch (error) {
      console.error('Error updating lab request status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lab request status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }


  // Delete lab request
  async deleteLabRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await labRequestService.deleteLabRequest(id);

      // Log audit event
      await AuditService.logUserActivity(
        userId,
        'DELETE_LAB_REQUEST',
        'DATA_MODIFICATION' as any,
        `Deleted lab request ${id}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'LAB_REQUEST',
        id
      );

      res.json({
        success: true,
        message: 'Lab request deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting lab request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete lab request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get lab requests for specific patient
  async getPatientLabRequests(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const labRequests = await labRequestService.getLabRequests({ patientId });

      // Add display names
      const labRequestsWithNames = await Promise.all(
        labRequests.map(async (request: any) => {
          const [doctor, organization] = await Promise.all([
            prisma.user.findUnique({
              where: { id: request.doctorId },
              include: { doctorInfo: true }
            }),
            prisma.organization.findUnique({
              where: { id: request.organizationId }
            })
          ]);

          return {
            ...request,
            doctorName: doctor?.doctorInfo 
              ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
              : 'Unknown Doctor',
            organizationName: organization?.name || 'Unknown Organization'
          };
        })
      );

      res.json(labRequestsWithNames);
    } catch (error) {
      console.error('Error fetching patient lab requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch patient lab requests',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get lab requests for specific doctor
  async getDoctorLabRequests(req: Request, res: Response): Promise<void> {
    try {
      const { doctorId } = req.params;
      const labRequests = await labRequestService.getLabRequests({ doctorId });

      // Add display names
      const labRequestsWithNames = await Promise.all(
        labRequests.map(async (request: any) => {
          const [patient, organization] = await Promise.all([
            prisma.user.findUnique({
              where: { id: request.patientId },
              include: { patientInfo: true }
            }),
            prisma.organization.findUnique({
              where: { id: request.organizationId }
            })
          ]);

          return {
            ...request,
            patientName: patient?.patientInfo?.fullName || 'Unknown Patient',
            organizationName: organization?.name || 'Unknown Organization'
          };
        })
      );

      res.json(labRequestsWithNames);
    } catch (error) {
      console.error('Error fetching doctor lab requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctor lab requests',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Export lab request as PDF
  async exportLabRequestAsPDF(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const labRequest = await labRequestService.getLabRequestById(id);

      if (!labRequest) {
        res.status(404).json({
          success: false,
          message: 'Lab request not found'
        });
        return;
      }

      // Get patient, doctor, and organization details
      const [patient, doctor, organization] = await Promise.all([
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

    } catch (error) {
      console.error('Error exporting lab request PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export lab request PDF',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Generate HTML template for lab request PDF
  private generateLabRequestHTML(labRequest: any, patient: any, doctor: any, organization: any): string {
    const patientName = patient?.patientInfo?.fullName || 'Unknown Patient';
    const patientContact = patient?.patientInfo?.contactNumber || '';
    const patientAge = patient?.patientInfo?.dateOfBirth 
      ? Math.floor((new Date().getTime() - new Date(patient.patientInfo.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : '';
    const patientGender = patient?.patientInfo?.gender || '';
    
    const doctorName = doctor?.doctorInfo 
      ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
      : 'Unknown Doctor';
    const doctorSpecialization = doctor?.doctorInfo?.specialization || '';
    const doctorLicense = doctor?.doctorInfo?.licenseNumber || '';
    
    const organizationName = organization?.name || 'Unknown Organization';
    const organizationAddress = organization?.address || '';
    const organizationContact = organization?.phone || '';
    
    const formatDate = (date: Date | string) => {
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
        <div class="value priority-${labRequest.priority?.toLowerCase() || 'normal'}">${labRequest.priority || 'NORMAL'}</div>
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
