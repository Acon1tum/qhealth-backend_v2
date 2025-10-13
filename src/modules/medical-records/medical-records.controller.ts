import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MedicalRecordType, PrivacySettingType, AccessLevel, Role, AuditCategory, AuditLevel } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';

const prisma = new PrismaClient();

export class MedicalRecordsController {
  // Create medical record
  async createMedicalRecord(req: Request, res: Response) {
    try {
      const { patientId, consultationId, recordType, title, content, isPublic, isSensitive } = req.body;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Verify permissions
      if (userRole === Role.PATIENT && userId !== patientId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_MEDICAL_RECORD_CREATION',
          AuditLevel.WARNING,
          `Patient attempted to create medical record for another patient`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: patientId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'create_medical_record'
          }
        );
        
        return res.status(403).json({
          success: false,
          message: 'Patients can only create records for themselves'
        });
      }

      if (userRole === Role.DOCTOR) {
        // Check if doctor has access to this patient
        const hasAccess = await this.checkDoctorAccess(userId, patientId);
        if (!hasAccess) {
          // Audit log for unauthorized access attempt
          await AuditService.logSecurityEvent(
            'UNAUTHORIZED_MEDICAL_RECORD_CREATION',
            AuditLevel.WARNING,
            `Doctor attempted to create medical record without patient access`,
            userId,
            req.ip || 'unknown',
            req.get('User-Agent') || 'unknown',
            {
              requestedPatientId: patientId,
              requestingDoctorId: userId,
              userRole: userRole,
              accessAttempt: 'create_medical_record'
            }
          );
          
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this patient'
          });
        }
      }

      // Create medical record
      const medicalRecord = await prisma.patientMedicalHistory.create({
        data: {
          patientId,
          consultationId,
          recordType,
          title,
          content,
          isPublic: isPublic || false,
          isSensitive: isSensitive || false,
          createdBy: userId
        },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              patientInfo: { select: { fullName: true } }
            }
          },
          creator: {
            select: {
              id: true,
              email: true,
              role: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          }
        }
      });

      // Create default privacy settings
      await this.createDefaultPrivacySettings(medicalRecord.id);

      // Audit log
      await AuditService.logDataModification(
        'CREATE',
        userId,
        'MEDICAL_RECORD',
        medicalRecord.id.toString(),
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          medicalRecordId: medicalRecord.id,
          patientId: medicalRecord.patientId,
          consultationId: medicalRecord.consultationId,
          recordType: medicalRecord.recordType,
          title: medicalRecord.title,
          isPublic: medicalRecord.isPublic,
          isSensitive: medicalRecord.isSensitive,
          createdBy: medicalRecord.createdBy,
          patientName: medicalRecord.patient.patientInfo?.fullName,
          creatorName: medicalRecord.creator.doctorInfo ? `${medicalRecord.creator.doctorInfo.firstName} ${medicalRecord.creator.doctorInfo.lastName}` : medicalRecord.creator.email,
          auditDescription: `Medical record created for patient ${medicalRecord.patient.patientInfo?.fullName}`
        }
      );

      res.status(201).json({
        success: true,
        message: 'Medical record created successfully',
        data: medicalRecord
      });

    } catch (error) {
      console.error('Error creating medical record:', error);
      
      // Audit log for failure
      try {
        const { patientId, consultationId, recordType, title, content, isPublic, isSensitive } = req.body;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORD_CREATION_FAILED',
          AuditLevel.ERROR,
          `Failed to create medical record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: patientId,
            consultationId: consultationId,
            recordType: recordType,
            title: title,
            isPublic: isPublic,
            isSensitive: isSensitive,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create medical record',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get patient medical records
  async getPatientMedicalRecords(req: Request, res: Response) {
    try {
      const { patientId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const { recordType, isPublic, page = 1, limit = 10 } = req.query;

      // Verify permissions
      if (userRole === Role.PATIENT && userId !== patientId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_MEDICAL_RECORDS_ACCESS',
          AuditLevel.WARNING,
          `Patient attempted to access another patient's medical records`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: patientId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_medical_records'
          }
        );
        
        return res.status(403).json({
          success: false,
          message: 'You can only view your own medical records'
        });
      }

      if (userRole === Role.DOCTOR) {
        // Check if doctor has access to this patient
        const hasAccess = await this.checkDoctorAccess(userId, patientId);
        if (!hasAccess) {
          // Audit log for unauthorized access attempt
          await AuditService.logSecurityEvent(
            'UNAUTHORIZED_MEDICAL_RECORDS_ACCESS',
            AuditLevel.WARNING,
            `Doctor attempted to access patient medical records without permission`,
            userId,
            req.ip || 'unknown',
            req.get('User-Agent') || 'unknown',
            {
              requestedPatientId: patientId,
              requestingDoctorId: userId,
              userRole: userRole,
              accessAttempt: 'view_medical_records'
            }
          );
          
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this patient'
          });
        }
      }

      let whereClause: any = { patientId: patientId };

      if (recordType) {
        whereClause.recordType = recordType;
      }

      if (isPublic !== undefined) {
        whereClause.isPublic = isPublic === 'true';
      }

      // If doctor, check what they can see based on privacy settings
      if (userRole === Role.DOCTOR) {
        whereClause.OR = [
          { isPublic: true },
          {
            privacySettings: {
              some: {
                settingType: 'PUBLIC_READ',
                isEnabled: true
              }
            }
          }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [records, total] = await Promise.all([
        prisma.patientMedicalHistory.findMany({
          where: whereClause,
          include: {
            creator: {
              select: {
                id: true,
                email: true,
                role: true,
                doctorInfo: { select: { firstName: true, lastName: true } }
              }
            },
            privacySettings: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit)
        }),
        prisma.patientMedicalHistory.count({ where: whereClause })
      ]);

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_PATIENT_MEDICAL_RECORDS',
        userId,
        'MEDICAL_RECORD',
        patientId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: patientId,
          recordType: recordType,
          isPublic: isPublic,
          page: Number(page),
          limit: Number(limit),
          totalRecords: total,
          userRole: userRole,
          auditDescription: `Viewed ${total} medical records for patient ${patientId}`
        }
      );

      res.json({
        success: true,
        data: records,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });

    } catch (error) {
      console.error('Error fetching medical records:', error);
      
      // Audit log for failure
      try {
        const { patientId } = req.params;
        const { recordType, isPublic, page, limit } = req.query;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORDS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch medical records: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: patientId,
            recordType: recordType,
            isPublic: isPublic,
            page: page,
            limit: limit,
            userRole: (req as any).user.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch medical records',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get patient medical records with summary and trends (for dashboard)
  async getPatientMedicalRecordsSummary(req: Request, res: Response) {
    try {
      const { patientId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Verify permissions
      if (userRole === Role.PATIENT && userId !== patientId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_MEDICAL_RECORDS_SUMMARY_ACCESS',
          AuditLevel.WARNING,
          `Patient attempted to access another patient's medical records summary`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: patientId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_medical_records_summary'
          }
        );
        
        return res.status(403).json({
          success: false,
          message: 'You can only view your own medical records'
        });
      }

      if (userRole === Role.DOCTOR) {
        // Check if doctor has access to this patient
        const hasAccess = await this.checkDoctorAccess(userId, patientId);
        if (!hasAccess) {
          // Audit log for unauthorized access attempt
          await AuditService.logSecurityEvent(
            'UNAUTHORIZED_MEDICAL_RECORDS_SUMMARY_ACCESS',
            AuditLevel.WARNING,
            `Doctor attempted to access patient medical records summary without permission`,
            userId,
            req.ip || 'unknown',
            req.get('User-Agent') || 'unknown',
            {
              requestedPatientId: patientId,
              requestingDoctorId: userId,
              userRole: userRole,
              accessAttempt: 'view_medical_records_summary'
            }
          );
          
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this patient'
          });
        }
      }

      // Get patient info
      const patientInfo = await prisma.patientInfo.findFirst({
        where: { userId: patientId }
      });

      if (!patientInfo) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Get consultations with health scans
      const consultations = await prisma.consultation.findMany({
        where: { patientId: patientId },
        include: {
          doctor: {
            select: {
              id: true,
              email: true,
              doctorInfo: { select: { firstName: true, lastName: true, specialization: true } }
            }
          },
          healthScan: true
        },
        orderBy: { startTime: 'desc' }
      });

      // Get health scans with consultation information
      const healthScans = consultations
        .filter(c => c.healthScan)
        .map(c => ({
          ...c.healthScan,
          consultation: {
            startTime: c.startTime,
            endTime: c.endTime,
            doctor: c.doctor
          }
        }))
        .filter(Boolean);

      // Get medical history records
      const medicalHistory = await prisma.patientMedicalHistory.findMany({
        where: { patientId: patientId },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              role: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          },
          privacySettings: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate health trends
      const healthTrends = this.calculateHealthTrends(healthScans);

      // Calculate summary
      const summary = {
        totalConsultations: consultations.length,
        totalHealthScans: healthScans.length,
        totalMedicalRecords: medicalHistory.length,
        lastConsultation: consultations.length > 0 ? consultations[0].startTime : null,
        lastHealthScan: healthScans.length > 0 ? healthScans[0]?.consultationId : null,
        lastMedicalRecord: medicalHistory.length > 0 ? medicalHistory[0].createdAt : null
      };

      // Get emergency contact and insurance info
      const emergencyContact = await prisma.emergencyContact.findFirst({
        where: { patientId: patientId }
      });

      const insuranceInfo = await prisma.insuranceInfo.findFirst({
        where: { patientId: patientId }
      });

      // Build complete patient info
      const completePatientInfo = {
        ...patientInfo,
        emergencyContact,
        insuranceInfo
      };

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_PATIENT_MEDICAL_RECORDS_SUMMARY',
        userId,
        'MEDICAL_RECORD',
        patientId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: patientId,
          totalConsultations: consultations.length,
          totalHealthScans: healthScans.length,
          totalMedicalRecords: medicalHistory.length,
          userRole: userRole,
          auditDescription: `Viewed medical records summary for patient ${patientId}`
        }
      );

      res.json({
        success: true,
        data: {
          patientInfo: completePatientInfo,
          consultations: consultations.map(c => ({
            id: c.id,
            startTime: c.startTime,
            endTime: c.endTime,
            consultationCode: c.consultationCode,
            isPublic: c.isPublic,
            notes: c.notes,
            diagnosis: c.diagnosis,
            treatment: c.treatment,
            followUpDate: c.followUpDate,
            doctor: c.doctor,
            healthScan: c.healthScan
          })),
          healthScans,
          medicalHistory,
          healthTrends,
          summary
        }
      });

    } catch (error) {
      console.error('Error fetching medical records summary:', error);
      
      // Audit log for failure
      try {
        const { patientId } = req.params;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORDS_SUMMARY_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch medical records summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            patientId: patientId,
            userRole: (req as any).user.role,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch medical records summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update medical record (creator only)
  async updateMedicalRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { title, content, isPublic, isSensitive } = req.body;
      const userId = (req as any).user.id;

      // Get medical record
      const medicalRecord = await prisma.patientMedicalHistory.findFirst({
        where: { id: recordId },
        include: { creator: true }
      });

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      // Verify permissions
      if (medicalRecord.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update records you created'
        });
      }

      // Update medical record
      const updatedRecord = await prisma.patientMedicalHistory.update({
        where: { id: recordId },
        data: {
          title,
          content,
          isPublic,
          isSensitive,
          updatedAt: new Date()
        }
      });

      // Audit log
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'MEDICAL_RECORD',
        recordId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          medicalRecordId: recordId,
          patientId: medicalRecord.patientId,
          consultationId: medicalRecord.consultationId,
          recordType: medicalRecord.recordType,
          oldTitle: medicalRecord.title,
          newTitle: title,
          oldIsPublic: medicalRecord.isPublic,
          newIsPublic: isPublic,
          oldIsSensitive: medicalRecord.isSensitive,
          newIsSensitive: isSensitive,
          updatedBy: userId,
          auditDescription: `Medical record ${recordId} updated`
        }
      );

      res.json({
        success: true,
        message: 'Medical record updated successfully',
        data: updatedRecord
      });

    } catch (error) {
      console.error('Error updating medical record:', error);
      
      // Audit log for failure
      try {
        const { recordId } = req.params;
        const { title, content, isPublic, isSensitive } = req.body;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORD_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update medical record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            recordId: recordId,
            title: title,
            content: content,
            isPublic: isPublic,
            isSensitive: isSensitive,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update medical record',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update privacy settings
  async updatePrivacySettings(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { privacySettings } = req.body;
      const userId = (req as any).user.id;

      // Get medical record
      const medicalRecord = await prisma.patientMedicalHistory.findFirst({
        where: { id: recordId },
        include: { patient: true }
      });

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      // Verify permissions (patient or creator)
      if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update privacy settings'
        });
      }

      // Update privacy settings
      for (const setting of privacySettings) {
        await prisma.medicalRecordPrivacy.upsert({
          where: {
            medicalRecordId_settingType: {
              medicalRecordId: recordId,
              settingType: setting.settingType
            }
          },
          update: {
            isEnabled: setting.isEnabled
          },
          create: {
            medicalRecordId: recordId,
            settingType: setting.settingType,
            isEnabled: setting.isEnabled
          }
        });
      }

      // Audit log
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'MEDICAL_RECORD',
        recordId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          medicalRecordId: recordId,
          patientId: medicalRecord.patientId,
          privacySettings: privacySettings,
          updatedBy: userId,
          auditDescription: `Privacy settings updated for medical record ${recordId}`
        }
      );

      res.json({
        success: true,
        message: 'Privacy settings updated successfully'
      });

    } catch (error) {
      console.error('Error updating privacy settings:', error);
      
      // Audit log for failure
      try {
        const { recordId } = req.params;
        const { privacySettings } = req.body;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORD_PRIVACY_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            recordId: recordId,
            privacySettings: privacySettings,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Share medical record with specific doctor
  async shareMedicalRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { doctorId, accessLevel, expiresAt } = req.body;
      const userId = (req as any).user.id;

      // Get medical record
      const medicalRecord = await prisma.patientMedicalHistory.findFirst({
        where: { id: recordId },
        include: { patient: true }
      });

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      // Verify permissions (patient or creator)
      if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to share this record'
        });
      }

      // Verify doctor exists
      const doctor = await prisma.user.findFirst({
        where: { id: doctorId, role: Role.DOCTOR }
      });

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      // Create sharing record
      const sharing = await prisma.consultationSharing.create({
        data: {
          consultationId: medicalRecord.consultationId || '',
          sharedWithDoctorId: doctorId,
          accessLevel: accessLevel || AccessLevel.READ_ONLY,
          sharedBy: userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      // Audit log
      await AuditService.logDataAccess(
        'SHARE_MEDICAL_RECORD',
        userId,
        'MEDICAL_RECORD',
        recordId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          medicalRecordId: recordId,
          patientId: medicalRecord.patientId,
          sharedWithDoctorId: doctorId,
          accessLevel: accessLevel,
          expiresAt: expiresAt,
          sharedBy: userId,
          auditDescription: `Medical record ${recordId} shared with doctor ${doctorId}`
        }
      );

      // Send notification to doctor
      await NotificationService.notifyMedicalRecordShared(
        recordId,
        doctorId,
        medicalRecord.patientId,
        medicalRecord.recordType
      );

      res.status(201).json({
        success: true,
        message: 'Medical record shared successfully',
        data: sharing
      });

    } catch (error) {
      console.error('Error sharing medical record:', error);
      
      // Audit log for failure
      try {
        const { recordId } = req.params;
        const { doctorId, accessLevel, expiresAt } = req.body;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORD_SHARE_FAILED',
          AuditLevel.ERROR,
          `Failed to share medical record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            recordId: recordId,
            doctorId: doctorId,
            accessLevel: accessLevel,
            expiresAt: expiresAt,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to share medical record',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete medical record
  async deleteMedicalRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const userId = (req as any).user.id;

      // Get medical record
      const medicalRecord = await prisma.patientMedicalHistory.findFirst({
        where: { id: recordId }
      });

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      // Verify permissions (patient or creator)
      if (medicalRecord.patientId !== userId && medicalRecord.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this record'
        });
      }

      // Delete medical record (cascade will handle related records)
      await prisma.patientMedicalHistory.delete({
        where: { id: recordId }
      });

      // Audit log
      await AuditService.logDataModification(
        'DELETE',
        userId,
        'MEDICAL_RECORD',
        recordId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          medicalRecordId: recordId,
          patientId: medicalRecord.patientId,
          consultationId: medicalRecord.consultationId,
          recordType: medicalRecord.recordType,
          title: medicalRecord.title,
          isPublic: medicalRecord.isPublic,
          isSensitive: medicalRecord.isSensitive,
          createdBy: medicalRecord.createdBy,
          deletedBy: userId,
          deletedAt: new Date(),
          auditDescription: `Medical record ${recordId} deleted`
        }
      );

      res.json({
        success: true,
        message: 'Medical record deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting medical record:', error);
      
      // Audit log for failure
      try {
        const { recordId } = req.params;
        const userId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'MEDICAL_RECORD_DELETE_FAILED',
          AuditLevel.ERROR,
          `Failed to delete medical record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            recordId: recordId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete medical record',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to check doctor access
  private async checkDoctorAccess(doctorId: string, patientId: string): Promise<boolean> {
    // Check if doctor has any consultation with this patient
    const consultation = await prisma.consultation.findFirst({
      where: {
        doctorId,
        patientId
      }
    });

    if (consultation) return true;

    // Check if doctor has been shared any consultations with this patient
    const sharedConsultation = await prisma.consultationSharing.findFirst({
      where: {
        sharedWithDoctorId: doctorId,
        consultation: {
          patientId
        }
      }
    });

    return !!sharedConsultation;
  }

  // Private method to create default privacy settings
  private async createDefaultPrivacySettings(recordId: string) {
    const defaultSettings = [
      { settingType: PrivacySettingType.PUBLIC_READ, isEnabled: false },
      { settingType: PrivacySettingType.SHARED_SPECIFIC, isEnabled: true },
      { settingType: PrivacySettingType.PATIENT_APPROVED, isEnabled: true }
    ];

    for (const setting of defaultSettings) {
      await prisma.medicalRecordPrivacy.create({
        data: {
          medicalRecordId: recordId,
          settingType: setting.settingType,
          isEnabled: setting.isEnabled
        }
      });
    }
  }

  // Private method to calculate health trends
  private calculateHealthTrends(healthScans: any[]): any {
    if (healthScans.length < 2) {
      return {
        heartRate: { trend: 'stable', change: 0 },
        bloodPressure: { trend: 'stable', change: 0 },
        spO2: { trend: 'stable', change: 0 },
        weight: { trend: 'stable', change: 0 },
        stressLevel: { trend: 'stable', change: 0 },
        generalWellness: { trend: 'stable', change: 0 }
      };
    }

    const latest = healthScans[0];
    const previous = healthScans[1];

    const calculateTrend = (current: number | undefined, previous: number | undefined, metric: string) => {
      if (!current || !previous) return { trend: 'stable', change: 0 };
      
      const change = current - previous;
      const percentChange = (change / previous) * 100;
      
      let trend = 'stable';
      if (percentChange > 5) trend = 'improving';
      else if (percentChange < -5) trend = 'declining';
      
      return { trend, change: Math.round(percentChange * 100) / 100 };
    };

    return {
      heartRate: calculateTrend(latest.heartRate, previous.heartRate, 'heartRate'),
      bloodPressure: { trend: 'stable', change: 0 }, // Complex metric, simplified
      spO2: calculateTrend(latest.spO2, previous.spO2, 'spO2'),
      weight: calculateTrend(latest.weight, previous.weight, 'weight'),
      stressLevel: calculateTrend(latest.stressLevel, previous.stressLevel, 'stressLevel'),
      generalWellness: calculateTrend(latest.generalWellness, previous.generalWellness, 'generalWellness')
    };
  }
}
