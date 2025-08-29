import { Router } from 'express';
import { AppointmentsController } from './appointments.controller';
import { authenticateToken, requireAuth, requireRole } from '../../shared/middleware/auth-middleware';
import { Role } from '@prisma/client';

const router = Router();
const appointmentsController = new AppointmentsController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAuth);

// Create appointment request (patients only)
router.post('/request', 
  requireRole([Role.PATIENT]), 
  appointmentsController.createAppointmentRequest.bind(appointmentsController)
);

// Get user appointments (patients and doctors)
router.get('/my-appointments', 
  requireRole([Role.PATIENT, Role.DOCTOR]), 
  appointmentsController.getUserAppointments.bind(appointmentsController)
);

// Update appointment status (doctors only)
router.patch('/:appointmentId/status', 
  requireRole([Role.DOCTOR]), 
  appointmentsController.updateAppointmentStatus.bind(appointmentsController)
);

// Request reschedule (patients and doctors)
router.post('/:appointmentId/reschedule', 
  requireRole([Role.PATIENT, Role.DOCTOR]), 
  appointmentsController.requestReschedule.bind(appointmentsController)
);

// Update reschedule status (patients and doctors)
router.patch('/reschedule/:rescheduleId/status', 
  requireRole([Role.PATIENT, Role.DOCTOR]), 
  appointmentsController.updateRescheduleStatus.bind(appointmentsController)
);

// Cancel appointment (patients and doctors)
router.patch('/:appointmentId/cancel', 
  requireRole([Role.PATIENT, Role.DOCTOR]), 
  appointmentsController.cancelAppointment.bind(appointmentsController)
);

export { router as appointmentsRoutes };
