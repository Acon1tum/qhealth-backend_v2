import { Request, Response } from 'express';
import { PrismaClient, AuditCategory, AuditLevel } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';

const prisma = new PrismaClient();

export class PrescriptionsController {
  
  // Get available patients for prescription (doctors only)
  async getAvailablePatients(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;

      // Get all patients with their basic info
      const patients = await prisma.user.findMany({
        where: { role: 'PATIENT' },
        include: {
          patientInfo: {
            select: {
              fullName: true,
              contactNumber: true,
              bloodType: true
            }
          }
        },
        orderBy: { id: 'asc' }
      });

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_AVAILABLE_PATIENTS',
        doctorId,
        'PATIENT',
        'list',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          doctorId: doctorId,
          totalPatients: patients.length,
          userRole: 'DOCTOR',
          auditDescription: `Doctor viewed ${patients.length} available patients for prescription`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Available patients retrieved successfully',
        data: patients.map(patient => ({
          id: patient.id,
          email: patient.email,
          fullName: patient.patientInfo?.fullName || 'Unknown',
          contactNumber: patient.patientInfo?.contactNumber || '',
          bloodType: patient.patientInfo?.bloodType || '',
          createdAt: patient.createdAt
        }))
      });

    } catch (error) {
      console.error('Error getting available patients:', error);
      
      // Audit log for failure
      try {
        const doctorId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'AVAILABLE_PATIENTS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch available patients: ${error instanceof Error ? error.message : 'Unknown error'}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: doctorId,
            userRole: 'DOCTOR',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get patient info by user ID (for doctor-meet component)
  async getPatientInfoByUserId(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const doctorId = (req as any).user.id;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
        return;
      }

      // Get patient info by user ID
      const patientInfo = await prisma.patientInfo.findFirst({
        where: { userId: userId }
      });

      if (!patientInfo) {
        // Audit log for patient not found
        await AuditService.logSecurityEvent(
          'PATIENT_INFO_NOT_FOUND',
          AuditLevel.WARNING,
          `Patient info not found: ${userId}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedUserId: userId,
            doctorId: doctorId,
            userRole: 'DOCTOR'
          }
        );
        
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_PATIENT_INFO',
        doctorId,
        'PATIENT',
        userId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          requestedUserId: userId,
          doctorId: doctorId,
          patientName: patientInfo.fullName,
          userRole: 'DOCTOR',
          auditDescription: `Doctor viewed patient info for user ${userId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Patient info retrieved successfully',
        data: patientInfo
      });

    } catch (error) {
      console.error('Error getting patient info:', error);
      
      // Audit log for failure
      try {
        const userId = req.params.userId;
        const doctorId = (req as any).user.id;
        
        await AuditService.logSecurityEvent(
          'PATIENT_INFO_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch patient info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedUserId: userId,
            doctorId: doctorId,
            userRole: 'DOCTOR',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
  
  // Create a new prescription
  async createPrescription(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const {
        patientId,
        consultationId,
        medicationName,
        dosage,
        frequency,
        duration,
        instructions,
        quantity,
        refills = 0,
        expiresAt,
        notes
      } = req.body;

      // Validate required fields
      if (!patientId || !medicationName || !dosage || !frequency || !duration) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: patientId, medicationName, dosage, frequency, duration'
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

      // Create prescription
      const prescription = await prisma.prescription.create({
        data: {
          patientId: patientId,
          doctorId,
          consultationId: consultationId ? consultationId : null,
          medicationName,
          dosage,
          frequency,
          duration,
          instructions,
          quantity: quantity ? parseInt(quantity) : null,
          refills: parseInt(refills),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes
        },
        include: {
          patient: {
            include: { patientInfo: true }
          },
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        }
      });

      // Log audit event
      await AuditService.logDataModification(
        'CREATE',
        doctorId,
        'PRESCRIPTION',
        prescription.id.toString(),
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          prescriptionId: prescription.id,
          patientId: patientId,
          doctorId: doctorId,
          consultationId: consultationId ? consultationId : null,
          medicationName: medicationName,
          dosage: dosage,
          frequency: frequency,
          duration: duration,
          instructions: instructions,
          quantity: quantity ? parseInt(quantity) : null,
          refills: parseInt(refills),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes: notes,
          patientName: patient.patientInfo?.fullName,
          doctorName: prescription.doctor.doctorInfo ? `${prescription.doctor.doctorInfo.firstName} ${prescription.doctor.doctorInfo.lastName}` : prescription.doctor.email,
          auditDescription: `Prescription created for patient ${patientId}: ${medicationName}`
        }
      );

      // Send notification to patient
      await NotificationService.notifyPrescriptionIssued(
        prescription.id,
        patientId,
        doctorId,
        medicationName
      );

      res.status(201).json({
        success: true,
        message: 'Prescription created successfully',
        data: prescription
      });

    } catch (error) {
      console.error('Error creating prescription:', error);
      
      // Audit log for failure
      try {
        const doctorId = (req as any).user.id;
        const {
          patientId,
          consultationId,
          medicationName,
          dosage,
          frequency,
          duration,
          instructions,
          quantity,
          refills,
          expiresAt,
          notes
        } = req.body;
        
        await AuditService.logSecurityEvent(
          'PRESCRIPTION_CREATION_FAILED',
          AuditLevel.ERROR,
          `Failed to create prescription: ${error instanceof Error ? error.message : 'Unknown error'}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: doctorId,
            patientId: patientId,
            consultationId: consultationId,
            medicationName: medicationName,
            dosage: dosage,
            frequency: frequency,
            duration: duration,
            instructions: instructions,
            quantity: quantity,
            refills: refills,
            expiresAt: expiresAt,
            notes: notes,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get prescriptions for a specific patient
  async getPatientPrescriptions(req: Request, res: Response): Promise<void> {
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
        // Audit log for patient not found
        await AuditService.logSecurityEvent(
          'PATIENT_NOT_FOUND_FOR_PRESCRIPTIONS',
          AuditLevel.WARNING,
          `Patient not found for prescriptions: ${patientId}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPatientId: patientId,
            requestingUserId: userId,
            userRole: userRole
          }
        );
        
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
          message: 'Access denied: You can only view your own prescriptions'
        });
        return;
      }

      // Get prescriptions
      const prescriptions = await prisma.prescription.findMany({
        where: { patientId },
        include: {
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        },
        orderBy: { prescribedAt: 'desc' }
      });

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_PATIENT_PRESCRIPTIONS',
        userId,
        'PRESCRIPTION',
        patientId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          patientId: patientId,
          patientName: patient.patientInfo?.fullName,
          totalPrescriptions: prescriptions.length,
          requestingUserId: userId,
          userRole: userRole,
          auditDescription: `Viewed ${prescriptions.length} prescriptions for patient ${patientId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Prescriptions retrieved successfully',
        data: prescriptions
      });

    } catch (error) {
      console.error('Error getting patient prescriptions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get prescriptions by a specific doctor
  async getDoctorPrescriptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const doctorId = req.params.doctorId;

      // Verify doctor exists
      const doctor = await prisma.user.findUnique({
        where: { id: doctorId },
        include: { doctorInfo: true }
      });

      if (!doctor || doctor.role !== 'DOCTOR') {
        // Audit log for doctor not found
        await AuditService.logSecurityEvent(
          'DOCTOR_NOT_FOUND_FOR_PRESCRIPTIONS',
          AuditLevel.WARNING,
          `Doctor not found for prescriptions: ${doctorId}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedDoctorId: doctorId,
            requestingUserId: userId,
            userRole: 'DOCTOR'
          }
        );
        
        res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
        return;
      }

      // Check access permissions
      if (userId !== doctorId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_DOCTOR_PRESCRIPTION_ACCESS',
          AuditLevel.WARNING,
          `Doctor attempted to access another doctor's prescriptions`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedDoctorId: doctorId,
            requestingUserId: userId,
            userRole: 'DOCTOR',
            accessAttempt: 'view_doctor_prescriptions'
          }
        );
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own prescriptions'
        });
        return;
      }

      // Get prescriptions
      const prescriptions = await prisma.prescription.findMany({
        where: { doctorId },
        include: {
          patient: {
            include: { patientInfo: true }
          },
          consultation: true
        },
        orderBy: { prescribedAt: 'desc' }
      });

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_DOCTOR_PRESCRIPTIONS',
        userId,
        'PRESCRIPTION',
        doctorId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          doctorId: doctorId,
          doctorName: doctor.doctorInfo ? `${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}` : doctor.email,
          totalPrescriptions: prescriptions.length,
          requestingUserId: userId,
          userRole: 'DOCTOR',
          auditDescription: `Doctor viewed ${prescriptions.length} prescriptions for doctor ${doctorId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Prescriptions retrieved successfully',
        data: prescriptions
      });

    } catch (error) {
      console.error('Error getting doctor prescriptions:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user.id;
        const doctorId = req.params.doctorId;
        
        await AuditService.logSecurityEvent(
          'DOCTOR_PRESCRIPTIONS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch doctor prescriptions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            doctorId: doctorId,
            requestingUserId: userId,
            userRole: 'DOCTOR',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get prescription by ID
  async getPrescriptionById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const prescriptionId = req.params.id;

      // Get prescription
      const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
          patient: {
            include: { patientInfo: true }
          },
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        }
      });

      if (!prescription) {
        // Audit log for prescription not found
        await AuditService.logSecurityEvent(
          'PRESCRIPTION_NOT_FOUND',
          AuditLevel.WARNING,
          `Prescription not found: ${prescriptionId}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPrescriptionId: prescriptionId,
            requestingUserId: userId,
            userRole: userRole
          }
        );
        
        res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
        return;
      }

      // Check access permissions
      if (userRole === 'PATIENT' && prescription.patientId !== userId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_PRESCRIPTION_VIEW',
          AuditLevel.WARNING,
          `Patient attempted to view another patient's prescription`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPrescriptionId: prescriptionId,
            prescriptionPatientId: prescription.patientId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_prescription'
          }
        );
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own prescriptions'
        });
        return;
      }

      if (userRole === 'DOCTOR' && prescription.doctorId !== userId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_PRESCRIPTION_VIEW',
          AuditLevel.WARNING,
          `Doctor attempted to view another doctor's prescription`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedPrescriptionId: prescriptionId,
            prescriptionDoctorId: prescription.doctorId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_prescription'
          }
        );
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view prescriptions you created'
        });
        return;
      }

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_PRESCRIPTION',
        userId,
        'PRESCRIPTION',
        prescriptionId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          prescriptionId: prescriptionId,
          patientId: prescription.patientId,
          doctorId: prescription.doctorId,
          consultationId: prescription.consultationId,
          medicationName: prescription.medicationName,
          patientName: prescription.patient.patientInfo?.fullName,
          doctorName: prescription.doctor.doctorInfo ? `${prescription.doctor.doctorInfo.firstName} ${prescription.doctor.doctorInfo.lastName}` : prescription.doctor.email,
          requestingUserId: userId,
          userRole: userRole,
          auditDescription: `Viewed prescription: ${prescriptionId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Prescription retrieved successfully',
        data: prescription
      });

    } catch (error) {
      console.error('Error getting prescription:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;
        const prescriptionId = req.params.id;
        
        await AuditService.logSecurityEvent(
          'PRESCRIPTION_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch prescription: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            prescriptionId: prescriptionId,
            requestingUserId: userId,
            userRole: userRole,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Update prescription
  async updatePrescription(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const prescriptionId = req.params.id;
      const updateData = req.body;

      // Get existing prescription
      const existingPrescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId }
      });

      if (!existingPrescription) {
        res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
        return;
      }

      // Check if doctor owns this prescription
      if (existingPrescription.doctorId !== doctorId) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only update prescriptions you created'
        });
        return;
      }

      // Prepare update data
      const updateFields: any = {};
      if (updateData.medicationName) updateFields.medicationName = updateData.medicationName;
      if (updateData.dosage) updateFields.dosage = updateData.dosage;
      if (updateData.frequency) updateFields.frequency = updateData.frequency;
      if (updateData.duration) updateFields.duration = updateData.duration;
      if (updateData.instructions !== undefined) updateFields.instructions = updateData.instructions;
      if (updateData.quantity !== undefined) updateFields.quantity = updateData.quantity ? parseInt(updateData.quantity) : null;
      if (updateData.refills !== undefined) updateFields.refills = parseInt(updateData.refills);
      if (updateData.expiresAt !== undefined) updateFields.expiresAt = updateData.expiresAt ? new Date(updateData.expiresAt) : null;
      if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
      if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

      // Update prescription
      const updatedPrescription = await prisma.prescription.update({
        where: { id: prescriptionId },
        data: updateFields,
        include: {
          patient: {
            include: { patientInfo: true }
          },
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        }
      });

      // Log audit event
      await AuditService.logDataModification(
        'UPDATE',
        doctorId,
        'PRESCRIPTION',
        prescriptionId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          prescriptionId: prescriptionId,
          patientId: existingPrescription.patientId,
          doctorId: doctorId,
          oldMedicationName: existingPrescription.medicationName,
          newMedicationName: updateFields.medicationName,
          oldDosage: existingPrescription.dosage,
          newDosage: updateFields.dosage,
          oldFrequency: existingPrescription.frequency,
          newFrequency: updateFields.frequency,
          oldDuration: existingPrescription.duration,
          newDuration: updateFields.duration,
          oldInstructions: existingPrescription.instructions,
          newInstructions: updateFields.instructions,
          oldQuantity: existingPrescription.quantity,
          newQuantity: updateFields.quantity,
          oldRefills: existingPrescription.refills,
          newRefills: updateFields.refills,
          oldExpiresAt: existingPrescription.expiresAt,
          newExpiresAt: updateFields.expiresAt,
          oldNotes: existingPrescription.notes,
          newNotes: updateFields.notes,
          oldIsActive: existingPrescription.isActive,
          newIsActive: updateFields.isActive,
          updatedBy: doctorId,
          auditDescription: `Prescription updated: ${prescriptionId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Prescription updated successfully',
        data: updatedPrescription
      });

    } catch (error) {
      console.error('Error updating prescription:', error);
      
      // Audit log for failure
      try {
        const doctorId = (req as any).user.id;
        const prescriptionId = req.params.id;
        const updateData = req.body;
        
        await AuditService.logSecurityEvent(
          'PRESCRIPTION_UPDATE_FAILED',
          AuditLevel.ERROR,
          `Failed to update prescription: ${error instanceof Error ? error.message : 'Unknown error'}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            prescriptionId: prescriptionId,
            doctorId: doctorId,
            updateData: updateData,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Delete prescription
  async deletePrescription(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const prescriptionId = req.params.id;

      // Get existing prescription
      const existingPrescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId }
      });

      if (!existingPrescription) {
        res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
        return;
      }

      // Check if doctor owns this prescription
      if (existingPrescription.doctorId !== doctorId) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only delete prescriptions you created'
        });
        return;
      }

      // Delete prescription
      await prisma.prescription.delete({
        where: { id: prescriptionId }
      });

      // Log audit event
      await AuditService.logDataModification(
        'DELETE',
        doctorId,
        'PRESCRIPTION',
        prescriptionId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          prescriptionId: prescriptionId,
          patientId: existingPrescription.patientId,
          doctorId: doctorId,
          consultationId: existingPrescription.consultationId,
          medicationName: existingPrescription.medicationName,
          dosage: existingPrescription.dosage,
          frequency: existingPrescription.frequency,
          duration: existingPrescription.duration,
          instructions: existingPrescription.instructions,
          quantity: existingPrescription.quantity,
          refills: existingPrescription.refills,
          expiresAt: existingPrescription.expiresAt,
          notes: existingPrescription.notes,
          isActive: existingPrescription.isActive,
          prescribedAt: existingPrescription.prescribedAt,
          deletedBy: doctorId,
          deletedAt: new Date(),
          auditDescription: `Prescription deleted: ${prescriptionId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Prescription deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting prescription:', error);
      
      // Audit log for failure
      try {
        const doctorId = (req as any).user.id;
        const prescriptionId = req.params.id;
        
        await AuditService.logSecurityEvent(
          'PRESCRIPTION_DELETE_FAILED',
          AuditLevel.ERROR,
          `Failed to delete prescription: ${error instanceof Error ? error.message : 'Unknown error'}`,
          doctorId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            prescriptionId: prescriptionId,
            doctorId: doctorId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Get prescriptions for a consultation
  async getConsultationPrescriptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const consultationId = req.params.consultationId;

      // Get consultation
      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId },
        include: {
          doctor: true,
          patient: true
        }
      });

      if (!consultation) {
        // Audit log for consultation not found
        await AuditService.logSecurityEvent(
          'CONSULTATION_NOT_FOUND_FOR_PRESCRIPTIONS',
          AuditLevel.WARNING,
          `Consultation not found for prescriptions: ${consultationId}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedConsultationId: consultationId,
            requestingUserId: userId,
            userRole: userRole
          }
        );
        
        res.status(404).json({
          success: false,
          message: 'Consultation not found'
        });
        return;
      }

      // Check access permissions
      if (userRole === 'PATIENT' && consultation.patientId !== userId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_CONSULTATION_PRESCRIPTION_ACCESS',
          AuditLevel.WARNING,
          `Patient attempted to access prescriptions from another patient's consultation`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedConsultationId: consultationId,
            consultationPatientId: consultation.patientId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_consultation_prescriptions'
          }
        );
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view prescriptions from your own consultations'
        });
        return;
      }

      if (userRole === 'DOCTOR' && consultation.doctorId !== userId) {
        // Audit log for unauthorized access attempt
        await AuditService.logSecurityEvent(
          'UNAUTHORIZED_CONSULTATION_PRESCRIPTION_ACCESS',
          AuditLevel.WARNING,
          `Doctor attempted to access prescriptions from another doctor's consultation`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            requestedConsultationId: consultationId,
            consultationDoctorId: consultation.doctorId,
            requestingUserId: userId,
            userRole: userRole,
            accessAttempt: 'view_consultation_prescriptions'
          }
        );
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view prescriptions from your own consultations'
        });
        return;
      }

      // Get prescriptions for consultation
      const prescriptions = await prisma.prescription.findMany({
        where: { consultationId },
        include: {
          patient: {
            include: { patientInfo: true }
          },
          doctor: {
            include: { doctorInfo: true }
          },
          consultation: true
        },
        orderBy: { prescribedAt: 'desc' }
      });

      // Audit log for successful access
      await AuditService.logDataAccess(
        'VIEW_CONSULTATION_PRESCRIPTIONS',
        userId,
        'PRESCRIPTION',
        consultationId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          consultationId: consultationId,
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          totalPrescriptions: prescriptions.length,
          requestingUserId: userId,
          userRole: userRole,
          auditDescription: `Viewed ${prescriptions.length} prescriptions for consultation ${consultationId}`
        }
      );

      res.status(200).json({
        success: true,
        message: 'Consultation prescriptions retrieved successfully',
        data: prescriptions
      });

    } catch (error) {
      console.error('Error getting consultation prescriptions:', error);
      
      // Audit log for failure
      try {
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;
        const consultationId = req.params.consultationId;
        
        await AuditService.logSecurityEvent(
          'CONSULTATION_PRESCRIPTIONS_FETCH_FAILED',
          AuditLevel.ERROR,
          `Failed to fetch consultation prescriptions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            consultationId: consultationId,
            requestingUserId: userId,
            userRole: userRole,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
}

export default PrescriptionsController;