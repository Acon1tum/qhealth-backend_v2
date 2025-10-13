import { Request, Response } from 'express';
import { PrismaClient, AuditCategory, AuditLevel } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const prisma = new PrismaClient();

export class OrganizationsController {
  // Get all organizations (with optional filtering)
  async getOrganizations(req: Request, res: Response) {
    try {
      const { activeOnly } = req.query;
      
      // Build where clause based on query parameters
      const whereClause = activeOnly === 'true' ? { isActive: true } : {};
      
      const organizations = await prisma.organization.findMany({
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
      const transformedOrganizations = organizations.map(org => ({
        ...org,
        doctorCount: org._count.users,
        patientCount: 0 // We'll calculate this separately if needed
      }));

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'LIST_ORGANIZATIONS',
        userId,
        'ORGANIZATION',
        'list',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          activeOnly: activeOnly,
          totalOrganizations: transformedOrganizations.length,
          userRole: (req as any).user?.role,
          auditDescription: `Listed ${transformedOrganizations.length} organizations`
        }
      );

      res.json({
        success: true,
        data: transformedOrganizations
      });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user?.id || 'anonymous';
        const { activeOnly } = req.query;
        
        await AuditService.logSecurityEvent(
          'ORGANIZATIONS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch organizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            activeOnly: activeOnly,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
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
        // Audit log for organization not found
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'ORGANIZATION_NOT_FOUND',
          AuditLevel.WARNING,
          `Organization not found: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedOrganizationId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_ORGANIZATION',
        userId,
        'ORGANIZATION',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          organizationId: id,
          organizationName: organization.name,
          organizationEmail: organization.email,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed organization: ${organization.name}`
        }
      );

      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      console.error('Error fetching organization:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            organizationId: id,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
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

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_DOCTORS_BY_ORGANIZATION',
        userId,
        'ORGANIZATION',
        organizationId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          organizationId: organizationId,
          doctorCount: formattedDoctors.length,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed ${formattedDoctors.length} doctors for organization ${organizationId}`
        }
      );

      res.json({
        success: true,
        data: formattedDoctors
      });
    } catch (error) {
      console.error('Error fetching doctors by organization:', error);
      
      // Audit log for failure
      try {
        const { organizationId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'DOCTORS_BY_ORGANIZATION_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch doctors by organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            organizationId: organizationId,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctors',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create new organization
  async createOrganization(req: Request, res: Response) {
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
      const existingOrg = await prisma.organization.findFirst({
        where: { name: name.trim() }
      });

      if (existingOrg) {
        return res.status(409).json({
          success: false,
          message: 'Organization with this name already exists'
        });
      }

      const organization = await prisma.organization.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
          address: address?.trim(),
          phone: phone?.trim(),
          email: email?.trim(),
          website: website?.trim(),
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
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'CREATE',
        userId,
        'ORGANIZATION',
        organization.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
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
        }
      );

      res.status(201).json({
        success: true,
        data: organization,
        message: 'Organization created successfully'
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      
      // Audit log for failure
      try {
        const { name, description, address, phone, email, website } = req.body;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_CREATION_FAILED',
          AuditLevel.ERROR,
          `Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            organizationName: name,
            organizationDescription: description,
            organizationAddress: address,
            organizationPhone: phone,
            organizationEmail: email,
            organizationWebsite: website,
            createdBy: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update organization
  async updateOrganization(req: Request, res: Response) {
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
      const existingOrg = await prisma.organization.findUnique({
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
        const nameExists = await prisma.organization.findFirst({
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

      const organization = await prisma.organization.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() }),
          ...(address !== undefined && { address: address?.trim() }),
          ...(phone !== undefined && { phone: phone?.trim() }),
          ...(email !== undefined && { email: email?.trim() }),
          ...(website !== undefined && { website: website?.trim() }),
          ...(isActive !== undefined && { isActive })
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

      // Audit log for successful update
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'ORGANIZATION',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
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
        }
      );

      res.json({
        success: true,
        data: organization,
        message: 'Organization updated successfully'
      });
    } catch (error) {
      console.error('Error updating organization:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const { name, description, address, phone, email, website, isActive } = req.body;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
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
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete organization
  async deleteOrganization(req: Request, res: Response) {
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
      const existingOrg = await prisma.organization.findUnique({
        where: { id }
      });

      if (!existingOrg) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Check if organization has users
      const userCount = await prisma.user.count({
        where: { organizationId: id }
      });

      if (userCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete organization with existing users. Please reassign or remove users first.'
        });
      }

      await prisma.organization.delete({
        where: { id }
      });

      // Audit log for successful deletion
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'DELETE',
        userId,
        'ORGANIZATION',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
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
        }
      );

      res.json({
        success: true,
        message: 'Organization deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting organization:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_DELETE_FAILED',
          AuditLevel.ERROR,
          `Failed to delete organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            organizationId: id,
            deletedBy: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Toggle organization status
  async toggleOrganizationStatus(req: Request, res: Response) {
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
      const existingOrg = await prisma.organization.findUnique({
        where: { id }
      });

      if (!existingOrg) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const organization = await prisma.organization.update({
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
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'ORGANIZATION',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          organizationId: id,
          organizationName: organization.name,
          oldIsActive: existingOrg.isActive,
          newIsActive: organization.isActive,
          statusChange: isActive ? 'ACTIVATED' : 'DEACTIVATED',
          updatedBy: userId,
          auditDescription: `Organization ${isActive ? 'activated' : 'deactivated'}: ${organization.name}`
        }
      );

      res.json({
        success: true,
        data: organization,
        message: `Organization ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error toggling organization status:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const { isActive } = req.body;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_STATUS_TOGGLE_FAILED',
          AuditLevel.ERROR,
          `Failed to toggle organization status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            organizationId: id,
            isActive: isActive,
            updatedBy: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to toggle organization status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get organization statistics
  async getOrganizationStatistics(req: Request, res: Response) {
    try {
      // Get total organizations
      const totalOrganizations = await prisma.organization.count();

      // Get active organizations
      const activeOrganizations = await prisma.organization.count({
        where: { isActive: true }
      });

      // Get total doctors across all organizations
      const totalDoctors = await prisma.user.count({
        where: { role: 'DOCTOR' }
      });

      // Get total patients
      const totalPatients = await prisma.user.count({
        where: { role: 'PATIENT' }
      });

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_ORGANIZATION_STATISTICS',
        userId,
        'ORGANIZATION',
        'statistics',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          totalOrganizations: totalOrganizations,
          activeOrganizations: activeOrganizations,
          totalDoctors: totalDoctors,
          totalPatients: totalPatients,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed organization statistics: ${totalOrganizations} total, ${activeOrganizations} active`
        }
      );

      res.json({
        success: true,
        data: {
          totalOrganizations,
          activeOrganizations,
          totalDoctors,
          totalPatients
        }
      });
    } catch (error) {
      console.error('Error fetching organization statistics:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'ORGANIZATION_STATISTICS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch organization statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}



