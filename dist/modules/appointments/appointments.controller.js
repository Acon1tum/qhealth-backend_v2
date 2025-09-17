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
                // console.log('Received appointment request:', { patientId, doctorId, requestedDate, requestedTime, reason, priority, notes });
                // Validate required fields
                if (!patientId || !doctorId || !requestedDate || !requestedTime || !reason) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields: patientId, doctorId, requestedDate, requestedTime, reason'
                    });
                }
                // Validate UUID format for IDs
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(patientId) || !uuidRegex.test(doctorId)) {
                    return res.status(400).json({ success: false, message: 'Invalid patientId or doctorId format' });
                }
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
                // Validate date format
                const parsedDate = new Date(requestedDate);
                if (isNaN(parsedDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid date format'
                    });
                }
                // Validate time format
                if (!requestedTime || !/\d{2}:\d{2}/.test(requestedTime)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid time format. Expected HH:MM'
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
                // Check for existing appointment conflicts
                const hasConflict = yield this.checkAppointmentConflict(doctorId, parsedDate, requestedTime);
                if (hasConflict) {
                    return res.status(400).json({
                        success: false,
                        message: 'Doctor already has an appointment at this time'
                    });
                }
                // Create appointment request
                const appointment = yield prisma.appointmentRequest.create({
                    data: {
                        patientId: patientId,
                        doctorId: doctorId,
                        requestedDate: parsedDate, // Use the already validated parsed date
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
                    where: { id: appointmentId, doctorId: userId }
                });
                if (!appointment) {
                    return res.status(404).json({
                        success: false,
                        message: 'Appointment not found or you do not have permission'
                    });
                }
                // Update appointment status
                const updatedAppointment = yield prisma.appointmentRequest.update({
                    where: { id: appointmentId },
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
                        id: appointmentId,
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
                        appointmentId: appointmentId,
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
                    where: { id: rescheduleId },
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
                    where: { id: rescheduleId },
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
                        id: appointmentId,
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
                    where: { id: appointmentId },
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
            // console.log('Checking doctor availability:', { doctorId, date, time });
            const requestedDate = new Date(date);
            const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
            // console.log('Parsed date and day:', { requestedDate, dayOfWeek });
            const schedule = yield prisma.doctorSchedule.findFirst({
                where: {
                    doctorId,
                    dayOfWeek,
                    isAvailable: true
                }
            });
            // console.log('Found schedule:', schedule);
            if (!schedule)
                return false;
            // Basic time window check if requestedTime is HH:mm
            if (time && /\d{2}:\d{2}/.test(time)) {
                const [hours, minutes] = time.split(':').map(Number);
                const requestedStart = new Date(requestedDate);
                requestedStart.setHours(hours, minutes, 0, 0);
                // Extract time components from schedule (they're stored as DateTime but we only care about time)
                const scheduleStart = new Date(schedule.startTime);
                const scheduleEnd = new Date(schedule.endTime);
                // Create comparable times for the same date
                const scheduleStartTime = new Date(requestedDate);
                scheduleStartTime.setHours(scheduleStart.getHours(), scheduleStart.getMinutes(), 0, 0);
                const scheduleEndTime = new Date(requestedDate);
                scheduleEndTime.setHours(scheduleEnd.getHours(), scheduleEnd.getMinutes(), 0, 0);
                // console.log('Time comparison:', {
                //   requestedStart,
                //   scheduleStartTime,
                //   scheduleEndTime,
                //   startOk: requestedStart >= scheduleStartTime,
                //   endOk: requestedStart <= scheduleEndTime
                // });
                const startOk = requestedStart >= scheduleStartTime;
                const endOk = requestedStart <= scheduleEndTime;
                return startOk && endOk;
            }
            return true;
        });
    }
    // Check for appointment conflicts
    checkAppointmentConflict(doctorId, requestedDate, requestedTime) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log('Checking appointment conflict:', { doctorId, requestedDate, requestedTime });
            // Parse the requested time
            const [hours, minutes] = requestedTime.split(':').map(Number);
            const requestedStart = new Date(requestedDate);
            requestedStart.setHours(hours, minutes, 0, 0);
            // Check for existing appointments on the same date and time
            const existingAppointments = yield prisma.appointmentRequest.findMany({
                where: {
                    doctorId,
                    requestedDate: {
                        gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
                        lt: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1)
                    },
                    status: {
                        in: [client_2.AppointmentStatus.PENDING, client_2.AppointmentStatus.CONFIRMED]
                    }
                }
            });
            // console.log('Found existing appointments:', existingAppointments);
            // Check if any existing appointment conflicts with the requested time
            for (const appointment of existingAppointments) {
                const [existingHours, existingMinutes] = appointment.requestedTime.split(':').map(Number);
                const existingStart = new Date(appointment.requestedDate);
                existingStart.setHours(existingHours, existingMinutes, 0, 0);
                // Check if times are within 30 minutes of each other (assuming 30-min appointment slots)
                const timeDiff = Math.abs(requestedStart.getTime() - existingStart.getTime());
                const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
                if (timeDiff < thirtyMinutes) {
                    // console.log('Conflict found:', { requestedStart, existingStart, timeDiff });
                    return true;
                }
            }
            return false;
        });
    }
    // Get weekly availability for the authenticated doctor
    getMyWeeklyAvailability(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (req.user.role !== client_2.Role.DOCTOR) {
                    return res.status(403).json({ success: false, message: 'Only doctors can view availability' });
                }
                const doctorId = req.user.id;
                const schedules = yield prisma.doctorSchedule.findMany({
                    where: { doctorId },
                    orderBy: { id: 'asc' }
                });
                // Check for existing appointments in the next 4 weeks for each day
                const today = new Date();
                const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
                const existingAppointments = yield prisma.appointmentRequest.findMany({
                    where: {
                        doctorId,
                        requestedDate: {
                            gte: today,
                            lte: fourWeeksFromNow
                        },
                        status: {
                            in: [client_2.AppointmentStatus.CONFIRMED, client_2.AppointmentStatus.PENDING]
                        }
                    },
                    select: {
                        id: true,
                        requestedDate: true,
                        requestedTime: true,
                        patient: {
                            select: {
                                id: true,
                                patientInfo: { select: { fullName: true } }
                            }
                        }
                    }
                });
                // Group appointments by day of week
                const appointmentsByDay = new Map();
                existingAppointments.forEach(apt => {
                    const dayOfWeek = apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
                    if (!appointmentsByDay.has(dayOfWeek)) {
                        appointmentsByDay.set(dayOfWeek, []);
                    }
                    appointmentsByDay.get(dayOfWeek).push(apt);
                });
                // Ensure all days exist (Monday-Sunday). If missing, return defaults with isAvailable=false
                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));
                const normalized = days.map(day => {
                    const schedule = byDay.get(day) || {
                        id: 0,
                        doctorId,
                        dayOfWeek: day,
                        startTime: new Date('1970-01-01T09:00:00Z'),
                        endTime: new Date('1970-01-01T17:00:00Z'),
                        isAvailable: false
                    };
                    const dayAppointments = appointmentsByDay.get(day) || [];
                    return Object.assign(Object.assign({}, schedule), { hasExistingAppointments: dayAppointments.length > 0, existingAppointments: dayAppointments });
                });
                res.json({ success: true, data: normalized });
            }
            catch (error) {
                console.error('Error fetching weekly availability:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch availability' });
            }
        });
    }
    // Update weekly availability for the authenticated doctor
    updateMyWeeklyAvailability(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (req.user.role !== client_2.Role.DOCTOR) {
                    return res.status(403).json({ success: false, message: 'Only doctors can update availability' });
                }
                const doctorId = req.user.id;
                // Expect body: { days: Array<{ dayOfWeek: string, isAvailable: boolean, startTime?: string, endTime?: string }> }
                const { days } = req.body;
                if (!Array.isArray(days)) {
                    return res.status(400).json({ success: false, message: 'Invalid payload' });
                }
                // Check for conflicts before updating
                const today = new Date();
                const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
                const conflicts = [];
                for (const dayUpdate of days) {
                    if (!dayUpdate.isAvailable) {
                        // Check if there are existing appointments for this day
                        const existingAppointments = yield prisma.appointmentRequest.findMany({
                            where: {
                                doctorId,
                                requestedDate: {
                                    gte: today,
                                    lte: fourWeeksFromNow
                                },
                                status: {
                                    in: [client_2.AppointmentStatus.CONFIRMED, client_2.AppointmentStatus.PENDING]
                                }
                            },
                            select: {
                                id: true,
                                requestedDate: true,
                                requestedTime: true
                            }
                        });
                        const dayAppointments = existingAppointments.filter(apt => apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' }) === dayUpdate.dayOfWeek);
                        if (dayAppointments.length > 0) {
                            conflicts.push(`${dayUpdate.dayOfWeek} has ${dayAppointments.length} existing appointment(s)`);
                        }
                    }
                }
                if (conflicts.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot disable availability for days with existing appointments',
                        conflicts,
                        requiresReschedule: true
                    });
                }
                const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
                const operations = days
                    .filter(d => validDays.has(d.dayOfWeek))
                    .map(d => {
                    const startTime = d.startTime ? new Date(d.startTime) : new Date('1970-01-01T09:00:00Z');
                    const endTime = d.endTime ? new Date(d.endTime) : new Date('1970-01-01T17:00:00Z');
                    return prisma.doctorSchedule.upsert({
                        where: {
                            doctorId_dayOfWeek: {
                                doctorId,
                                dayOfWeek: d.dayOfWeek
                            }
                        },
                        create: {
                            doctorId,
                            dayOfWeek: d.dayOfWeek,
                            startTime,
                            endTime,
                            isAvailable: !!d.isAvailable
                        },
                        update: {
                            startTime,
                            endTime,
                            isAvailable: !!d.isAvailable
                        }
                    });
                });
                yield Promise.all(operations);
                res.json({ success: true, message: 'Availability updated' });
            }
            catch (error) {
                console.error('Error updating weekly availability:', error);
                res.status(500).json({ success: false, message: 'Failed to update availability' });
            }
        });
    }
    // Request reschedule for appointments on days doctor wants to disable
    requestRescheduleForDay(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (req.user.role !== client_2.Role.DOCTOR) {
                    return res.status(403).json({ success: false, message: 'Only doctors can request reschedules' });
                }
                const doctorId = req.user.id;
                const { dayOfWeek, reason, newDate, newTime } = req.body;
                if (!dayOfWeek || !reason) {
                    return res.status(400).json({ success: false, message: 'dayOfWeek and reason are required' });
                }
                // Find appointments for this day in the next 4 weeks
                const today = new Date();
                const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
                const appointmentsToReschedule = yield prisma.appointmentRequest.findMany({
                    where: {
                        doctorId,
                        requestedDate: {
                            gte: today,
                            lte: fourWeeksFromNow
                        },
                        status: {
                            in: [client_2.AppointmentStatus.CONFIRMED, client_2.AppointmentStatus.PENDING]
                        }
                    }
                });
                const dayAppointments = appointmentsToReschedule.filter(apt => apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' }) === dayOfWeek);
                // Create reschedule requests for each appointment
                const reschedulePromises = dayAppointments.map(appointment => {
                    let proposedNewDate = appointment.requestedDate;
                    let proposedNewTime = appointment.requestedTime;
                    if (newDate && newTime) {
                        const base = new Date(newDate);
                        const [hh, mm] = newTime.split(':').map(Number);
                        if (!isNaN(hh) && !isNaN(mm)) {
                            base.setHours(hh, mm, 0, 0);
                            proposedNewDate = base;
                            proposedNewTime = newTime;
                        }
                    }
                    return prisma.rescheduleRequest.create({
                        data: {
                            appointmentId: appointment.id,
                            requestedBy: doctorId,
                            requestedByRole: client_2.Role.DOCTOR,
                            currentDate: appointment.requestedDate,
                            currentTime: appointment.requestedTime,
                            newDate: proposedNewDate,
                            newTime: proposedNewTime,
                            reason,
                            notes: `Doctor requested reschedule for ${dayOfWeek}${newDate && newTime ? ` to ${proposedNewDate.toISOString()} (${proposedNewTime})` : ''}`,
                            proposedBy: 'DOCTOR'
                        }
                    });
                });
                yield Promise.all(reschedulePromises);
                // Update appointment status to RESCHEDULED
                yield prisma.appointmentRequest.updateMany({
                    where: {
                        id: { in: dayAppointments.map(apt => apt.id) }
                    },
                    data: {
                        status: client_2.AppointmentStatus.RESCHEDULED
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logUserActivity(doctorId, 'REQUEST_BULK_RESCHEDULE', 'USER_ACTIVITY', `Requested reschedule for ${dayAppointments.length} appointments on ${dayOfWeek}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'RESCHEDULE_REQUEST', dayOfWeek);
                res.json({
                    success: true,
                    message: `Reschedule requests sent for ${dayAppointments.length} appointments on ${dayOfWeek}`,
                    rescheduledCount: dayAppointments.length
                });
            }
            catch (error) {
                console.error('Error requesting day reschedule:', error);
                res.status(500).json({ success: false, message: 'Failed to request reschedule' });
            }
        });
    }
    // Get available doctors for appointment booking
    getAvailableDoctors(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doctors = yield prisma.user.findMany({
                    where: { role: client_2.Role.DOCTOR },
                    select: {
                        id: true,
                        email: true,
                        organizationId: true,
                        doctorInfo: {
                            select: {
                                firstName: true,
                                lastName: true,
                                specialization: true
                            }
                        }
                    },
                    orderBy: [
                        { doctorInfo: { firstName: 'asc' } },
                        { doctorInfo: { lastName: 'asc' } }
                    ]
                });
                const formattedDoctors = doctors.map(doctor => {
                    var _a;
                    return ({
                        id: doctor.id,
                        name: doctor.doctorInfo
                            ? `Dr. ${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                            : doctor.email,
                        specialization: ((_a = doctor.doctorInfo) === null || _a === void 0 ? void 0 : _a.specialization) || 'General Practice',
                        organizationId: doctor.organizationId
                    });
                });
                res.json({
                    success: true,
                    data: formattedDoctors
                });
            }
            catch (error) {
                console.error('Error fetching doctors:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch doctors'
                });
            }
        });
    }
    // Get doctor availability by doctor ID (for patients to check availability)
    getDoctorAvailability(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { doctorId } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(doctorId)) {
                    return res.status(400).json({ success: false, message: 'Invalid doctor ID format' });
                }
                // Get doctor's weekly schedule
                const schedules = yield prisma.doctorSchedule.findMany({
                    where: { doctorId },
                    orderBy: { dayOfWeek: 'asc' }
                });
                // Format the response
                const availability = schedules.map(schedule => ({
                    dayOfWeek: schedule.dayOfWeek,
                    isAvailable: schedule.isAvailable,
                    startTime: schedule.startTime.toTimeString().slice(0, 5), // HH:MM format
                    endTime: schedule.endTime.toTimeString().slice(0, 5) // HH:MM format
                }));
                res.json(availability);
            }
            catch (error) {
                console.error('Error fetching doctor availability:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch doctor availability' });
            }
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
