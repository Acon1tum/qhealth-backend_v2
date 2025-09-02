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

// List available doctors (patients need this to request appointments)
router.get('/doctors', 
  // Any authenticated user
  appointmentsController.getAvailableDoctors.bind(appointmentsController)
);

// Get doctor availability by doctor ID (for patients to check availability)
// This must come before parameterized routes to avoid conflicts
router.get('/doctor/:doctorId/availability', 
  // Any authenticated user
  appointmentsController.getDoctorAvailability.bind(appointmentsController)
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

// Additional routes for doctor weekly availability
router.get('/my/availability', 
  requireRole([Role.DOCTOR]), 
  appointmentsController.getMyWeeklyAvailability.bind(appointmentsController)
);

router.put('/my/availability', 
  requireRole([Role.DOCTOR]), 
  appointmentsController.updateMyWeeklyAvailability.bind(appointmentsController)
);

router.post('/my/reschedule-day', 
  requireRole([Role.DOCTOR]), 
  appointmentsController.requestRescheduleForDay.bind(appointmentsController)
);

export { router as appointmentsRoutes };
