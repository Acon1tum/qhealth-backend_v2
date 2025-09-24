import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LabRequestService {
  // Get all lab requests with optional filtering
  async getLabRequests(filter: any = {}): Promise<any[]> {
    try {
      const where: any = {};

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
        where.requestedDate = {};
        if (filter.dateFrom) {
          where.requestedDate.gte = filter.dateFrom;
        }
        if (filter.dateTo) {
          where.requestedDate.lte = filter.dateTo;
        }
      }

      const labRequests = await prisma.labRequest.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      });

      return labRequests;
    } catch (error) {
      console.error('Error fetching lab requests:', error);
      throw new Error('Failed to fetch lab requests');
    }
  }

  // Get lab request by ID
  async getLabRequestById(id: string): Promise<any | null> {
    try {
      const labRequest = await prisma.labRequest.findUnique({
        where: { id }
      });

      return labRequest;
    } catch (error) {
      console.error('Error fetching lab request by ID:', error);
      throw new Error('Failed to fetch lab request');
    }
  }

  // Create new lab request
  async createLabRequest(data: any): Promise<any> {
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
      const patient = await prisma.user.findUnique({
        where: { id: data.patientId }
      });
      if (!patient) {
        console.error('❌ Patient not found:', data.patientId);
        throw new Error('Patient not found');
      }
      console.log('✅ Patient found:', patient.email);

      // Validate that doctor exists
      const doctor = await prisma.user.findUnique({
        where: { id: data.doctorId }
      });
      if (!doctor) {
        console.error('❌ Doctor not found:', data.doctorId);
        throw new Error('Doctor not found');
      }
      console.log('✅ Doctor found:', doctor.email);

      // Validate that organization exists
      const organization = await prisma.organization.findUnique({
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
      
      const labRequest = await prisma.labRequest.create({
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
    } catch (error) {
      console.error('Error creating lab request:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create lab request');
    }
  }

  // Update lab request
  async updateLabRequest(id: string, data: any): Promise<any> {
    try {
      // Check if lab request exists
      const existingLabRequest = await prisma.labRequest.findUnique({
        where: { id }
      });
      if (!existingLabRequest) {
        throw new Error('Lab request not found');
      }

      const labRequest = await prisma.labRequest.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      return labRequest;
    } catch (error) {
      console.error('Error updating lab request:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update lab request');
    }
  }

  // Update lab request status
  async updateLabRequestStatus(id: string, status: string, notes?: string): Promise<any> {
    try {
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

      return await this.updateLabRequest(id, updateData);
    } catch (error) {
      console.error('Error updating lab request status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update lab request status');
    }
  }

  // Add test results to lab request
  async addTestResults(id: string, testResults: string, attachments?: string[]): Promise<any> {
    try {
      const updateData: any = {
        testResults,
        status: 'COMPLETED',
        completedDate: new Date()
      };

      if (attachments && Array.isArray(attachments)) {
        updateData.attachments = attachments;
      }

      return await this.updateLabRequest(id, updateData);
    } catch (error) {
      console.error('Error adding test results:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to add test results');
    }
  }

  // Delete lab request
  async deleteLabRequest(id: string): Promise<void> {
    try {
      // Check if lab request exists
      const existingLabRequest = await prisma.labRequest.findUnique({
        where: { id }
      });
      if (!existingLabRequest) {
        throw new Error('Lab request not found');
      }

      await prisma.labRequest.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error deleting lab request:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete lab request');
    }
  }

  // Get lab requests for specific patient
  async getPatientLabRequests(patientId: string): Promise<any[]> {
    try {
      return await this.getLabRequests({ patientId });
    } catch (error) {
      console.error('Error fetching patient lab requests:', error);
      throw new Error('Failed to fetch patient lab requests');
    }
  }

  // Get lab requests for specific doctor
  async getDoctorLabRequests(doctorId: string): Promise<any[]> {
    try {
      return await this.getLabRequests({ doctorId });
    } catch (error) {
      console.error('Error fetching doctor lab requests:', error);
      throw new Error('Failed to fetch doctor lab requests');
    }
  }

  // Get lab request statistics
  async getLabRequestStats(doctorId?: string, patientId?: string): Promise<any> {
    try {
      const where: any = {};
      if (doctorId) where.doctorId = doctorId;
      if (patientId) where.patientId = patientId;

      const [total, pending, approved, completed, rejected, cancelled] = await Promise.all([
        prisma.labRequest.count({ where }),
        prisma.labRequest.count({ where: { ...where, status: 'PENDING' } }),
        prisma.labRequest.count({ where: { ...where, status: 'APPROVED' } }),
        prisma.labRequest.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.labRequest.count({ where: { ...where, status: 'REJECTED' } }),
        prisma.labRequest.count({ where: { ...where, status: 'CANCELLED' } })
      ]);

      return {
        total,
        pending,
        approved,
        completed,
        rejected,
        cancelled
      };
    } catch (error) {
      console.error('Error fetching lab request stats:', error);
      throw new Error('Failed to fetch lab request statistics');
    }
  }
}
