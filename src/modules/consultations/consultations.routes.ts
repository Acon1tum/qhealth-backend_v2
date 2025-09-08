import { Router } from 'express';
import { ConsultationsController } from './consultations.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const consultationsController = new ConsultationsController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Create consultation from appointment (doctors only)
router.post('/create', 
  requireRole([Role.DOCTOR]), 
  consultationsController.createConsultation.bind(consultationsController)
);

// Create direct consultation from doctor-meet (doctors only)
router.post('/create-direct', 
  requireRole([Role.DOCTOR]), 
  consultationsController.createDirectConsultation.bind(consultationsController)
);

// Get consultation details (patients and doctors with access)
router.get('/:consultationId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  consultationsController.getConsultation.bind(consultationsController)
);

// Update consultation (doctors only)
router.put('/:consultationId', 
  requireRole([Role.DOCTOR]), 
  consultationsController.updateConsultation.bind(consultationsController)
);

// Create health scan (doctors only)
router.post('/health-scan', 
  requireRole([Role.DOCTOR]), 
  consultationsController.createHealthScan.bind(consultationsController)
);

// Get health scan (patients and doctors with access)
router.get('/health-scan/:scanId', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  consultationsController.getHealthScan.bind(consultationsController)
);

// Join consultation with code validation (patients and doctors)
router.post('/join', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  consultationsController.joinConsultation.bind(consultationsController)
);

// Update consultation privacy settings (patient or doctor)
router.patch('/:consultationId/privacy', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  consultationsController.updateConsultationPrivacy.bind(consultationsController)
);

// Share consultation with specific doctor (patient or doctor)
router.post('/:consultationId/share', 
  requireRole([Role.DOCTOR, Role.PATIENT]), 
  consultationsController.shareConsultation.bind(consultationsController)
);

export { router as consultationsRoutes };
