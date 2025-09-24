import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LabRequestService } from './lab-requests.service.js';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService } from '../../shared/services/audit.service';

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
        filter.requestedDate = {};
        if (dateFrom) filter.requestedDate.gte = new Date(dateFrom as string);
        if (dateTo) filter.requestedDate.lte = new Date(dateTo as string);
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
      
      const { patientId, doctorId, organizationId, consultationId, notes } = req.body;
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

      const labRequestData = {
        patientId,
        doctorId,
        organizationId,
        notes: notes || '',
        status: 'PENDING' as const,
        createdBy: userId
      };

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

      // Set appropriate date based on status
      if (status === 'APPROVED') {
        updateData.approvedDate = new Date();
      } else if (status === 'COMPLETED') {
        updateData.completedDate = new Date();
      }

      if (notes) {
        updateData.notes = notes;
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

  // Add test results to lab request
  async addTestResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { testResults, attachments } = req.body;
      const userId = (req as any).user?.id;

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

      const updateData: any = {
        testResults,
        status: 'COMPLETED',
        completedDate: new Date()
      };

      if (attachments && Array.isArray(attachments)) {
        updateData.attachments = attachments;
      }

      const labRequest = await labRequestService.updateLabRequest(id, updateData);

      // Log audit event
      await AuditService.logUserActivity(
        userId,
        'ADD_LAB_RESULTS',
        'DATA_MODIFICATION' as any,
        `Added test results to lab request ${id}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'LAB_REQUEST',
        id,
        { 
          hasResults: true, 
          attachmentsCount: attachments?.length || 0 
        }
      );

      res.json({
        success: true,
        message: 'Test results added successfully',
        data: labRequest
      });
    } catch (error) {
      console.error('Error adding test results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add test results',
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

      // For now, return a simple JSON response
      // In a real implementation, you would generate a PDF here
      res.json({
        success: true,
        message: 'PDF export functionality will be implemented',
        data: labRequest
      });
    } catch (error) {
      console.error('Error exporting lab request PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export lab request PDF',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
