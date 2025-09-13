import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class OrganizationsController {
  // Get all active organizations
  async getOrganizations(req: Request, res: Response) {
    try {
      const organizations = await prisma.organization.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true
        },
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: organizations
      });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get organization by ID
  async getOrganizationById(req: Request, res: Response) {
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

      const organization = await prisma.organization.findFirst({
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
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      console.error('Error fetching organization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get doctors by organization
  async getDoctorsByOrganization(req: Request, res: Response) {
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

      const doctors = await prisma.user.findMany({
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

      const formattedDoctors = doctors.map(doctor => ({
        id: doctor.id,
        name: doctor.doctorInfo 
          ? `Dr. ${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
          : doctor.email,
        specialization: doctor.doctorInfo?.specialization || 'General Practice',
        organizationId: organizationId
      }));

      res.json({
        success: true,
        data: formattedDoctors
      });
    } catch (error) {
      console.error('Error fetching doctors by organization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctors',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

