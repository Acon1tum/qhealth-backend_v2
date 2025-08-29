"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsController = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const audit_service_1 = require("../../shared/services/audit.service");
const prisma = new client_1.PrismaClient();
class AppointmentsController {
    // Create appointment request
    createAppointmentRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { patientId, doctorId, requestedDate, requestedTime, reason, priority, notes } = req.body;
                const userId = req.user.id;
                // Verify patient is creating their own appointment
                if (userId !== patientId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only create appointments for yourself'
                    });
                }
                // Check if doctor exists and is a doctor
                const doctor = yield prisma.user.findFirst({
                    where: { id: doctorId, role: client_2.Role.DOCTOR }
                });
                if (!doctor) {
                    return res.status(404).json({
                        success: false,
                        message: 'Doctor not found'
                    });
                }
                // Check doctor availability
                const isAvailable = yield this.checkDoctorAvailability(doctorId, requestedDate, requestedTime);
                if (!isAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: 'Doctor is not available at the requested time'
                    });
                }
                // Create appointment request
                const appointment = yield prisma.appointmentRequest.create({
                    data: {
                        patientId,
                        doctorId,
                        requestedDate: new Date(requestedDate),
                        requestedTime,
                        reason,
                        priority: priority || 'NORMAL',
                        notes
                    },
                    include: {
                        patient: {
                            select: {
                                id: true,
                                email: true,
                                patientInfo: {
                                    select: { fullName: true }
                                }
                            }
                        },
                        doctor: {
                            select: {
                                id: true,
                                email: true,
                                doctorInfo: {
                                    select: { firstName: true, lastName: true, specialization: true }
                                }
                            }
                        }
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'CREATE_APPOINTMENT_REQUEST', 'USER_ACTIVITY', `Appointment request created for ${(_a = appointment.patient.patientInfo) === null || _a === void 0 ? void 0 : _a.fullName} with Dr. ${(_b = appointment.doctor.doctorInfo) === null || _b === void 0 ? void 0 : _b.firstName} ${(_c = appointment.doctor.doctorInfo) === null || _c === void 0 ? void 0 : _c.lastName}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'APPOINTMENT_REQUEST', appointment.id.toString());
                res.status(201).json({
                    success: true,
                    message: 'Appointment request created successfully',
                    data: appointment
                });
            }
            catch (error) {
                console.error('Error creating appointment request:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create appointment request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get appointments for user (patient or doctor)
    getUserAppointments(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const { status, page = 1, limit = 10 } = req.query;
                let whereClause = {};
                if (userRole === client_2.Role.PATIENT) {
                    whereClause.patientId = userId;
                }
                else if (userRole === client_2.Role.DOCTOR) {
                    whereClause.doctorId = userId;
                }
                if (status) {
                    whereClause.status = status;
                }
                const skip = (Number(page) - 1) * Number(limit);
                const [appointments, total] = yield Promise.all([
                    prisma.appointmentRequest.findMany({
                        where: whereClause,
                        include: {
                            patient: {
                                select: {
                                    id: true,
                                    email: true,
                                    patientInfo: {
                                        select: { fullName: true, contactNumber: true }
                                    }
                                }
                            },
                            doctor: {
                                select: {
                                    id: true,
                                    email: true,
                                    doctorInfo: {
                                        select: { firstName: true, lastName: true, specialization: true }
                                    }
                                }
                            },
                            consultation: {
                                select: {
                                    id: true,
                                    startTime: true,
                                    endTime: true,
                                }
                            },
                            rescheduleRequests: {
                                where: { status: 'PENDING' },
                                orderBy: { createdAt: 'desc' }
                            }
                        },
                        orderBy: { requestedDate: 'desc' },
                        skip,
                        take: Number(limit)
                    }),
                    prisma.appointmentRequest.count({ where: whereClause })
                ]);
                res.json({
                    success: true,
                    data: appointments,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit))
                    }
                });
            }
            catch (error) {
                console.error('Error fetching appointments:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch appointments',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Doctor approves/rejects appointment request
    updateAppointmentStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appointmentId } = req.params;
                const { status, notes } = req.body;
                const userId = req.user.id;
                // Verify user is a doctor
                if (req.user.role !== client_2.Role.DOCTOR) {
                    return res.status(403).json({
                        success: false,
                        message: 'Only doctors can update appointment status'
                    });
                }
                // Get appointment and verify doctor owns it
                const appointment = yield prisma.appointmentRequest.findFirst({
                    where: { id: Number(appointmentId), doctorId: userId }
                });
                if (!appointment) {
                    return res.status(404).json({
                        success: false,
                        message: 'Appointment not found or you do not have permission'
                    });
                }
                // Update appointment status
                const updatedAppointment = yield prisma.appointmentRequest.update({
                    where: { id: Number(appointmentId) },
                    data: {
                        status,
                        updatedAt: new Date()
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
                        }
                    }
                });
                // If approved, create consultation
                if (status === client_2.AppointmentStatus.CONFIRMED) {
                    yield this.createConsultation(updatedAppointment);
                }
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_APPOINTMENT_STATUS', 'USER_ACTIVITY', `Appointment ${appointmentId} status updated to ${status}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'APPOINTMENT_REQUEST', appointmentId);
                res.json({
                    success: true,
                    message: `Appointment ${status.toLowerCase()} successfully`,
                    data: updatedAppointment
                });
            }
            catch (error) {
                console.error('Error updating appointment status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update appointment status',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Request reschedule
    requestReschedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appointmentId } = req.params;
                const { newDate, newTime, reason, notes } = req.body;
                const userId = req.user.id;
                const userRole = req.user.role;
                // Get appointment
                const appointment = yield prisma.appointmentRequest.findFirst({
                    where: {
                        id: Number(appointmentId),
                        OR: [
                            { patientId: userId },
                            { doctorId: userId }
                        ]
                    }
                });
                if (!appointment) {
                    return res.status(404).json({
                        success: false,
                        message: 'Appointment not found or you do not have permission'
                    });
                }
                // Check if appointment is confirmed
                if (appointment.status !== client_2.AppointmentStatus.CONFIRMED) {
                    return res.status(400).json({
                        success: false,
                        message: 'Can only reschedule confirmed appointments'
                    });
                }
                // Create reschedule request
                const rescheduleRequest = yield prisma.rescheduleRequest.create({
                    data: {
                        appointmentId: Number(appointmentId),
                        requestedBy: userId,
                        requestedByRole: userRole,
                        currentDate: appointment.requestedDate,
                        currentTime: appointment.requestedTime,
                        newDate: new Date(newDate),
                        newTime,
                        reason,
                        notes,
                        proposedBy: userRole === client_2.Role.PATIENT ? 'PATIENT' : 'DOCTOR'
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'REQUEST_RESCHEDULE', 'USER_ACTIVITY', `Reschedule requested for appointment ${appointmentId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'RESCHEDULE_REQUEST', rescheduleRequest.id.toString());
                res.status(201).json({
                    success: true,
                    message: 'Reschedule request created successfully',
                    data: rescheduleRequest
                });
            }
            catch (error) {
                console.error('Error requesting reschedule:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create reschedule request',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Approve/reject reschedule request
    updateRescheduleStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { rescheduleId } = req.params;
                const { status, notes } = req.body;
                const userId = req.user.id;
                // Get reschedule request
                const rescheduleRequest = yield prisma.rescheduleRequest.findFirst({
                    where: { id: Number(rescheduleId) },
                    include: { appointment: true }
                });
                if (!rescheduleRequest) {
                    return res.status(404).json({
                        success: false,
                        message: 'Reschedule request not found'
                    });
                }
                // Verify user has permission (patient or doctor of the appointment)
                if (rescheduleRequest.appointment.patientId !== userId &&
                    rescheduleRequest.appointment.doctorId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to update this reschedule request'
                    });
                }
                // Update reschedule status
                const updatedReschedule = yield prisma.rescheduleRequest.update({
                    where: { id: Number(rescheduleId) },
                    data: {
                        status,
                        notes,
                        resolvedAt: new Date()
                    }
                });
                // If approved, update appointment
                if (status === client_2.RescheduleStatus.APPROVED) {
                    yield prisma.appointmentRequest.update({
                        where: { id: rescheduleRequest.appointmentId },
                        data: {
                            requestedDate: rescheduleRequest.newDate,
                            requestedTime: rescheduleRequest.newTime,
                            status: client_2.AppointmentStatus.RESCHEDULED,
                            updatedAt: new Date()
                        }
                    });
                }
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'UPDATE_RESCHEDULE_STATUS', 'USER_ACTIVITY', `Reschedule request ${rescheduleId} ${status.toLowerCase()}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'RESCHEDULE_REQUEST', rescheduleId);
                res.json({
                    success: true,
                    message: `Reschedule request ${status.toLowerCase()} successfully`,
                    data: updatedReschedule
                });
            }
            catch (error) {
                console.error('Error updating reschedule status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update reschedule status',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Cancel appointment
    cancelAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appointmentId } = req.params;
                const { reason } = req.body;
                const userId = req.user.id;
                // Get appointment
                const appointment = yield prisma.appointmentRequest.findFirst({
                    where: {
                        id: Number(appointmentId),
                        OR: [
                            { patientId: userId },
                            { doctorId: userId }
                        ]
                    }
                });
                if (!appointment) {
                    return res.status(404).json({
                        success: false,
                        message: 'Appointment not found or you do not have permission'
                    });
                }
                // Update appointment status
                const updatedAppointment = yield prisma.appointmentRequest.update({
                    where: { id: Number(appointmentId) },
                    data: {
                        status: client_2.AppointmentStatus.CANCELLED,
                        notes: reason,
                        updatedAt: new Date()
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(userId, 'CANCEL_APPOINTMENT', 'USER_ACTIVITY', `Appointment ${appointmentId} cancelled`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'APPOINTMENT_REQUEST', appointmentId);
                res.json({
                    success: true,
                    message: 'Appointment cancelled successfully',
                    data: updatedAppointment
                });
            }
            catch (error) {
                console.error('Error cancelling appointment:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to cancel appointment',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Private method to check doctor availability
    checkDoctorAvailability(doctorId, date, time) {
        return __awaiter(this, void 0, void 0, function* () {
            const requestedDate = new Date(date);
            const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
            const schedule = yield prisma.doctorSchedule.findFirst({
                where: {
                    doctorId,
                    dayOfWeek
                }
            });
            if (!schedule)
                return false;
            // Add more sophisticated availability checking logic here
            // This is a simplified version
            return true;
        });
    }
    // Private method to create consultation
    createConsultation(appointment) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate unique consultation code (exactly 9 characters)
            const consultationCode = this.generateConsultationCode(appointment);
            yield prisma.consultation.create({
                data: {
                    doctorId: appointment.doctorId,
                    patientId: appointment.patientId,
                    startTime: appointment.requestedDate,
                    consultationCode,
                    appointmentRequest: {
                        connect: { id: appointment.id }
                    }
                }
            });
        });
    }
    // Generate unique consultation code (exactly 9 characters)
    generateConsultationCode(appointment) {
        // Format: QH-YYYYMMDD-HHMM-DOCTORID-PATIENTID-RANDOM
        const date = new Date(appointment.requestedDate);
        const dateStr = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');
        const timeStr = appointment.requestedTime.replace(':', '');
        // Create a 9-character code: QH + 2 digits from date + 2 digits from time + 3 random chars
        const daySuffix = date.getDate().toString().padStart(2, '0');
        const hourSuffix = appointment.requestedTime.split(':')[0].padStart(2, '0');
        const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
        const consultationCode = `QH${daySuffix}${hourSuffix}${randomChars}`;
        return consultationCode;
    }
}
exports.AppointmentsController = AppointmentsController;
