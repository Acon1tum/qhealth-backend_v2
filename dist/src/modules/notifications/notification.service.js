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
exports.NotificationService = void 0;
exports.setSocketIOInstance = setSocketIOInstance;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Global Socket.IO instance
let io = null;
function setSocketIOInstance(socketIOInstance) {
    io = socketIOInstance;
    console.log('✅ Socket.IO instance set for NotificationService');
}
class NotificationService {
    /**
     * Create a new notification
     */
    static createNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notification = yield prisma.notification.create({
                    data: {
                        userId: data.userId,
                        type: data.type,
                        title: data.title,
                        message: data.message,
                        relatedId: data.relatedId,
                        relatedType: data.relatedType,
                        actionUrl: data.actionUrl,
                        priority: data.priority || client_1.NotificationPriority.NORMAL,
                        metadata: data.metadata || {},
                        expiresAt: data.expiresAt,
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                });
                console.log(`✅ Notification created: ${notification.type} for user ${notification.userId}`);
                // Emit real-time notification via Socket.IO
                if (io) {
                    const userRoom = `user:${notification.userId}`;
                    io.to(userRoom).emit('notification:new', notification);
                    console.log(`📡 Real-time notification sent to room: ${userRoom}`);
                    // Also emit unread count update
                    const unreadCount = yield prisma.notification.count({
                        where: {
                            userId: notification.userId,
                            isRead: false,
                            isArchived: false,
                        },
                    });
                    io.to(userRoom).emit('notification:unread-count', { count: unreadCount });
                }
                return notification;
            }
            catch (error) {
                console.error('❌ Error creating notification:', error);
                throw error;
            }
        });
    }
    /**
     * Create multiple notifications at once
     */
    static createBulkNotifications(notificationsData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notifications = yield prisma.notification.createMany({
                    data: notificationsData.map((data) => ({
                        userId: data.userId,
                        type: data.type,
                        title: data.title,
                        message: data.message,
                        relatedId: data.relatedId,
                        relatedType: data.relatedType,
                        actionUrl: data.actionUrl,
                        priority: data.priority || client_1.NotificationPriority.NORMAL,
                        metadata: data.metadata || {},
                        expiresAt: data.expiresAt,
                    })),
                });
                console.log(`✅ ${notifications.count} notifications created`);
                // Emit real-time notifications for bulk creation
                if (io && notificationsData.length > 0) {
                    // Get unique user IDs
                    const userIds = [...new Set(notificationsData.map(n => n.userId))];
                    // Emit to each user's room
                    for (const userId of userIds) {
                        const userRoom = `user:${userId}`;
                        io.to(userRoom).emit('notification:refresh');
                        console.log(`📡 Notification refresh signal sent to room: ${userRoom}`);
                    }
                }
                return notifications;
            }
            catch (error) {
                console.error('❌ Error creating bulk notifications:', error);
                throw error;
            }
        });
    }
    /**
     * Notify about new appointment request
     */
    static notifyAppointmentCreated(appointmentId, doctorId, patientId, appointmentDate, appointmentTime) {
        return __awaiter(this, void 0, void 0, function* () {
            // Notify doctor
            yield this.createNotification({
                userId: doctorId,
                type: client_1.NotificationType.APPOINTMENT_CREATED,
                title: 'New Appointment Request',
                message: `You have a new appointment request for ${appointmentDate.toDateString()} at ${appointmentTime}`,
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/doctor/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, patientId, appointmentDate, appointmentTime },
            });
            // Notify patient (confirmation)
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.APPOINTMENT_CREATED,
                title: 'Appointment Request Submitted',
                message: `Your appointment request for ${appointmentDate.toDateString()} at ${appointmentTime} has been submitted`,
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/patient/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.NORMAL,
                metadata: { appointmentId, doctorId, appointmentDate, appointmentTime },
            });
        });
    }
    /**
     * Notify about appointment confirmation
     */
    static notifyAppointmentConfirmed(appointmentId, patientId, doctorId, appointmentDate, appointmentTime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.APPOINTMENT_CONFIRMED,
                title: 'Appointment Confirmed',
                message: `Your appointment has been confirmed for ${appointmentDate.toDateString()} at ${appointmentTime}`,
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/patient/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, doctorId, appointmentDate, appointmentTime },
            });
        });
    }
    /**
     * Notify about appointment rejection
     */
    static notifyAppointmentRejected(appointmentId, patientId, doctorId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.APPOINTMENT_REJECTED,
                title: 'Appointment Request Declined',
                message: reason || 'Your appointment request has been declined. Please choose another time slot.',
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/patient/appointments`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, doctorId, reason },
            });
        });
    }
    /**
     * Notify about appointment cancellation
     */
    static notifyAppointmentCancelled(appointmentId, userId, cancelledBy, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: userId,
                type: client_1.NotificationType.APPOINTMENT_CANCELLED,
                title: 'Appointment Cancelled',
                message: reason || 'An appointment has been cancelled.',
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, cancelledBy, reason },
            });
        });
    }
    /**
     * Notify about appointment rescheduling
     */
    static notifyAppointmentRescheduled(appointmentId, userId, newDate, newTime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: userId,
                type: client_1.NotificationType.APPOINTMENT_RESCHEDULED,
                title: 'Appointment Rescheduled',
                message: `Your appointment has been rescheduled to ${newDate.toDateString()} at ${newTime}`,
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, newDate, newTime },
            });
        });
    }
    /**
     * Notify about reschedule request
     */
    static notifyRescheduleRequest(rescheduleId, userId, currentDate, currentTime, newDate, newTime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: userId,
                type: client_1.NotificationType.RESCHEDULE_REQUEST,
                title: 'Reschedule Request',
                message: `A reschedule request has been made to change from ${currentDate.toDateString()} ${currentTime} to ${newDate.toDateString()} ${newTime}`,
                relatedId: rescheduleId,
                relatedType: 'RESCHEDULE',
                actionUrl: `/appointments/reschedule/${rescheduleId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { rescheduleId, currentDate, currentTime, newDate, newTime },
            });
        });
    }
    /**
     * Notify about prescription issued
     */
    static notifyPrescriptionIssued(prescriptionId, patientId, doctorId, medicationName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.PRESCRIPTION_ISSUED,
                title: 'New Prescription',
                message: `A prescription for ${medicationName} has been issued`,
                relatedId: prescriptionId,
                relatedType: 'PRESCRIPTION',
                actionUrl: `/patient/prescriptions/${prescriptionId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { prescriptionId, doctorId, medicationName },
            });
        });
    }
    /**
     * Notify about diagnosis added
     */
    static notifyDiagnosisAdded(diagnosisId, patientId, doctorId, diagnosisName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.DIAGNOSIS_ADDED,
                title: 'New Diagnosis',
                message: `A new diagnosis has been added to your medical record: ${diagnosisName}`,
                relatedId: diagnosisId,
                relatedType: 'DIAGNOSIS',
                actionUrl: `/patient/medical-record/${diagnosisId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { diagnosisId, doctorId, diagnosisName },
            });
        });
    }
    /**
     * Notify about lab request created
     */
    static notifyLabRequestCreated(labRequestId, patientId, doctorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.LAB_REQUEST_CREATED,
                title: 'New Lab Request',
                message: 'A new laboratory test request has been created for you',
                relatedId: labRequestId,
                relatedType: 'LAB_REQUEST',
                actionUrl: `/patient/lab-requests/${labRequestId}`,
                priority: client_1.NotificationPriority.NORMAL,
                metadata: { labRequestId, doctorId },
            });
        });
    }
    /**
     * Notify about lab results available
     */
    static notifyLabResultsAvailable(labRequestId, patientId, doctorId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Notify patient
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.LAB_RESULTS_AVAILABLE,
                title: 'Lab Results Available',
                message: 'Your laboratory test results are now available',
                relatedId: labRequestId,
                relatedType: 'LAB_REQUEST',
                actionUrl: `/patient/lab-requests/${labRequestId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { labRequestId, doctorId },
            });
            // Notify doctor
            yield this.createNotification({
                userId: doctorId,
                type: client_1.NotificationType.LAB_RESULTS_AVAILABLE,
                title: 'Lab Results Available',
                message: 'Laboratory test results are available for review',
                relatedId: labRequestId,
                relatedType: 'LAB_REQUEST',
                actionUrl: `/doctor/lab-requests/${labRequestId}`,
                priority: client_1.NotificationPriority.NORMAL,
                metadata: { labRequestId, patientId },
            });
        });
    }
    /**
     * Notify about health scan completed
     */
    static notifyHealthScanCompleted(consultationId, patientId, doctorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.HEALTH_SCAN_COMPLETED,
                title: 'Health Scan Completed',
                message: 'Your health scan has been completed and is available to view',
                relatedId: consultationId,
                relatedType: 'CONSULTATION',
                actionUrl: `/patient/self-check`,
                priority: client_1.NotificationPriority.NORMAL,
                metadata: { consultationId, doctorId },
            });
        });
    }
    /**
     * Notify about medical record shared
     */
    static notifyMedicalRecordShared(recordId, doctorId, patientId, recordType) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: doctorId,
                type: client_1.NotificationType.MEDICAL_RECORD_SHARED,
                title: 'Medical Record Shared',
                message: `A ${recordType} has been shared with you`,
                relatedId: recordId,
                relatedType: 'MEDICAL_RECORD',
                actionUrl: `/doctor/patient-records/${patientId}`,
                priority: client_1.NotificationPriority.NORMAL,
                metadata: { recordId, patientId, recordType },
            });
        });
    }
    /**
     * Notify about consultation started
     */
    static notifyConsultationStarted(consultationId, patientId, doctorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: patientId,
                type: client_1.NotificationType.CONSULTATION_STARTED,
                title: 'Consultation Started',
                message: 'Your consultation session has started',
                relatedId: consultationId,
                relatedType: 'CONSULTATION',
                actionUrl: `/patient/meet`,
                priority: client_1.NotificationPriority.URGENT,
                metadata: { consultationId, doctorId },
            });
        });
    }
    /**
     * Notify about document verification
     */
    static notifyDocumentVerified(userId, documentType, verified) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: userId,
                type: verified ? client_1.NotificationType.DOCUMENT_VERIFIED : client_1.NotificationType.DOCUMENT_REJECTED,
                title: verified ? 'Document Verified' : 'Document Verification Failed',
                message: verified
                    ? `Your ${documentType} has been verified successfully`
                    : `Your ${documentType} verification was unsuccessful. Please resubmit.`,
                relatedType: 'DOCUMENT',
                actionUrl: `/my-profile`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { documentType, verified },
            });
        });
    }
    /**
     * Send appointment reminder (for scheduled jobs)
     */
    static sendAppointmentReminder(appointmentId, userId, appointmentDate, appointmentTime, hoursBeforeAppointment) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createNotification({
                userId: userId,
                type: client_1.NotificationType.APPOINTMENT_REMINDER,
                title: 'Upcoming Appointment Reminder',
                message: `You have an appointment in ${hoursBeforeAppointment} hours at ${appointmentTime}`,
                relatedId: appointmentId,
                relatedType: 'APPOINTMENT',
                actionUrl: `/appointments/${appointmentId}`,
                priority: client_1.NotificationPriority.HIGH,
                metadata: { appointmentId, appointmentDate, appointmentTime, hoursBeforeAppointment },
            });
        });
    }
    /**
     * Send system announcement to all users or specific roles
     */
    static sendSystemAnnouncement(userIds_1, title_1, message_1) {
        return __awaiter(this, arguments, void 0, function* (userIds, title, message, priority = client_1.NotificationPriority.NORMAL) {
            const notifications = userIds.map((userId) => ({
                userId,
                type: client_1.NotificationType.SYSTEM_ANNOUNCEMENT,
                title,
                message,
                priority,
                relatedType: 'SYSTEM',
            }));
            return yield this.createBulkNotifications(notifications);
        });
    }
}
exports.NotificationService = NotificationService;
