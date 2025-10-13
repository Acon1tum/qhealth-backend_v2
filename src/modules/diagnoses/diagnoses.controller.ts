import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Role, DiagnosisSeverity, DiagnosisStatus } from '@prisma/client';
import { AuditService } from '../../shared/services/audit.service';
import { NotificationService } from '../notifications/notification.service';

const prisma = new PrismaClient();

export class DiagnosesController {
  
  // Create a new diagnosis
  async createDiagnosis(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const {
        patientId,
        consultationId,
        diagnosisCode,
        diagnosisName,
        description,
        severity = DiagnosisSeverity.MILD,
        status = DiagnosisStatus.ACTIVE,
        onsetDate,
        resolvedAt,
        notes,
        isPrimary = false
      } = req.body;

      // Validate required fields
      if (!patientId || !diagnosisName) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: patientId, diagnosisName'
        });
        return;
      }

      // Verify patient exists
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        include: { patientInfo: true }
      });

      if (!patient || patient.role !== 'PATIENT') {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Verify consultation exists if provided
      if (consultationId) {
        const consultation = await prisma.consultation.findUnique({
          where: { id: consultationId }
        });

        if (!consultation) {
          res.status(404).json({
            success: false,
            message: 'Consultation not found'
          });
          return;
        }
      }

      // Create diagnosis
      const diagnosis = await prisma.diagnosis.create({
        data: {
          patientId: patientId,
          doctorId,
          consultationId: consultationId ? consultationId : null,
          diagnosisCode: diagnosisCode || null,
          diagnosisName,
          description: description || null,
          severity,
          status,
          onsetDate: onsetDate ? new Date(onsetDate) : null,
          diagnosedAt: new Date(),
          resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
          notes: notes || null,
          isPrimary
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
          },
          consultation: {
            select: {
              id: true,
              consultationCode: true
            }
          }
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        doctorId,
        'CREATE_DIAGNOSIS',
        'DATA_MODIFICATION',
        `Diagnosis created for patient ${diagnosis.patient.patientInfo?.fullName}: ${diagnosisName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'DIAGNOSIS',
        diagnosis.id.toString()
      );

      // Send notification to patient
      await NotificationService.notifyDiagnosisAdded(
        diagnosis.id,
        patientId,
        doctorId,
        diagnosisName
      );

      res.status(201).json({
        success: true,
        message: 'Diagnosis created successfully',
        data: diagnosis
      });

    } catch (error) {
      console.error('Error creating diagnosis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create diagnosis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get diagnoses for a specific patient
  async getPatientDiagnoses(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const patientId = req.params.patientId;

      // Verify patient exists
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        include: { patientInfo: true }
      });

      if (!patient || patient.role !== 'PATIENT') {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Check access permissions
      if (userRole === 'PATIENT' && userId !== patientId) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own diagnoses'
        });
        return;
      }

      // Get diagnoses
      const diagnoses = await prisma.diagnosis.findMany({
        where: { patientId },
        include: {
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        },
        orderBy: { diagnosedAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        message: 'Diagnoses retrieved successfully',
        data: diagnoses
      });

    } catch (error) {
      console.error('Error getting patient diagnoses:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get diagnoses by a specific doctor
  async getDoctorDiagnoses(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;

      // Get diagnoses
      const diagnoses = await prisma.diagnosis.findMany({
        where: { doctorId },
        include: {
          patient: {
            include: { patientInfo: true }
          },
          consultation: true
        },
        orderBy: { diagnosedAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        message: 'Diagnoses retrieved successfully',
        data: diagnoses
      });

    } catch (error) {
      console.error('Error getting doctor diagnoses:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Update diagnosis
  async updateDiagnosis(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const diagnosisId = req.params.diagnosisId;
      const {
        diagnosisCode,
        diagnosisName,
        description,
        severity,
        status,
        onsetDate,
        resolvedAt,
        notes,
        isPrimary
      } = req.body;

      // Verify diagnosis exists and doctor owns it
      const existingDiagnosis = await prisma.diagnosis.findFirst({
        where: { id: diagnosisId, doctorId }
      });

      if (!existingDiagnosis) {
        res.status(404).json({
          success: false,
          message: 'Diagnosis not found or access denied'
        });
        return;
      }

      // Update diagnosis
      const diagnosis = await prisma.diagnosis.update({
        where: { id: diagnosisId },
        data: {
          diagnosisCode: diagnosisCode !== undefined ? diagnosisCode : existingDiagnosis.diagnosisCode,
          diagnosisName: diagnosisName || existingDiagnosis.diagnosisName,
          description: description !== undefined ? description : existingDiagnosis.description,
          severity: severity || existingDiagnosis.severity,
          status: status || existingDiagnosis.status,
          onsetDate: onsetDate ? new Date(onsetDate) : existingDiagnosis.onsetDate,
          resolvedAt: resolvedAt ? new Date(resolvedAt) : existingDiagnosis.resolvedAt,
          notes: notes !== undefined ? notes : existingDiagnosis.notes,
          isPrimary: isPrimary !== undefined ? isPrimary : existingDiagnosis.isPrimary
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
          },
          consultation: {
            select: {
              id: true,
              consultationCode: true
            }
          }
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        doctorId,
        'UPDATE_DIAGNOSIS',
        'DATA_MODIFICATION',
        `Diagnosis updated: ${diagnosisName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'DIAGNOSIS',
        diagnosis.id.toString()
      );

      res.status(200).json({
        success: true,
        message: 'Diagnosis updated successfully',
        data: diagnosis
      });

    } catch (error) {
      console.error('Error updating diagnosis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update diagnosis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete diagnosis
  async deleteDiagnosis(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const diagnosisId = req.params.diagnosisId;

      // Verify diagnosis exists and doctor owns it
      const existingDiagnosis = await prisma.diagnosis.findFirst({
        where: { id: diagnosisId, doctorId }
      });

      if (!existingDiagnosis) {
        res.status(404).json({
          success: false,
          message: 'Diagnosis not found or access denied'
        });
        return;
      }

      // Delete diagnosis
      await prisma.diagnosis.delete({
        where: { id: diagnosisId }
      });

      // Audit log
      await AuditService.logUserActivity(
        doctorId,
        'DELETE_DIAGNOSIS',
        'DATA_MODIFICATION',
        `Diagnosis deleted: ${existingDiagnosis.diagnosisName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'DIAGNOSIS',
        diagnosisId.toString()
      );

      res.status(200).json({
        success: true,
        message: 'Diagnosis deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete diagnosis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
