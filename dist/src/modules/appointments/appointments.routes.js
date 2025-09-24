"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentsRoutes = void 0;
const express_1 = require("express");
const appointments_controller_1 = require("./appointments.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.appointmentsRoutes = router;
const appointmentsController = new appointments_controller_1.AppointmentsController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAuth);
// Create appointment request (patients only)
router.post('/request', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT]), appointmentsController.createAppointmentRequest.bind(appointmentsController));
// Create appointment request by doctor for patient (doctors only)
router.post('/request-by-doctor', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), appointmentsController.createAppointmentRequestByDoctor.bind(appointmentsController));
// Get user appointments (patients and doctors)
router.get('/my-appointments', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT, client_1.Role.DOCTOR]), appointmentsController.getUserAppointments.bind(appointmentsController));
// List available doctors (patients need this to request appointments)
router.get('/doctors', 
// Any authenticated user
appointmentsController.getAvailableDoctors.bind(appointmentsController));
// Get doctor availability by doctor ID (for patients to check availability)
// This must come before parameterized routes to avoid conflicts
router.get('/doctor/:doctorId/availability', 
// Any authenticated user
appointmentsController.getDoctorAvailability.bind(appointmentsController));
// Update appointment status (doctors only)
router.patch('/:appointmentId/status', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), appointmentsController.updateAppointmentStatus.bind(appointmentsController));
// Request reschedule (patients and doctors)
router.post('/:appointmentId/reschedule', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT, client_1.Role.DOCTOR]), appointmentsController.requestReschedule.bind(appointmentsController));
// Update reschedule status (patients and doctors)
router.patch('/reschedule/:rescheduleId/status', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT, client_1.Role.DOCTOR]), appointmentsController.updateRescheduleStatus.bind(appointmentsController));
// Cancel appointment (patients and doctors)
router.patch('/:appointmentId/cancel', (0, auth_middleware_1.requireRole)([client_1.Role.PATIENT, client_1.Role.DOCTOR]), appointmentsController.cancelAppointment.bind(appointmentsController));
// Additional routes for doctor weekly availability
router.get('/my/availability', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), appointmentsController.getMyWeeklyAvailability.bind(appointmentsController));
router.put('/my/availability', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), appointmentsController.updateMyWeeklyAvailability.bind(appointmentsController));
router.post('/my/reschedule-day', (0, auth_middleware_1.requireRole)([client_1.Role.DOCTOR]), appointmentsController.requestRescheduleForDay.bind(appointmentsController));
