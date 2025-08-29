import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppointmentStatus, RescheduleStatus, Role } from '@prisma/client';
import { AuditService } from '../../shared/services/audit.service';

const prisma = new PrismaClient();

export class AppointmentsController {
  // Create appointment request
  async createAppointmentRequest(req: Request, res: Response) {
    try {
      const { patientId, doctorId, requestedDate, requestedTime, reason, priority, notes } = req.body;
      const userId = (req as any).user.id;

      // Verify patient is creating their own appointment
      if (userId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'You can only create appointments for yourself'
        });
      }

      // Check if doctor exists and is a doctor
      const doctor = await prisma.user.findFirst({
        where: { id: doctorId, role: Role.DOCTOR }
      });

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      // Check doctor availability
      const isAvailable = await this.checkDoctorAvailability(doctorId, requestedDate, requestedTime);
      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available at the requested time'
        });
      }

      // Create appointment request
      const appointment = await prisma.appointmentRequest.create({
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
      await AuditService.logUserActivity(
        userId,
        'CREATE_APPOINTMENT_REQUEST',
        'USER_ACTIVITY',
        `Appointment request created for ${appointment.patient.patientInfo?.fullName} with Dr. ${appointment.doctor.doctorInfo?.firstName} ${appointment.doctor.doctorInfo?.lastName}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'APPOINTMENT_REQUEST',
        appointment.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Appointment request created successfully',
        data: appointment
      });

    } catch (error) {
      console.error('Error creating appointment request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create appointment request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get appointments for user (patient or doctor)
  async getUserAppointments(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const { status, page = 1, limit = 10 } = req.query;

      let whereClause: any = {};
      
      if (userRole === Role.PATIENT) {
        whereClause.patientId = userId;
      } else if (userRole === Role.DOCTOR) {
        whereClause.doctorId = userId;
      }

      if (status) {
        whereClause.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [appointments, total] = await Promise.all([
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

    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch appointments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Doctor approves/rejects appointment request
  async updateAppointmentStatus(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const { status, notes } = req.body;
      const userId = (req as any).user.id;

      // Verify user is a doctor
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can update appointment status'
        });
      }

      // Get appointment and verify doctor owns it
      const appointment = await prisma.appointmentRequest.findFirst({
        where: { id: Number(appointmentId), doctorId: userId }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found or you do not have permission'
        });
      }

      // Update appointment status
      const updatedAppointment = await prisma.appointmentRequest.update({
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
      if (status === AppointmentStatus.CONFIRMED) {
        await this.createConsultation(updatedAppointment);
      }

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_APPOINTMENT_STATUS',
        'USER_ACTIVITY',
        `Appointment ${appointmentId} status updated to ${status}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'APPOINTMENT_REQUEST',
        appointmentId
      );

      res.json({
        success: true,
        message: `Appointment ${status.toLowerCase()} successfully`,
        data: updatedAppointment
      });

    } catch (error) {
      console.error('Error updating appointment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appointment status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Request reschedule
  async requestReschedule(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const { newDate, newTime, reason, notes } = req.body;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Get appointment
      const appointment = await prisma.appointmentRequest.findFirst({
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
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        return res.status(400).json({
          success: false,
          message: 'Can only reschedule confirmed appointments'
        });
      }

      // Create reschedule request
      const rescheduleRequest = await prisma.rescheduleRequest.create({
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
          proposedBy: userRole === Role.PATIENT ? 'PATIENT' : 'DOCTOR'
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'REQUEST_RESCHEDULE',
        'USER_ACTIVITY',
        `Reschedule requested for appointment ${appointmentId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'RESCHEDULE_REQUEST',
        rescheduleRequest.id.toString()
      );

      res.status(201).json({
        success: true,
        message: 'Reschedule request created successfully',
        data: rescheduleRequest
      });

    } catch (error) {
      console.error('Error requesting reschedule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create reschedule request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Approve/reject reschedule request
  async updateRescheduleStatus(req: Request, res: Response) {
    try {
      const { rescheduleId } = req.params;
      const { status, notes } = req.body;
      const userId = (req as any).user.id;

      // Get reschedule request
      const rescheduleRequest = await prisma.rescheduleRequest.findFirst({
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
      const updatedReschedule = await prisma.rescheduleRequest.update({
        where: { id: Number(rescheduleId) },
        data: {
          status,
          notes,
          resolvedAt: new Date()
        }
      });

      // If approved, update appointment
      if (status === RescheduleStatus.APPROVED) {
        await prisma.appointmentRequest.update({
          where: { id: rescheduleRequest.appointmentId },
          data: {
            requestedDate: rescheduleRequest.newDate,
            requestedTime: rescheduleRequest.newTime,
            status: AppointmentStatus.RESCHEDULED,
            updatedAt: new Date()
          }
        });
      }

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'UPDATE_RESCHEDULE_STATUS',
        'USER_ACTIVITY',
        `Reschedule request ${rescheduleId} ${status.toLowerCase()}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'RESCHEDULE_REQUEST',
        rescheduleId
      );

      res.json({
        success: true,
        message: `Reschedule request ${status.toLowerCase()} successfully`,
        data: updatedReschedule
      });

    } catch (error) {
      console.error('Error updating reschedule status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update reschedule status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Cancel appointment
  async cancelAppointment(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.id;

      // Get appointment
      const appointment = await prisma.appointmentRequest.findFirst({
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
      const updatedAppointment = await prisma.appointmentRequest.update({
        where: { id: Number(appointmentId) },
        data: {
          status: AppointmentStatus.CANCELLED,
          notes: reason,
          updatedAt: new Date()
        }
      });

      // Audit log
      await AuditService.logUserActivity(
        userId,
        'CANCEL_APPOINTMENT',
        'USER_ACTIVITY',
        `Appointment ${appointmentId} cancelled`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'APPOINTMENT_REQUEST',
        appointmentId
      );

      res.json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: updatedAppointment
      });

    } catch (error) {
      console.error('Error cancelling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel appointment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private method to check doctor availability
  private async checkDoctorAvailability(doctorId: number, date: string, time: string): Promise<boolean> {
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });

    const schedule = await prisma.doctorSchedule.findFirst({
      where: {
        doctorId,
        dayOfWeek
      }
    });

    if (!schedule) return false;

    // Add more sophisticated availability checking logic here
    // This is a simplified version
    return true;
  }

  // Private method to create consultation
  private async createConsultation(appointment: any) {
    // Generate unique consultation code (exactly 9 characters)
    const consultationCode = this.generateConsultationCode(appointment);
    
    await prisma.consultation.create({
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
  }

  // Generate unique consultation code (exactly 9 characters)
  private generateConsultationCode(appointment: any): string {
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
