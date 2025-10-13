import { PrismaClient, NotificationType, NotificationPriority } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

// Global Socket.IO instance
let io: SocketIOServer | null = null;

export function setSocketIOInstance(socketIOInstance: SocketIOServer) {
  io = socketIOInstance;
  console.log('✅ Socket.IO instance set for NotificationService');
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  metadata?: any;
  expiresAt?: Date;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedId: data.relatedId,
          relatedType: data.relatedType,
          actionUrl: data.actionUrl,
          priority: data.priority || NotificationPriority.NORMAL,
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
        const unreadCount = await prisma.notification.count({
          where: {
            userId: notification.userId,
            isRead: false,
            isArchived: false,
          },
        });
        io.to(userRoom).emit('notification:unread-count', { count: unreadCount });
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create multiple notifications at once
   */
  static async createBulkNotifications(notificationsData: CreateNotificationData[]) {
    try {
      const notifications = await prisma.notification.createMany({
        data: notificationsData.map((data) => ({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedId: data.relatedId,
          relatedType: data.relatedType,
          actionUrl: data.actionUrl,
          priority: data.priority || NotificationPriority.NORMAL,
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
    } catch (error) {
      console.error('❌ Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Notify about new appointment request
   */
  static async notifyAppointmentCreated(appointmentId: string, doctorId: string, patientId: string, appointmentDate: Date, appointmentTime: string) {
    // Notify doctor
    await this.createNotification({
      userId: doctorId,
      type: NotificationType.APPOINTMENT_CREATED,
      title: 'New Appointment Request',
      message: `You have a new appointment request for ${appointmentDate.toDateString()} at ${appointmentTime}`,
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/doctor/appointments/${appointmentId}`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, patientId, appointmentDate, appointmentTime },
    });

    // Notify patient (confirmation)
    await this.createNotification({
      userId: patientId,
      type: NotificationType.APPOINTMENT_CREATED,
      title: 'Appointment Request Submitted',
      message: `Your appointment request for ${appointmentDate.toDateString()} at ${appointmentTime} has been submitted`,
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/patient/appointments/${appointmentId}`,
      priority: NotificationPriority.NORMAL,
      metadata: { appointmentId, doctorId, appointmentDate, appointmentTime },
    });
  }

  /**
   * Notify about appointment confirmation
   */
  static async notifyAppointmentConfirmed(appointmentId: string, patientId: string, doctorId: string, appointmentDate: Date, appointmentTime: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title: 'Appointment Confirmed',
      message: `Your appointment has been confirmed for ${appointmentDate.toDateString()} at ${appointmentTime}`,
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/patient/appointments/${appointmentId}`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, doctorId, appointmentDate, appointmentTime },
    });
  }

  /**
   * Notify about appointment rejection
   */
  static async notifyAppointmentRejected(appointmentId: string, patientId: string, doctorId: string, reason?: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.APPOINTMENT_REJECTED,
      title: 'Appointment Request Declined',
      message: reason || 'Your appointment request has been declined. Please choose another time slot.',
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/patient/appointments`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, doctorId, reason },
    });
  }

  /**
   * Notify about appointment cancellation
   */
  static async notifyAppointmentCancelled(appointmentId: string, userId: string, cancelledBy: string, reason?: string) {
    await this.createNotification({
      userId: userId,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: 'Appointment Cancelled',
      message: reason || 'An appointment has been cancelled.',
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/appointments/${appointmentId}`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, cancelledBy, reason },
    });
  }

  /**
   * Notify about appointment rescheduling
   */
  static async notifyAppointmentRescheduled(appointmentId: string, userId: string, newDate: Date, newTime: string) {
    await this.createNotification({
      userId: userId,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled to ${newDate.toDateString()} at ${newTime}`,
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/appointments/${appointmentId}`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, newDate, newTime },
    });
  }

  /**
   * Notify about reschedule request
   */
  static async notifyRescheduleRequest(rescheduleId: string, userId: string, currentDate: Date, currentTime: string, newDate: Date, newTime: string) {
    await this.createNotification({
      userId: userId,
      type: NotificationType.RESCHEDULE_REQUEST,
      title: 'Reschedule Request',
      message: `A reschedule request has been made to change from ${currentDate.toDateString()} ${currentTime} to ${newDate.toDateString()} ${newTime}`,
      relatedId: rescheduleId,
      relatedType: 'RESCHEDULE',
      actionUrl: `/appointments/reschedule/${rescheduleId}`,
      priority: NotificationPriority.HIGH,
      metadata: { rescheduleId, currentDate, currentTime, newDate, newTime },
    });
  }

  /**
   * Notify about prescription issued
   */
  static async notifyPrescriptionIssued(prescriptionId: string, patientId: string, doctorId: string, medicationName: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.PRESCRIPTION_ISSUED,
      title: 'New Prescription',
      message: `A prescription for ${medicationName} has been issued`,
      relatedId: prescriptionId,
      relatedType: 'PRESCRIPTION',
      actionUrl: `/patient/prescriptions/${prescriptionId}`,
      priority: NotificationPriority.HIGH,
      metadata: { prescriptionId, doctorId, medicationName },
    });
  }

  /**
   * Notify about diagnosis added
   */
  static async notifyDiagnosisAdded(diagnosisId: string, patientId: string, doctorId: string, diagnosisName: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.DIAGNOSIS_ADDED,
      title: 'New Diagnosis',
      message: `A new diagnosis has been added to your medical record: ${diagnosisName}`,
      relatedId: diagnosisId,
      relatedType: 'DIAGNOSIS',
      actionUrl: `/patient/medical-record/${diagnosisId}`,
      priority: NotificationPriority.HIGH,
      metadata: { diagnosisId, doctorId, diagnosisName },
    });
  }

  /**
   * Notify about lab request created
   */
  static async notifyLabRequestCreated(labRequestId: string, patientId: string, doctorId: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.LAB_REQUEST_CREATED,
      title: 'New Lab Request',
      message: 'A new laboratory test request has been created for you',
      relatedId: labRequestId,
      relatedType: 'LAB_REQUEST',
      actionUrl: `/patient/lab-requests/${labRequestId}`,
      priority: NotificationPriority.NORMAL,
      metadata: { labRequestId, doctorId },
    });
  }

  /**
   * Notify about lab results available
   */
  static async notifyLabResultsAvailable(labRequestId: string, patientId: string, doctorId: string) {
    // Notify patient
    await this.createNotification({
      userId: patientId,
      type: NotificationType.LAB_RESULTS_AVAILABLE,
      title: 'Lab Results Available',
      message: 'Your laboratory test results are now available',
      relatedId: labRequestId,
      relatedType: 'LAB_REQUEST',
      actionUrl: `/patient/lab-requests/${labRequestId}`,
      priority: NotificationPriority.HIGH,
      metadata: { labRequestId, doctorId },
    });

    // Notify doctor
    await this.createNotification({
      userId: doctorId,
      type: NotificationType.LAB_RESULTS_AVAILABLE,
      title: 'Lab Results Available',
      message: 'Laboratory test results are available for review',
      relatedId: labRequestId,
      relatedType: 'LAB_REQUEST',
      actionUrl: `/doctor/lab-requests/${labRequestId}`,
      priority: NotificationPriority.NORMAL,
      metadata: { labRequestId, patientId },
    });
  }

  /**
   * Notify about health scan completed
   */
  static async notifyHealthScanCompleted(consultationId: string, patientId: string, doctorId: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.HEALTH_SCAN_COMPLETED,
      title: 'Health Scan Completed',
      message: 'Your health scan has been completed and is available to view',
      relatedId: consultationId,
      relatedType: 'CONSULTATION',
      actionUrl: `/patient/self-check`,
      priority: NotificationPriority.NORMAL,
      metadata: { consultationId, doctorId },
    });
  }

  /**
   * Notify about medical record shared
   */
  static async notifyMedicalRecordShared(recordId: string, doctorId: string, patientId: string, recordType: string) {
    await this.createNotification({
      userId: doctorId,
      type: NotificationType.MEDICAL_RECORD_SHARED,
      title: 'Medical Record Shared',
      message: `A ${recordType} has been shared with you`,
      relatedId: recordId,
      relatedType: 'MEDICAL_RECORD',
      actionUrl: `/doctor/patient-records/${patientId}`,
      priority: NotificationPriority.NORMAL,
      metadata: { recordId, patientId, recordType },
    });
  }

  /**
   * Notify about consultation started
   */
  static async notifyConsultationStarted(consultationId: string, patientId: string, doctorId: string) {
    await this.createNotification({
      userId: patientId,
      type: NotificationType.CONSULTATION_STARTED,
      title: 'Consultation Started',
      message: 'Your consultation session has started',
      relatedId: consultationId,
      relatedType: 'CONSULTATION',
      actionUrl: `/patient/meet`,
      priority: NotificationPriority.URGENT,
      metadata: { consultationId, doctorId },
    });
  }

  /**
   * Notify about document verification
   */
  static async notifyDocumentVerified(userId: string, documentType: string, verified: boolean) {
    await this.createNotification({
      userId: userId,
      type: verified ? NotificationType.DOCUMENT_VERIFIED : NotificationType.DOCUMENT_REJECTED,
      title: verified ? 'Document Verified' : 'Document Verification Failed',
      message: verified 
        ? `Your ${documentType} has been verified successfully` 
        : `Your ${documentType} verification was unsuccessful. Please resubmit.`,
      relatedType: 'DOCUMENT',
      actionUrl: `/my-profile`,
      priority: NotificationPriority.HIGH,
      metadata: { documentType, verified },
    });
  }

  /**
   * Send appointment reminder (for scheduled jobs)
   */
  static async sendAppointmentReminder(appointmentId: string, userId: string, appointmentDate: Date, appointmentTime: string, hoursBeforeAppointment: number) {
    await this.createNotification({
      userId: userId,
      type: NotificationType.APPOINTMENT_REMINDER,
      title: 'Upcoming Appointment Reminder',
      message: `You have an appointment in ${hoursBeforeAppointment} hours at ${appointmentTime}`,
      relatedId: appointmentId,
      relatedType: 'APPOINTMENT',
      actionUrl: `/appointments/${appointmentId}`,
      priority: NotificationPriority.HIGH,
      metadata: { appointmentId, appointmentDate, appointmentTime, hoursBeforeAppointment },
    });
  }

  /**
   * Send system announcement to all users or specific roles
   */
  static async sendSystemAnnouncement(userIds: string[], title: string, message: string, priority: NotificationPriority = NotificationPriority.NORMAL) {
    const notifications = userIds.map((userId) => ({
      userId,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority,
      relatedType: 'SYSTEM',
    }));

    return await this.createBulkNotifications(notifications);
  }
}

