import { Router } from 'express';
import { MedicalRecordsController } from './medical-records.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const medicalRecordsController = new MedicalRecordsController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Create medical record (doctors and patients)
router.post('/create', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.createMedicalRecord.bind(medicalRecordsController)
);

// Get patient medical records (doctors and patients)
router.get('/patient/:patientId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.getPatientMedicalRecords.bind(medicalRecordsController)
);

// Update medical record (creator only)
router.put('/:recordId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.updateMedicalRecord.bind(medicalRecordsController)
);

// Update privacy settings (patient or creator)
router.patch('/:recordId/privacy', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.updatePrivacySettings.bind(medicalRecordsController)
);

// Share medical record with specific doctor
router.post('/:recordId/share', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.shareMedicalRecord.bind(medicalRecordsController)
);

// Delete medical record (patient or creator)
router.delete('/:recordId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  medicalRecordsController.deleteMedicalRecord.bind(medicalRecordsController)
);

export { router as medicalRecordsRoutes }; 
