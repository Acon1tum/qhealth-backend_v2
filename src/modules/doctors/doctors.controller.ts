import { Request, Response } from 'express';
import { PrismaClient, Role, AuditCategory, AuditLevel } from '@prisma/client';
import { hash } from 'bcryptjs';
import { securityConfig } from '../../config/security.config';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService } from '../audit/audit.service';
import { IUserProfile } from '../../types';

const prisma = new PrismaClient();

type ListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  organizationId?: string;
};

export class DoctorsController {
  // GET /doctors
  async listDoctors(req: Request<{}, {}, {}, ListQuery>, res: Response) {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = (req.query.search || '').trim();
      const { organizationId } = req.query;

      const whereUser: any = { role: Role.DOCTOR };
      
      // If user is admin, filter by their organization
      if (req.user && req.user.role === Role.ADMIN) {
        whereUser.organizationId = (req.user as any).organizationId;
      } else if (organizationId) {
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

      const [total, users] = await Promise.all([
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
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'LIST_DOCTORS',
        userId,
        'DOCTOR',
        'list',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          page: page,
          limit: limit,
          search: search,
          organizationId: organizationId,
          totalResults: total,
          userRole: (req as any).user?.role,
          auditDescription: `Listed ${total} doctors (page ${page}/${Math.ceil(total / limit) || 1})`
        }
      );

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
    } catch (error) {
      console.error('Error listing doctors:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user?.id || 'anonymous';
        const { page, limit, search, organizationId } = req.query;
        
        await AuditService.logSecurityEvent(
          'DOCTORS_LIST_FAILED',
          AuditLevel.ERROR,
          `Failed to list doctors: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            page: page,
            limit: limit,
            search: search,
            organizationId: organizationId,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to list doctors' });
    }
  }

  // GET /doctors/:id
  async getDoctorById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const whereClause: any = { id, role: Role.DOCTOR };
      
      // If user is admin, filter by their organization
      if (req.user && req.user.role === Role.ADMIN) {
        whereClause.organizationId = (req.user as any).organizationId;
      }
      
      const doctor = await prisma.user.findFirst({
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
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'DOCTOR_NOT_FOUND',
          AuditLevel.WARNING,
          `Doctor not found: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedDoctorId: id,
            userRole: (req as any).user?.role,
            organizationId: (req as any).user?.organizationId
          }
        );
        
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_DOCTOR',
        userId,
        'DOCTOR',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          doctorId: id,
          doctorEmail: doctor.email,
          doctorName: `${doctor.doctorInfo?.firstName} ${doctor.doctorInfo?.lastName}`,
          specialization: doctor.doctorInfo?.specialization,
          organizationId: doctor.organizationId,
          organizationName: doctor.organization?.name,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed doctor profile: ${doctor.email}`
        }
      );

      res.json({ success: true, data: doctor });
    } catch (error) {
      console.error('Error fetching doctor:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'DOCTOR_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch doctor: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: id,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
    }
  }

  // POST /doctors
  async createDoctor(req: Request, res: Response) {
    try {
      const {
        email,
        password,
        organizationId,
        firstName,
        middleName,
        lastName,
        specialization,
        qualifications,
        experience,
        contactNumber,
        address,
        bio,
      } = req.body || {};

      if (!email || !password || !firstName || !lastName || !specialization || experience === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      // If user is admin, they can only create doctors in their organization
      let finalOrganizationId = organizationId;
      if (req.user && req.user.role === Role.ADMIN) {
        finalOrganizationId = (req.user as any).organizationId;
      }

      // Validate password strength consistently with AuthService
      if (!AuthService.validatePasswordStrength(password)) {
        return res.status(400).json({ success: false, message: 'Password does not meet security requirements' });
      }

      // Basic email uniqueness check
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }

      // Hash password
      const passwordHash = await hash(password, securityConfig.password.saltRounds);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: passwordHash,
          role: Role.DOCTOR,
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
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'CREATE',
        userId,
        'DOCTOR',
        user.id.toString(),
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
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
          createdByRole: (req as any).user?.role,
          auditDescription: `Doctor created: ${email}`
        }
      );

      res.status(201).json({ success: true, data: user, message: 'Doctor created successfully' });
    } catch (error) {
      console.error('Error creating doctor:', error);
      
      // Audit log for failure
      try {
        const {
          email,
          organizationId,
          firstName,
          middleName,
          lastName,
          specialization,
          qualifications,
          experience,
          contactNumber,
          address,
          bio
        } = req.body || {};
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'DOCTOR_CREATION_FAILED',
          AuditLevel.ERROR,
          `Failed to create doctor: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            email: email,
            organizationId: organizationId,
            firstName: firstName,
            lastName: lastName,
            specialization: specialization,
            experience: experience,
            createdBy: userId,
            createdByRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      const message = (error as any)?.message || 'Failed to create doctor';
      // Handle Prisma unique constraint errors gracefully
      if (message.includes('Unique constraint') || message.includes('Unique constraint failed')) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
      res.status(500).json({ success: false, message });
    }
  }

