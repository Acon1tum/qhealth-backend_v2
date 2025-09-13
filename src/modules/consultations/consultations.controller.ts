import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Role, AccessLevel, PrivacySettingType } from '@prisma/client';
import { AuditService } from '../../shared/services/audit.service';

const prisma = new PrismaClient();

export class ConsultationsController {
  // Create consultation from appointment
  async createConsultation(req: Request, res: Response) {
    try {
      const { appointmentId, startTime, endTime, consultationLink, notes, diagnosis, treatment, followUpDate } = req.body;
      const userId = (req as any).user.id;

      // Verify user is a doctor
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can create consultations'
        });
      }

      // Get appointment and verify doctor owns it
      const appointment = await prisma.appointmentRequest.findFirst({
        where: { id: appointmentId, doctorId: userId, status: 'CONFIRMED' }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found or not confirmed'
        });
      }

      // Generate unique consultation code (exactly 9 characters)
      const consultationCode = this.generateConsultationCode(appointment);

      // Create consultation
      const consultation = await prisma.consultation.create({
        data: {
          doctorId: userId,
          patientId: appointment.patientId,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          consultationCode,
          notes,
          diagnosis,
          treatment,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          appointmentRequest: {
            connect: { id: appointmentId }
          }
        },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              patientInfo: { select: { fullName: true } }
            }
          },
          doctor: {
            select: {
              id: true,
              email: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          }
        }
      });

      // Update appointment status
      await prisma.appointmentRequest.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'CREATE_CONSULTATION',
        'DATA_MODIFICATION',
        `Consultation created for patient ${consultation.patient.patientInfo?.fullName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultation.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Consultation created successfully',
        data: consultation
      });

    } catch (error) {
      console.error('Error creating consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create consultation directly from doctor-meet (without appointment)
  async createDirectConsultation(req: Request, res: Response) {
    try {
      const { patientId, startTime, endTime, notes, diagnosis, treatment, followUpDate } = req.body;
      const doctorId = (req as any).user.id;

      // Verify user is a doctor
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can create consultations'
        });
      }

      // Verify patient exists
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        include: { patientInfo: true }
      });

      if (!patient || patient.role !== 'PATIENT') {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Generate unique consultation code
      const consultationCode = this.generateDirectConsultationCode(doctorId, patientId);

      // Create consultation
      const consultation = await prisma.consultation.create({
        data: {
          doctorId,
          patientId: patientId,
          startTime: new Date(startTime || new Date()),
          endTime: endTime ? new Date(endTime) : null,
          consultationCode,
          notes: notes || 'Direct consultation from doctor-meet',
          diagnosis: diagnosis || null,
          treatment: treatment || null,
          followUpDate: followUpDate ? new Date(followUpDate) : null
        },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              patientInfo: { select: { fullName: true } }
            }
          },
          doctor: {
            select: {
              id: true,
              email: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          }
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        doctorId,
        'CREATE_DIRECT_CONSULTATION',
        'DATA_MODIFICATION',
        `Direct consultation created for patient ${consultation.patient.patientInfo?.fullName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultation.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Direct consultation created successfully',
        data: consultation
      });

    } catch (error) {
      console.error('Error creating direct consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create direct consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get consultation details
  async getConsultation(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Get consultation
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              patientInfo: { select: { fullName: true } }
            }
          },
          doctor: {
            select: {
              id: true,
              email: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          },
          healthScan: true,
          medicalHistory: true
        }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found'
        });
      }

      // Check permissions
      const hasAccess = await this.checkConsultationAccess(userId, userRole, consultation);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this consultation'
        });
      }

      res.json({
        success: true,
        data: consultation
      });

    } catch (error) {
      console.error('Error fetching consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update consultation
  async updateConsultation(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const { notes, diagnosis, treatment, followUpDate, isPublic } = req.body;
      const userId = (req as any).user.id;

      // Verify user is a doctor
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can update consultations'
        });
      }

      // Get consultation and verify doctor owns it
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId, doctorId: userId }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found or you do not have permission'
        });
      }

      // Update consultation
      const updatedConsultation = await prisma.consultation.update({
        where: { id: consultationId },
        data: {
          notes,
          diagnosis,
          treatment,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          isPublic,
          updatedAt: new Date()
        }
      });

      // If privacy flag provided, mirror delete-and-transfer behavior
      if (typeof isPublic === 'boolean') {
        await prisma.$transaction(async (tx) => {
          if (isPublic) {
            await tx.consultationPrivacy.deleteMany({
              where: { consultationId: consultationId }
            });

            await tx.consultationSharing.updateMany({
              where: { consultationId: consultationId },
              data: { isActive: true }
            });

            await tx.consultationSharing.upsert({
              where: {
                consultationId_sharedWithDoctorId: {
                  consultationId: consultationId,
                  sharedWithDoctorId: updatedConsultation.doctorId
                }
              },
              update: { isActive: true, accessLevel: AccessLevel.READ_ONLY, sharedBy: userId, expiresAt: null },
              create: {
                consultationId: consultationId,
                sharedWithDoctorId: updatedConsultation.doctorId,
                accessLevel: AccessLevel.READ_ONLY,
                sharedBy: userId,
                expiresAt: null
              }
            });
          } else {
            await tx.consultationSharing.deleteMany({
              where: { consultationId: consultationId }
            });

            await tx.consultationPrivacy.upsert({
              where: {
                consultationId_settingType: {
                  consultationId: consultationId,
                  settingType: PrivacySettingType.PUBLIC_READ
                }
              },
              update: { isEnabled: false },
              create: {
                consultationId: consultationId,
                settingType: PrivacySettingType.PUBLIC_READ,
                isEnabled: false
              }
            });
          }
        });
      }

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_CONSULTATION',
        'DATA_MODIFICATION',
        `Consultation ${consultationId} updated`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultationId
      );

      res.json({
        success: true,
        message: 'Consultation updated successfully',
        data: updatedConsultation
      });

    } catch (error) {
      console.error('Error updating consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create health scan
  async createHealthScan(req: Request, res: Response) {
    try {
      const { consultationId, healthData } = req.body;
      const userId = (req as any).user.id;

      // Verify user is a doctor
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can create health scans'
        });
      }

      // Get consultation and verify doctor owns it
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId, doctorId: userId }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found or you do not have permission'
        });
      }

      // Create health scan
      const healthScan = await prisma.healthScan.create({
        data: {
          consultationId,
          ...healthData
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'CREATE_HEALTH_SCAN',
        'DATA_MODIFICATION',
        `Health scan created for consultation ${consultationId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'HEALTH_SCAN',
        healthScan.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Health scan created successfully',
        data: healthScan
      });

    } catch (error) {
      console.error('Error creating health scan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create health scan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get health scan
  async getHealthScan(req: Request, res: Response) {
    try {
      const { scanId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Get health scan
      const healthScan = await prisma.healthScan.findFirst({
        where: { id: scanId },
        include: {
          consultation: {
            include: {
              patient: {
                select: {
                  id: true,
                  email: true,
                  patientInfo: { select: { fullName: true } }
                }
              },
              doctor: {
                select: {
                  id: true,
                  email: true,
                  doctorInfo: { select: { firstName: true, lastName: true } }
                }
              }
            }
          }
        }
      });

      if (!healthScan) {
        return res.status(404).json({
          success: false,
          message: 'Health scan not found'
        });
      }

      // Check permissions
      const hasAccess = await this.checkHealthScanAccess(userId, userRole, healthScan);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this health scan'
        });
      }

      res.json({
        success: true,
        data: healthScan
      });

    } catch (error) {
      console.error('Error fetching health scan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch health scan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update consultation privacy settings
  async updateConsultationPrivacy(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const { privacySettings, isPublic } = req.body as { privacySettings?: Array<{ settingType: PrivacySettingType, isEnabled: boolean }>, isPublic?: boolean };
      const userId = (req as any).user.id;

      // Get consultation
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId },
        include: { patient: true }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found'
        });
      }

      // Verify permissions (patient or doctor)
      if (consultation.patientId !== userId && consultation.doctorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update privacy settings'
        });
      }

      // Optional: simple public/private toggle maps to PUBLIC_READ privacy setting and
      // transfers records between ConsultationPrivacy and ConsultationSharing
      if (typeof isPublic === 'boolean') {
        const result = await prisma.$transaction(async (tx) => {
          // Update consultation flag
          await tx.consultation.update({
            where: { id: consultationId },
            data: { isPublic }
          });

          if (isPublic) {
            // PUBLIC: delete privacy rows, ensure sharing
            const deletedPrivacy = await tx.consultationPrivacy.deleteMany({
              where: { consultationId: consultationId }
            });

            await tx.consultationSharing.updateMany({
              where: { consultationId: consultationId },
              data: { isActive: true }
            });

            await tx.consultationSharing.upsert({
              where: {
                consultationId_sharedWithDoctorId: {
                  consultationId: consultationId,
                  sharedWithDoctorId: consultation.doctorId
                }
              },
              update: { isActive: true, accessLevel: AccessLevel.READ_ONLY, sharedBy: userId, expiresAt: null },
              create: {
                consultationId: consultationId,
                sharedWithDoctorId: consultation.doctorId,
                accessLevel: AccessLevel.READ_ONLY,
                sharedBy: userId,
                expiresAt: null
              }
            });

            return { deletedPrivacy: deletedPrivacy.count, deletedSharing: 0 };
          } else {
            // PRIVATE: delete sharing rows, ensure privacy PUBLIC_READ disabled
            const deletedSharing = await tx.consultationSharing.deleteMany({
              where: { consultationId: consultationId }
            });

            await tx.consultationPrivacy.upsert({
              where: {
                consultationId_settingType: {
                  consultationId: consultationId,
                  settingType: PrivacySettingType.PUBLIC_READ
                }
              },
              update: { isEnabled: false },
              create: {
                consultationId: consultationId,
                settingType: PrivacySettingType.PUBLIC_READ,
                isEnabled: false
              }
            });

            return { deletedPrivacy: 0, deletedSharing: deletedSharing.count };
          }
        });

        // Include counts in response message for visibility
        (req as any)._privacyMutationCounts = result;
      }

      // Advanced privacy settings array support (optional)
      if (Array.isArray(privacySettings)) {
        for (const setting of privacySettings) {
          await prisma.consultationPrivacy.upsert({
            where: {
              consultationId_settingType: {
                consultationId: consultationId,
                settingType: setting.settingType
              }
            },
            update: { isEnabled: setting.isEnabled },
            create: {
              consultationId: consultationId,
              settingType: setting.settingType,
              isEnabled: setting.isEnabled
            }
          });
        }
      }

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_CONSULTATION_PRIVACY',
        'DATA_MODIFICATION',
        `Privacy settings updated for consultation ${consultationId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultationId
      );

      res.json({
        success: true,
        message: 'Privacy settings updated successfully',
        meta: (req as any)._privacyMutationCounts || undefined
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

  // Share consultation with specific doctor
  async shareConsultation(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const { doctorId, accessLevel, expiresAt } = req.body;
      const userId = (req as any).user.id;

      // Get consultation
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId },
        include: { patient: true }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found'
        });
      }

      // Verify permissions (patient or doctor)
      if (consultation.patientId !== userId && consultation.doctorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to share this consultation'
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
          consultationId: consultationId,
          sharedWithDoctorId: doctorId,
          accessLevel: accessLevel || AccessLevel.READ_ONLY,
          sharedBy: userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'SHARE_CONSULTATION',
        'DATA_ACCESS',
        `Consultation ${consultationId} shared with doctor ${doctorId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultationId
      );

      res.status(201).json({
        success: true,
        message: 'Consultation shared successfully',
        data: sharing
      });

    } catch (error) {
      console.error('Error sharing consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to share consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to check consultation access
  private async checkConsultationAccess(userId: string, userRole: Role, consultation: any): Promise<boolean> {
    // Patient can always see their own consultations
    if (consultation.patientId === userId) return true;

    // Doctor can see consultations they conducted
    if (consultation.doctorId === userId) return true;

    // Check if consultation is public
    if (consultation.isPublic) return true;

    // Check if consultation is shared with this doctor
    if (userRole === Role.DOCTOR) {
      const sharing = await prisma.consultationSharing.findFirst({
        where: {
          consultationId: consultation.id,
          sharedWithDoctorId: userId,
          isActive: true
        }
      });
      if (sharing) return true;
    }

    return false;
  }

  // Private method to check health scan access
  private async checkHealthScanAccess(userId: string, userRole: Role, healthScan: any): Promise<boolean> {
    const consultation = healthScan.consultation;

    // Patient can always see their own health scans
    if (consultation.patientId === userId) return true;

    // Doctor can see health scans from consultations they conducted
    if (consultation.doctorId === userId) return true;

    // Check if consultation is public (via flag or PUBLIC_READ privacy setting)
    if (consultation.isPublic) return true;
    const publicRead = await prisma.consultationPrivacy.findFirst({
      where: {
        consultationId: consultation.id,
        settingType: PrivacySettingType.PUBLIC_READ,
        isEnabled: true
      }
    });
    if (publicRead) return true;

    // Check if consultation is shared with this doctor
    if (userRole === Role.DOCTOR) {
      const sharing = await prisma.consultationSharing.findFirst({
        where: {
          consultationId: consultation.id,
          sharedWithDoctorId: userId,
          isActive: true
        }
      });
      if (sharing) return true;
    }

    return false;
  }

  // Join consultation with code validation
  async joinConsultation(req: Request, res: Response) {
    try {
      const { consultationCode } = req.body;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (!consultationCode) {
        return res.status(400).json({
          success: false,
          message: 'Consultation code is required'
        });
      }

      // Find consultation by code
      const consultation = await prisma.consultation.findFirst({
        where: { consultationCode },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              patientInfo: { select: { fullName: true } }
            }
          },
          doctor: {
            select: {
              id: true,
              email: true,
              doctorInfo: { select: { firstName: true, lastName: true } }
            }
          },
          healthScan: true
        }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Invalid consultation code'
        });
      }

      // Verify user has permission to join this consultation
      if (consultation.patientId !== userId && consultation.doctorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to join this consultation'
        });
      }

      // Check if consultation is active (not completed)
      if (consultation.endTime) {
        return res.status(400).json({
          success: false,
          message: 'This consultation has already ended'
        });
      }

      // Audit log for successful join
      await AuditService.logUserActivity(
        userId,
        'JOIN_CONSULTATION',
        'DATA_ACCESS',
        `User joined consultation ${consultation.id} with code ${consultationCode}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'CONSULTATION',
        consultation.id.toString()
      );

      res.json({
        success: true,
        message: 'Access granted to consultation',
        data: {
          consultationId: consultation.id,
          consultationCode: consultation.consultationCode,
          startTime: consultation.startTime,
          patient: consultation.patient,
          doctor: consultation.doctor,
          healthScan: consultation.healthScan
        }
      });

    } catch (error) {
      console.error('Error joining consultation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join consultation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to generate a unique consultation code (exactly 9 characters)
  private generateConsultationCode(appointment: any): string {
    // Create a 9-character code: QH + 2 digits from date + 2 digits from time + 3 random chars
    const date = new Date(appointment.requestedDate);
    const daySuffix = date.getDate().toString().padStart(2, '0');
    const hourSuffix = appointment.requestedTime.split(':')[0].padStart(2, '0');
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const consultationCode = `QH${daySuffix}${hourSuffix}${randomChars}`;
    
    return consultationCode;
  }

  // Private method to generate a unique consultation code for direct consultations
  private generateDirectConsultationCode(doctorId: number, patientId: number): string {
    // Create a 9-character code: DM + 2 digits from doctor ID + 2 digits from patient ID + 3 random chars
    const doctorSuffix = (doctorId % 100).toString().padStart(2, '0');
    const patientSuffix = (patientId % 100).toString().padStart(2, '0');
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const consultationCode = `DM${doctorSuffix}${patientSuffix}${randomChars}`;
    
    return consultationCode;
  }
}
