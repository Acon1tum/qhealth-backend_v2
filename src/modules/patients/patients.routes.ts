import { Router } from 'express';
import { PatientsController } from './patients.controller';
import { authenticateToken, requireAuth } from '../../shared/middleware/auth-middleware';

const router = Router();
const controller = new PatientsController();

// Public list and read endpoints (listing patients doesn't expose sensitive data)
router.get('/', controller.listPatients.bind(controller));
router.get('/:id', controller.getPatientById.bind(controller));

// Protected write endpoints
router.post('/', authenticateToken, requireAuth, controller.createPatient.bind(controller));
router.put('/:id', authenticateToken, requireAuth, controller.updatePatient.bind(controller));
router.delete('/:id', authenticateToken, requireAuth, controller.deletePatient.bind(controller));

// Additional patient-specific endpoints
router.get('/:id/medical-history', authenticateToken, requireAuth, controller.getPatientMedicalHistory.bind(controller));
router.get('/:id/appointments', authenticateToken, requireAuth, controller.getPatientAppointments.bind(controller));

export { router as patientsRoutes };
