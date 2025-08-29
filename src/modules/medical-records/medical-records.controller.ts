import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MedicalRecordType, PrivacySettingType, AccessLevel, Role } from '@prisma/client';
import { AuditService } from '../../shared/services/audit.service';

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
        return res.status(403).json({
          success: false,
          message: 'Patients can only create records for themselves'
        });
      }

      if (userRole === Role.DOCTOR) {
        // Check if doctor has access to this patient
        const hasAccess = await this.checkDoctorAccess(userId, patientId);
        if (!hasAccess) {
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
      await AuditService.logUserActivity(
        userId,
        'CREATE_MEDICAL_RECORD',
        'DATA_MODIFICATION',
        `Medical record created for patient ${medicalRecord.patient.patientInfo?.fullName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'MEDICAL_RECORD',
        medicalRecord.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Medical record created successfully',
        data: medicalRecord
      });

    } catch (error) {
      console.error('Error creating medical record:', error);
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
      if (userRole === Role.PATIENT && userId !== Number(patientId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own medical records'
        });
      }

      if (userRole === Role.DOCTOR) {
        // Check if doctor has access to this patient
        const hasAccess = await this.checkDoctorAccess(userId, Number(patientId));
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this patient'
          });
        }
      }

      let whereClause: any = { patientId: Number(patientId) };

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
      res.status(500).json({
        success: false,
        message: 'Failed to fetch medical records',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update medical record
  async updateMedicalRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { title, content, isPublic, isSensitive } = req.body;
      const userId = (req as any).user.id;

      // Get medical record
      const medicalRecord = await prisma.patientMedicalHistory.findFirst({
        where: { id: Number(recordId) },
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
        where: { id: Number(recordId) },
        data: {
          title,
          content,
          isPublic,
          isSensitive,
          updatedAt: new Date()
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_MEDICAL_RECORD',
        'DATA_MODIFICATION',
        `Medical record ${recordId} updated`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'MEDICAL_RECORD',
        recordId
      );

      res.json({
        success: true,
        message: 'Medical record updated successfully',
        data: updatedRecord
      });

    } catch (error) {
      console.error('Error updating medical record:', error);
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
        where: { id: Number(recordId) },
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
              medicalRecordId: Number(recordId),
              settingType: setting.settingType
            }
          },
          update: {
            isEnabled: setting.isEnabled
          },
          create: {
            medicalRecordId: Number(recordId),
            settingType: setting.settingType,
            isEnabled: setting.isEnabled
          }
        });
      }

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_PRIVACY_SETTINGS',
        'DATA_MODIFICATION',
        `Privacy settings updated for medical record ${recordId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'MEDICAL_RECORD',
        recordId
      );

      res.json({
        success: true,
        message: 'Privacy settings updated successfully'
      });

    } catch (error) {
      console.error('Error updating privacy settings:', error);
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
        where: { id: Number(recordId) },
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
          consultationId: medicalRecord.consultationId || 0,
          sharedWithDoctorId: doctorId,
          accessLevel: accessLevel || AccessLevel.READ_ONLY,
          sharedBy: userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'SHARE_MEDICAL_RECORD',
        'DATA_ACCESS',
        `Medical record ${recordId} shared with doctor ${doctorId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'MEDICAL_RECORD',
        recordId
      );

      res.status(201).json({
        success: true,
        message: 'Medical record shared successfully',
        data: sharing
      });

    } catch (error) {
      console.error('Error sharing medical record:', error);
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
        where: { id: Number(recordId) }
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
        where: { id: Number(recordId) }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'DELETE_MEDICAL_RECORD',
        'DATA_MODIFICATION',
        `Medical record ${recordId} deleted`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'MEDICAL_RECORD',
        recordId
      );

      res.json({
        success: true,
        message: 'Medical record deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting medical record:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete medical record',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to check doctor access
  private async checkDoctorAccess(doctorId: number, patientId: number): Promise<boolean> {
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
  private async createDefaultPrivacySettings(recordId: number) {
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
}
