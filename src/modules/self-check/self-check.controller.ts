import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Role } from '@prisma/client';
import { AuditService } from '../../shared/services/audit.service';

const prisma = new PrismaClient();

export class SelfCheckController {
  // Save self-check health scan results to user profile
  async saveSelfCheckResults(req: Request, res: Response) {
    try {
      const { healthData, scanResults, scanType, timestamp } = req.body;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Debug logging
      console.log('🔍 Received health data:', JSON.stringify(healthData, null, 2));
      console.log('🔍 Health data keys:', Object.keys(healthData || {}));
      console.log('🔍 Health data values:', Object.values(healthData || {}));

      // Verify user is a patient
      if (userRole !== Role.PATIENT) {
        return res.status(403).json({
          success: false,
          message: 'Only patients can save self-check results'
        });
      }

      // Create a self-check consultation record
      const consultationCode = this.generateSelfCheckCode(userId);
      
      const consultation = await prisma.consultation.create({
        data: {
          doctorId: userId, // For self-check, the patient is both doctor and patient
          patientId: userId,
          startTime: new Date(timestamp || new Date()),
          endTime: new Date(timestamp || new Date()),
          consultationCode,
          isPublic: false, // Self-check results are private by default
          notes: 'Self-check health scan performed by patient',
          diagnosis: 'Self-check health assessment',
          treatment: 'Continue monitoring health metrics',
          followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      });

      // Create health scan record
      const healthScan = await prisma.healthScan.create({
        data: {
          consultationId: consultation.id,
          // Map the health data to the schema fields
          bloodPressure: healthData.bloodPressure || null,
          heartRate: healthData.heartRate || null,
          spO2: healthData.spO2 || null,
          respiratoryRate: healthData.respiratoryRate || null,
          stressLevel: healthData.stressLevel || null,
          stressScore: healthData.stressScore || null,
          hrvSdnn: healthData.hrvSdnn || null,
          hrvRmsdd: healthData.hrvRmsdd || null,
          generalWellness: healthData.generalWellness || null,
          
          // Health Risk Assessment
          generalRisk: healthData.generalRisk || null,
          coronaryHeartDisease: healthData.coronaryHeartDisease || null,
          congestiveHeartFailure: healthData.congestiveHeartFailure || null,
          intermittentClaudication: healthData.intermittentClaudication || null,
          strokeRisk: healthData.strokeRisk || null,
          
          // COVID-19 Risk
          covidRisk: healthData.covidRisk || null,
          
          // Additional health parameters (if available)
          height: healthData.height || null,
          weight: healthData.weight || null,
          smoker: healthData.smoker || null,
          hypertension: healthData.hypertension || null,
          bpMedication: healthData.bpMedication || null,
          diabetic: healthData.diabetic || null,
          waistCircumference: healthData.waistCircumference || null,
          heartDisease: healthData.heartDisease || null,
          depression: healthData.depression || null,
          totalCholesterol: healthData.totalCholesterol || null,
          hdl: healthData.hdl || null,
          parentalHypertension: healthData.parentalHypertension || null,
          physicalActivity: healthData.physicalActivity || null,
          healthyDiet: healthData.healthyDiet || null,
          antiHypertensive: healthData.antiHypertensive || null,
          historyBloodGlucose: healthData.historyBloodGlucose || null,
          historyFamilyDiabetes: healthData.historyFamilyDiabetes || null
        }
      });

      // Create medical history record for the self-check
      const medicalHistory = await prisma.patientMedicalHistory.create({
        data: {
          patientId: userId,
          consultationId: consultation.id,
          recordType: 'CONSULTATION_NOTES',
          title: 'Self-Check Health Scan Results',
          content: `Self-check health scan performed on ${new Date(timestamp || new Date()).toLocaleDateString()}. Results include: ${JSON.stringify(scanResults, null, 2)}`,
          isPublic: false,
          isSensitive: true,
          createdBy: userId
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'SAVE_SELF_CHECK_RESULTS',
        'DATA_MODIFICATION',
        `Self-check health scan results saved for user ${userId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'HEALTH_SCAN',
        healthScan.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Self-check results saved successfully',
        data: {
          consultationId: consultation.id,
          healthScanId: healthScan.id,
          medicalHistoryId: medicalHistory.id,
          consultationCode: consultation.consultationCode,
          timestamp: new Date(timestamp || new Date())
        }
      });

    } catch (error) {
      console.error('Error saving self-check results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save self-check results',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get user's self-check history
  async getSelfCheckHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Verify user is a patient
      if (userRole !== Role.PATIENT) {
        return res.status(403).json({
          success: false,
          message: 'Only patients can view self-check history'
        });
      }

      // Get self-check consultations (where doctorId = patientId = userId)
      const selfCheckHistory = await prisma.consultation.findMany({
        where: {
          doctorId: userId,
          patientId: userId,
          notes: {
            contains: 'Self-check health scan'
          }
        },
        include: {
          healthScan: true,
          medicalHistory: {
            where: {
              recordType: 'CONSULTATION_NOTES',
              title: {
                contains: 'Self-Check Health Scan Results'
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: {
          selfCheckHistory,
          totalCount: selfCheckHistory.length
        }
      });

    } catch (error) {
      console.error('Error fetching self-check history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch self-check history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get specific self-check result
  async getSelfCheckResult(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Verify user is a patient
      if (userRole !== Role.PATIENT) {
        return res.status(403).json({
          success: false,
          message: 'Only patients can view self-check results'
        });
      }

      // Get self-check consultation
      const selfCheckResult = await prisma.consultation.findFirst({
        where: {
          id: Number(consultationId),
          doctorId: userId,
          patientId: userId,
          notes: {
            contains: 'Self-check health scan'
          }
        },
        include: {
          healthScan: true,
          medicalHistory: {
            where: {
              recordType: 'CONSULTATION_NOTES',
              title: {
                contains: 'Self-Check Health Scan Results'
              }
            }
          }
        }
      });

      if (!selfCheckResult) {
        return res.status(404).json({
          success: false,
          message: 'Self-check result not found or you do not have permission to view it'
        });
      }

      res.json({
        success: true,
        data: selfCheckResult
      });

    } catch (error) {
      console.error('Error fetching self-check result:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch self-check result',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete self-check result
  async deleteSelfCheckResult(req: Request, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Verify user is a patient
      if (userRole !== Role.PATIENT) {
        return res.status(403).json({
          success: false,
          message: 'Only patients can delete self-check results'
        });
      }

      // Get self-check consultation
      const selfCheckResult = await prisma.consultation.findFirst({
        where: {
          id: Number(consultationId),
          doctorId: userId,
          patientId: userId,
          notes: {
            contains: 'Self-check health scan'
          }
        }
      });

      if (!selfCheckResult) {
        return res.status(404).json({
          success: false,
          message: 'Self-check result not found or you do not have permission to delete it'
        });
      }

      // Delete related records (cascade will handle health scan and medical history)
      await prisma.consultation.delete({
        where: {
          id: Number(consultationId)
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'DELETE_SELF_CHECK_RESULT',
        'DATA_MODIFICATION',
        `Self-check result ${consultationId} deleted by user ${userId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'HEALTH_SCAN',
        consultationId
      );

      res.json({
        success: true,
        message: 'Self-check result deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting self-check result:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete self-check result',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to generate a unique self-check consultation code
  private generateSelfCheckCode(userId: number): string {
    // Create a 9-character code: SC + 2 digits from user ID + 2 digits from date + 3 random chars
    const userSuffix = (userId % 100).toString().padStart(2, '0');
    const date = new Date();
    const daySuffix = date.getDate().toString().padStart(2, '0');
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const consultationCode = `SC${userSuffix}${daySuffix}${randomChars}`;
    
    return consultationCode;
  }
}