  // PUT /doctors/:id
  async updateDoctor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        organizationId,
        firstName,
        middleName,
        lastName,
        specialization,
        qualifications,
        experience,
        contactNumber,
        address,
        bio,
      } = req.body || {};

      const whereClause: any = { id, role: Role.DOCTOR };
      
      // If user is admin, filter by their organization
      if (req.user && req.user.role === Role.ADMIN) {
        whereClause.organizationId = (req.user as any).organizationId;
      }

      const user = await prisma.user.findFirst({ 
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
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'DOCTOR_UPDATE_NOT_FOUND',
          AuditLevel.WARNING,
          `Doctor not found for update: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedDoctorId: id,
            userRole: (req as any).user?.role,
            organizationId: (req as any).user?.organizationId
          }
        );
        
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      // If user is admin, they cannot change the organization
      const updateData: any = {};
      if (req.user && req.user.role === Role.ADMIN) {
        // Admin cannot change organization, so we don't include organizationId in update
      } else {
        updateData.organizationId = organizationId ?? undefined;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          doctorInfo: {
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
              update: {
                ...(firstName !== undefined && { firstName }),
                ...(middleName !== undefined && { middleName }),
                ...(lastName !== undefined && { lastName }),
                ...(specialization !== undefined && { specialization }),
                ...(qualifications !== undefined && { qualifications }),
                ...(experience !== undefined && { experience: Number(experience) }),
                ...(contactNumber !== undefined && { contactNumber }),
                ...(address !== undefined && { address }),
                ...(bio !== undefined && { bio }),
              },
            },
          },
        },
        select: { id: true },
      });

      // Audit log for successful update
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'DOCTOR',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          doctorId: id,
          doctorEmail: user.email,
          oldOrganizationId: user.organizationId,
          newOrganizationId: organizationId,
          oldFirstName: user.doctorInfo?.firstName,
          newFirstName: firstName,
          oldMiddleName: user.doctorInfo?.middleName,
          newMiddleName: middleName,
          oldLastName: user.doctorInfo?.lastName,
          newLastName: lastName,
          oldSpecialization: user.doctorInfo?.specialization,
          newSpecialization: specialization,
          oldQualifications: user.doctorInfo?.qualifications,
          newQualifications: qualifications,
          oldExperience: user.doctorInfo?.experience,
          newExperience: experience,
          oldContactNumber: user.doctorInfo?.contactNumber,
          newContactNumber: contactNumber,
          oldAddress: user.doctorInfo?.address,
          newAddress: address,
          oldBio: user.doctorInfo?.bio,
          newBio: bio,
          updatedBy: userId,
          updatedByRole: (req as any).user?.role,
          auditDescription: `Doctor updated: ${user.email}`
        }
      );

      res.json({ success: true, data: updated, message: 'Doctor updated successfully' });
    } catch (error) {
      console.error('Error updating doctor:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const {
          organizationId,
          firstName,
          middleName,
          lastName,
          specialization,
          qualifications,
          experience,
          contactNumber,
          address,
          bio
        } = req.body || {};
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'DOCTOR_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update doctor: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: id,
            organizationId: organizationId,
            firstName: firstName,
            lastName: lastName,
            specialization: specialization,
            experience: experience,
            updatedBy: userId,
            updatedByRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to update doctor' });
    }
  }

  // DELETE /doctors/:id
  async deleteDoctor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const whereClause: any = { id, role: Role.DOCTOR };
      
      // If user is admin, filter by their organization
      if (req.user && req.user.role === Role.ADMIN) {
        whereClause.organizationId = (req.user as any).organizationId;
      }
      
      const user = await prisma.user.findFirst({ 
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
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'DOCTOR_DELETE_NOT_FOUND',
          AuditLevel.WARNING,
          `Doctor not found for deletion: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedDoctorId: id,
            userRole: (req as any).user?.role,
            organizationId: (req as any).user?.organizationId
          }
        );
        
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      // Clean up related records with safe order
      await prisma.$transaction([
        prisma.consultation.deleteMany({ where: { doctorId: id } }),
        prisma.appointmentRequest.deleteMany({ where: { doctorId: id } }),
        prisma.prescription.deleteMany({ where: { doctorId: id } }),
        prisma.diagnosis.deleteMany({ where: { doctorId: id } }),
        prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
        prisma.doctorInfo.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);

      // Audit log for successful deletion
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'DELETE',
        userId,
        'DOCTOR',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          doctorId: id,
          doctorEmail: user.email,
          organizationId: user.organizationId,
          firstName: user.doctorInfo?.firstName,
          middleName: user.doctorInfo?.middleName,
          lastName: user.doctorInfo?.lastName,
          specialization: user.doctorInfo?.specialization,
          qualifications: user.doctorInfo?.qualifications,
          experience: user.doctorInfo?.experience,
          contactNumber: user.doctorInfo?.contactNumber,
          address: user.doctorInfo?.address,
          bio: user.doctorInfo?.bio,
          deletedAt: new Date(),
          deletedBy: userId,
          deletedByRole: (req as any).user?.role,
          relatedRecordsDeleted: {
            consultations: true,
            appointments: true,
            prescriptions: true,
            diagnoses: true,
            schedules: true,
            doctorInfo: true
          },
          auditDescription: `Doctor deleted: ${user.email}`
        }
      );

      res.json({ success: true, message: 'Doctor deleted successfully' });
    } catch (error) {
      console.error('Error deleting doctor:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'DOCTOR_DELETE_FAILED',
          AuditLevel.ERROR,
          `Failed to delete doctor: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: id,
            deletedBy: userId,
            deletedByRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to delete doctor' });
    }
  }
}


