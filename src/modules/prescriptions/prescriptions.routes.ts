import { Router } from 'express';
import PrescriptionsController from './prescriptions.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const prescriptionsController = new PrescriptionsController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Get available patients (doctors only)
router.get('/patients', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.getAvailablePatients.bind(prescriptionsController)
);

// Get patient info by user ID (for doctor-meet component)
router.get('/patient-info/:userId', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.getPatientInfoByUserId.bind(prescriptionsController)
);

// Create prescription (doctors only)
router.post('/create', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.createPrescription.bind(prescriptionsController)
);

// Get prescriptions for a patient (patients and doctors with access)
router.get('/patient/:patientId', 
  prescriptionsController.getPatientPrescriptions.bind(prescriptionsController)
);

// Get prescriptions by doctor (doctors only)
router.get('/doctor/:doctorId', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.getDoctorPrescriptions.bind(prescriptionsController)
);

// Get prescription details (patients and doctors with access)
router.get('/:id', 
  prescriptionsController.getPrescriptionById.bind(prescriptionsController)
);

// Update prescription (doctors only)
router.put('/:id', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.updatePrescription.bind(prescriptionsController)
);

// Delete prescription (doctors only)
router.delete('/:id', 
  requireRole([Role.DOCTOR]), 
  prescriptionsController.deletePrescription.bind(prescriptionsController)
);

// Get prescriptions for a consultation (doctors and patients with access)
router.get('/consultation/:consultationId', 
  prescriptionsController.getConsultationPrescriptions.bind(prescriptionsController)
);

export { router as prescriptionsRoutes };
