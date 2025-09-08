import { Router } from 'express';
import { DiagnosesController } from './diagnoses.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const diagnosesController = new DiagnosesController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Create diagnosis (doctors only)
router.post('/create', 
  requireRole([Role.DOCTOR]), 
  diagnosesController.createDiagnosis.bind(diagnosesController)
);

// Get diagnoses for a specific patient
router.get('/patient/:patientId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  diagnosesController.getPatientDiagnoses.bind(diagnosesController)
);

// Get diagnoses by a specific doctor
router.get('/doctor', 
  requireRole([Role.DOCTOR]), 
  diagnosesController.getDoctorDiagnoses.bind(diagnosesController)
);

// Update diagnosis (doctors only)
router.put('/:diagnosisId', 
  requireRole([Role.DOCTOR]), 
  diagnosesController.updateDiagnosis.bind(diagnosesController)
);

// Delete diagnosis (doctors only)
router.delete('/:diagnosisId', 
  requireRole([Role.DOCTOR]), 
  diagnosesController.deleteDiagnosis.bind(diagnosesController)
);

export { router as diagnosesRoutes };
