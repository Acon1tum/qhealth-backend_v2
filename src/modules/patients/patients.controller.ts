import { Request, Response } from 'express';
import { PrismaClient, Role, Sex, AuditCategory, AuditLevel } from '@prisma/client';
import { hash } from 'bcryptjs';
import { securityConfig } from '../../config/security.config';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService } from '../audit/audit.service';

const prisma = new PrismaClient();

type ListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  organizationId?: string;
};

export class PatientsController {
  // GET /patients
  async listPatients(req: Request<{}, {}, {}, ListQuery>, res: Response) {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = (req.query.search || '').trim();
      const { organizationId } = req.query;

      const whereUser: any = { role: Role.PATIENT };
      if (organizationId) {
        whereUser.organizationId = organizationId;
      }

      if (search) {
        whereUser.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { patientInfo: { fullName: { contains: search, mode: 'insensitive' } } },
          { patientInfo: { contactNumber: { contains: search, mode: 'insensitive' } } },
          { patientInfo: { philHealthId: { contains: search, mode: 'insensitive' } } },
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
            patientInfo: {
              select: {
                fullName: true,
                gender: true,
                dateOfBirth: true,
                contactNumber: true,
                address: true,
                bloodType: true,
                philHealthId: true,
                philHealthStatus: true,
                philHealthIdVerified: true,
              },
            },
          },
          orderBy: [
            { patientInfo: { fullName: 'asc' } },
          ],
          skip,
          take: limit,
        }),
      ]);

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'LIST_PATIENTS',
        userId,
        'PATIENT',
        'list',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          page: page,
          limit: limit,
          search: search,
          organizationId: organizationId,
          totalPatients: total,
          userRole: (req as any).user?.role,
          auditDescription: `Listed ${total} patients (page ${page} of ${Math.ceil(total / limit) || 1})`
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
      console.error('Error listing patients:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user?.id || 'anonymous';
        const { page, limit, search, organizationId } = req.query;
        
        await AuditService.logSecurityEvent(
          'PATIENTS_LIST_FAILED',
          AuditLevel.ERROR,
          `Failed to list patients: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      
      res.status(500).json({ success: false, message: 'Failed to list patients' });
    }
  }

  // GET /patients/:id
  async getPatientById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const patient = await prisma.user.findFirst({
        where: { id, role: Role.PATIENT },
        select: {
          id: true,
          email: true,
          organizationId: true,
          organization: { select: { id: true, name: true } },
          patientInfo: {
            include: {
              emergencyContact: true,
              insuranceInfo: true,
            },
          },
          emergencyContacts: true,
          insuranceInfos: true,
        },
      });

      if (!patient) {
        // Audit log for patient not found
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'PATIENT_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient not found: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_PATIENT',
        userId,
        'PATIENT',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: id,
          patientEmail: patient.email,
          patientName: patient.patientInfo?.fullName,
          organizationId: patient.organizationId,
          organizationName: patient.organization?.name,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed patient: ${patient.patientInfo?.fullName || patient.email}`
        }
      );

      res.json({ success: true, data: patient });
    } catch (error) {
      console.error('Error fetching patient:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'PATIENT_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch patient: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: id,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to fetch patient' });
    }
  }

  // POST /patients
  async createPatient(req: Request, res: Response) {
    try {
      const {
        email,
        password,
        organizationId,
        fullName,
        gender,
        dateOfBirth,
        contactNumber,
        address,
        weight,
        height,
        bloodType,
        medicalHistory,
        allergies,
        medications,
        philHealthId,
        philHealthStatus,
        philHealthCategory,
        philHealthExpiry,
        philHealthMemberSince,
        // Emergency contact
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactNumber,
        emergencyContactAddress,
        // Insurance info
        insuranceProviderName,
        insurancePolicyNumber,
        insuranceContact,
      } = req.body || {};

      if (!email || !password || !fullName || !gender || !dateOfBirth || !contactNumber || !address || !bloodType) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
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
          role: Role.PATIENT,
          organizationId: organizationId || null,
          patientInfo: {
            create: {
              fullName,
              gender: gender as Sex,
              dateOfBirth: new Date(dateOfBirth),
              contactNumber,
              address,
              weight: Number(weight) || 0,
              height: Number(height) || 0,
              bloodType,
              medicalHistory: medicalHistory || '',
              allergies: allergies || '',
              medications: medications || '',
              philHealthId: philHealthId || null,
              philHealthStatus: philHealthStatus || null,
              philHealthCategory: philHealthCategory || null,
              philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null,
              philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null,
            },
          },
          // Create emergency contact if provided
          ...(emergencyContactName && emergencyContactNumber && {
            emergencyContacts: {
              create: {
                contactName: emergencyContactName,
                relationship: emergencyContactRelationship || 'Family',
                contactNumber: emergencyContactNumber,
                contactAddress: emergencyContactAddress || null,
              },
            },
          }),
          // Create insurance info if provided
          ...(insuranceProviderName && insurancePolicyNumber && insuranceContact && {
            insuranceInfos: {
              create: {
                providerName: insuranceProviderName,
                policyNumber: insurancePolicyNumber,
                insuranceContact,
              },
            },
          }),
        },
        select: { id: true, email: true, organizationId: true },
      });

      // Audit log for successful creation
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'CREATE',
        userId,
        'PATIENT',
        user.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: user.id,
          patientEmail: email.toLowerCase(),
          patientName: fullName,
          organizationId: organizationId,
          gender: gender,
          dateOfBirth: dateOfBirth,
          contactNumber: contactNumber,
          address: address,
          bloodType: bloodType,
          philHealthId: philHealthId,
          philHealthStatus: philHealthStatus,
          hasEmergencyContact: !!(emergencyContactName && emergencyContactNumber),
          hasInsuranceInfo: !!(insuranceProviderName && insurancePolicyNumber && insuranceContact),
          createdBy: userId,
          auditDescription: `Patient created: ${fullName} (${email})`
        }
      );

      res.status(201).json({ success: true, data: user, message: 'Patient created successfully' });
    } catch (error) {
      console.error('Error creating patient:', error);
      
      // Audit log for failure
      try {
        const {
          email,
          fullName,
          organizationId,
          gender,
          dateOfBirth,
          contactNumber,
          address,
          bloodType,
          philHealthId,
          emergencyContactName,
          insuranceProviderName
        } = req.body || {};
        const userId = (req as any).user?.id || 'system';
        const message = (error as any)?.message || 'Failed to create patient';
        
        await AuditService.logSecurityEvent(
          'PATIENT_CREATION_FAILED',
          AuditLevel.ERROR,
          `Failed to create patient: ${message}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientEmail: email,
            patientName: fullName,
            organizationId: organizationId,
            gender: gender,
            dateOfBirth: dateOfBirth,
            contactNumber: contactNumber,
            address: address,
            bloodType: bloodType,
            philHealthId: philHealthId,
            hasEmergencyContact: !!(emergencyContactName),
            hasInsuranceInfo: !!(insuranceProviderName),
            createdBy: userId,
            error: message
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      const message = (error as any)?.message || 'Failed to create patient';
      // Handle Prisma unique constraint errors gracefully
      if (message.includes('Unique constraint') || message.includes('Unique constraint failed')) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
      res.status(500).json({ success: false, message });
    }
  }

  // PUT /patients/:id
  async updatePatient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        organizationId,
        fullName,
        gender,
        dateOfBirth,
        contactNumber,
        address,
        weight,
        height,
        bloodType,
        medicalHistory,
        allergies,
        medications,
        philHealthId,
        philHealthStatus,
        philHealthCategory,
        philHealthExpiry,
        philHealthMemberSince,
        // Emergency contact
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactNumber,
        emergencyContactAddress,
        // Insurance info
        insuranceProviderName,
        insurancePolicyNumber,
        insuranceContact,
      } = req.body || {};

      const user = await prisma.user.findFirst({ where: { id, role: Role.PATIENT }, select: { id: true } });
      if (!user) {
        // Audit log for patient not found
        const userId = (req as any).user?.id || 'system';
        await AuditService.logSecurityEvent(
          'PATIENT_UPDATE_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient not found for update: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          organizationId: organizationId ?? undefined,
          patientInfo: {
            upsert: {
              create: {
                fullName: fullName || 'Patient',
                gender: (gender as Sex) || Sex.OTHER,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
                contactNumber: contactNumber || '',
                address: address || '',
                weight: Number(weight) || 0,
                height: Number(height) || 0,
                bloodType: bloodType || 'O+',
                medicalHistory: medicalHistory || '',
                allergies: allergies || '',
                medications: medications || '',
                philHealthId: philHealthId || null,
                philHealthStatus: philHealthStatus || null,
                philHealthCategory: philHealthCategory || null,
                philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null,
                philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null,
              },
              update: {
                ...(fullName !== undefined && { fullName }),
                ...(gender !== undefined && { gender: gender as Sex }),
                ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
                ...(contactNumber !== undefined && { contactNumber }),
                ...(address !== undefined && { address }),
                ...(weight !== undefined && { weight: Number(weight) }),
                ...(height !== undefined && { height: Number(height) }),
                ...(bloodType !== undefined && { bloodType }),
                ...(medicalHistory !== undefined && { medicalHistory }),
                ...(allergies !== undefined && { allergies }),
                ...(medications !== undefined && { medications }),
                ...(philHealthId !== undefined && { philHealthId }),
                ...(philHealthStatus !== undefined && { philHealthStatus }),
                ...(philHealthCategory !== undefined && { philHealthCategory }),
                ...(philHealthExpiry !== undefined && { philHealthExpiry: philHealthExpiry ? new Date(philHealthExpiry) : null }),
                ...(philHealthMemberSince !== undefined && { philHealthMemberSince: philHealthMemberSince ? new Date(philHealthMemberSince) : null }),
              },
            },
          },
          // Update emergency contact if provided
          ...(emergencyContactName && emergencyContactNumber && {
            emergencyContacts: {
              upsert: {
                create: {
                  contactName: emergencyContactName,
                  relationship: emergencyContactRelationship || 'Family',
                  contactNumber: emergencyContactNumber,
                  contactAddress: emergencyContactAddress || null,
                },
                update: {
                  contactName: emergencyContactName,
                  relationship: emergencyContactRelationship || 'Family',
                  contactNumber: emergencyContactNumber,
                  contactAddress: emergencyContactAddress || null,
                },
              },
            },
          }),
          // Update insurance info if provided
          ...(insuranceProviderName && insurancePolicyNumber && insuranceContact && {
            insuranceInfos: {
              upsert: {
                create: {
                  providerName: insuranceProviderName,
                  policyNumber: insurancePolicyNumber,
                  insuranceContact,
                },
                update: {
                  providerName: insuranceProviderName,
                  policyNumber: insurancePolicyNumber,
                  insuranceContact,
                },
              },
            },
          }),
        },
        select: { id: true },
      });

      // Audit log for successful update
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'PATIENT',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: id,
          organizationId: organizationId,
          fullName: fullName,
          gender: gender,
          dateOfBirth: dateOfBirth,
          contactNumber: contactNumber,
          address: address,
          weight: weight,
          height: height,
          bloodType: bloodType,
          medicalHistory: medicalHistory,
          allergies: allergies,
          medications: medications,
          philHealthId: philHealthId,
          philHealthStatus: philHealthStatus,
          hasEmergencyContact: !!(emergencyContactName && emergencyContactNumber),
          hasInsuranceInfo: !!(insuranceProviderName && insurancePolicyNumber && insuranceContact),
          updatedBy: userId,
          auditDescription: `Patient updated: ${id}`
        }
      );

      res.json({ success: true, data: updated, message: 'Patient updated successfully' });
    } catch (error) {
      console.error('Error updating patient:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const {
          organizationId,
          fullName,
          gender,
          dateOfBirth,
          contactNumber,
          address,
          weight,
          height,
          bloodType,
          medicalHistory,
          allergies,
          medications,
          philHealthId,
          emergencyContactName,
          insuranceProviderName
        } = req.body || {};
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'PATIENT_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update patient: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: id,
            organizationId: organizationId,
            fullName: fullName,
            gender: gender,
            dateOfBirth: dateOfBirth,
            contactNumber: contactNumber,
            address: address,
            weight: weight,
            height: height,
            bloodType: bloodType,
            medicalHistory: medicalHistory,
            allergies: allergies,
            medications: medications,
            philHealthId: philHealthId,
            hasEmergencyContact: !!(emergencyContactName),
            hasInsuranceInfo: !!(insuranceProviderName),
            updatedBy: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to update patient' });
    }
  }

  // DELETE /patients/:id
  async deletePatient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findFirst({ where: { id, role: Role.PATIENT }, select: { id: true } });
      if (!user) {
        // Audit log for patient not found
        const userId = (req as any).user?.id || 'system';
        await AuditService.logSecurityEvent(
          'PATIENT_DELETE_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient not found for deletion: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      // Clean up related records with safe order
      await prisma.$transaction([
        prisma.consultation.deleteMany({ where: { patientId: id } }),
        prisma.appointmentRequest.deleteMany({ where: { patientId: id } }),
        prisma.prescription.deleteMany({ where: { patientId: id } }),
        prisma.diagnosis.deleteMany({ where: { patientId: id } }),
        prisma.patientMedicalHistory.deleteMany({ where: { patientId: id } }),
        // prisma.labRequest.deleteMany({ where: { patientId: id } }),
        prisma.emergencyContact.deleteMany({ where: { patientId: id } }),
        prisma.insuranceInfo.deleteMany({ where: { patientId: id } }),
        prisma.patientInfo.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);

      // Audit log for successful deletion
      const userId = (req as any).user?.id || 'system';
      await AuditService.logDataModification(
        'DELETE',
        userId,
        'PATIENT',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: id,
          deletedBy: userId,
          deletedAt: new Date(),
          cascadeDeletedRecords: [
            'consultations',
            'appointmentRequests',
            'prescriptions',
            'diagnoses',
            'patientMedicalHistory',
            'emergencyContacts',
            'insuranceInfos',
            'patientInfo'
          ],
          auditDescription: `Patient deleted: ${id}`
        }
      );

      res.json({ success: true, message: 'Patient deleted successfully' });
    } catch (error) {
      console.error('Error deleting patient:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 'system';
        
        await AuditService.logSecurityEvent(
          'PATIENT_DELETE_FAILED',
          AuditLevel.ERROR,
          `Failed to delete patient: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: id,
            deletedBy: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to delete patient' });
    }
  }

  // GET /patients/:id/medical-history
  async getPatientMedicalHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const page = Math.max(parseInt(req.query.page as string || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string || '10', 10), 1), 100);
      const skip = (page - 1) * limit;

      const patient = await prisma.user.findFirst({ where: { id, role: Role.PATIENT }, select: { id: true } });
      if (!patient) {
        // Audit log for patient not found
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'PATIENT_MEDICAL_HISTORY_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient not found for medical history: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const [total, medicalHistory] = await Promise.all([
        prisma.patientMedicalHistory.count({ where: { patientId: id } }),
        prisma.patientMedicalHistory.findMany({
          where: { patientId: id },
          include: {
            consultation: {
              select: {
                id: true,
                consultationCode: true,
                startTime: true,
                doctor: {
                  select: {
                    id: true,
                    doctorInfo: {
                      select: {
                        firstName: true,
                        lastName: true,
                        specialization: true,
                      },
                    },
                  },
                },
              },
            },
            creator: {
              select: {
                id: true,
                role: true,
                doctorInfo: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_PATIENT_MEDICAL_HISTORY',
        userId,
        'PATIENT',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: id,
          page: page,
          limit: limit,
          totalMedicalRecords: total,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed ${total} medical history records for patient ${id} (page ${page})`
        }
      );

      res.json({
        success: true,
        data: {
          items: medicalHistory,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      console.error('Error fetching patient medical history:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const page = req.query.page as string;
        const limit = req.query.limit as string;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'PATIENT_MEDICAL_HISTORY_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch patient medical history: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: id,
            page: page,
            limit: limit,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to fetch patient medical history' });
    }
  }

  // GET /patients/:id/appointments
  async getPatientAppointments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const page = Math.max(parseInt(req.query.page as string || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string || '10', 10), 1), 100);
      const skip = (page - 1) * limit;

      const patient = await prisma.user.findFirst({ where: { id, role: Role.PATIENT }, select: { id: true } });
      if (!patient) {
        // Audit log for patient not found
        const userId = (req as any).user?.id || 'anonymous';
        await AuditService.logSecurityEvent(
          'PATIENT_APPOINTMENTS_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient not found for appointments: ${id}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: id,
            userRole: (req as any).user?.role
          }
        );
        
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const [total, appointments] = await Promise.all([
        prisma.appointmentRequest.count({ where: { patientId: id } }),
        prisma.appointmentRequest.findMany({
          where: { patientId: id },
          include: {
            doctor: {
              select: {
                id: true,
                doctorInfo: {
                  select: {
                    firstName: true,
                    lastName: true,
                    specialization: true,
                  },
                },
              },
            },
            consultation: {
              select: {
                id: true,
                consultationCode: true,
                startTime: true,
                endTime: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      // Audit log for successful access
      const userId = (req as any).user?.id || 'anonymous';
      await AuditService.logDataAccess(
        'VIEW_PATIENT_APPOINTMENTS',
        userId,
        'PATIENT',
        id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: id,
          page: page,
          limit: limit,
          totalAppointments: total,
          userRole: (req as any).user?.role,
          auditDescription: `Viewed ${total} appointments for patient ${id} (page ${page})`
        }
      );

      res.json({
        success: true,
        data: {
          items: appointments,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      
      // Audit log for failure
      try {
        const { id } = req.params;
        const page = req.query.page as string;
        const limit = req.query.limit as string;
        const userId = (req as any).user?.id || 'anonymous';
        
        await AuditService.logSecurityEvent(
          'PATIENT_APPOINTMENTS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch patient appointments: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: id,
            page: page,
            limit: limit,
            userRole: (req as any).user?.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({ success: false, message: 'Failed to fetch patient appointments' });
    }
  }
}
