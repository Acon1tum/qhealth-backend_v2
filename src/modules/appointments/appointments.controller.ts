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
      const doctor = await prisma.user.findFirst({
        where: { id: doctorId, role: Role.DOCTOR }
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
      const isAvailable = await this.checkDoctorAvailability(doctorId, requestedDate, requestedTime);
      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available at the requested time'
        });
      }

      // Check for existing appointment conflicts
      const hasConflict = await this.checkAppointmentConflict(doctorId, parsedDate, requestedTime);
      if (hasConflict) {
        return res.status(400).json({
          success: false,
          message: 'Doctor already has an appointment at this time'
        });
      }

      // Create appointment request
      const appointment = await prisma.appointmentRequest.create({
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
        where: { id: appointmentId, doctorId: userId }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found or you do not have permission'
        });
      }

      // Update appointment status
      const updatedAppointment = await prisma.appointmentRequest.update({
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
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        return res.status(400).json({
          success: false,
          message: 'Can only reschedule confirmed appointments'
        });
      }

      // Create reschedule request
      const rescheduleRequest = await prisma.rescheduleRequest.create({
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
      const updatedReschedule = await prisma.rescheduleRequest.update({
        where: { id: rescheduleId },
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
      const updatedAppointment = await prisma.appointmentRequest.update({
        where: { id: appointmentId },
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
  private async checkDoctorAvailability(doctorId: string, date: string, time: string): Promise<boolean> {
    // console.log('Checking doctor availability:', { doctorId, date, time });
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    // console.log('Parsed date and day:', { requestedDate, dayOfWeek });

    const schedule = await prisma.doctorSchedule.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        isAvailable: true
      }
    });

    // console.log('Found schedule:', schedule);
    if (!schedule) return false;

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
  }

  // Check for appointment conflicts
  private async checkAppointmentConflict(doctorId: string, requestedDate: Date, requestedTime: string): Promise<boolean> {
    // console.log('Checking appointment conflict:', { doctorId, requestedDate, requestedTime });
    
    // Parse the requested time
    const [hours, minutes] = requestedTime.split(':').map(Number);
    const requestedStart = new Date(requestedDate);
    requestedStart.setHours(hours, minutes, 0, 0);
    
    // Check for existing appointments on the same date and time
    const existingAppointments = await prisma.appointmentRequest.findMany({
      where: {
        doctorId,
        requestedDate: {
          gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
          lt: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1)
        },
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
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
  }

  // Get weekly availability for the authenticated doctor
  async getMyWeeklyAvailability(req: Request, res: Response) {
    try {
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({ success: false, message: 'Only doctors can view availability' });
      }

      const doctorId = (req as any).user.id;
      const schedules = await prisma.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: { id: 'asc' }
      });

      // Check for existing appointments in the next 4 weeks for each day
      const today = new Date();
      const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
      
      const existingAppointments = await prisma.appointmentRequest.findMany({
        where: {
          doctorId,
          requestedDate: {
            gte: today,
            lte: fourWeeksFromNow
          },
          status: {
            in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]
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
      const appointmentsByDay = new Map<string, any[]>();
      existingAppointments.forEach(apt => {
        const dayOfWeek = apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
        if (!appointmentsByDay.has(dayOfWeek)) {
          appointmentsByDay.set(dayOfWeek, []);
        }
        appointmentsByDay.get(dayOfWeek)!.push(apt);
      });

      // Ensure all days exist (Monday-Sunday). If missing, return defaults with isAvailable=false
      const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
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
        return {
          ...schedule,
          hasExistingAppointments: dayAppointments.length > 0,
          existingAppointments: dayAppointments
        };
      });

      res.json({ success: true, data: normalized });
    } catch (error) {
      console.error('Error fetching weekly availability:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch availability' });
    }
  }

  // Update weekly availability for the authenticated doctor
  async updateMyWeeklyAvailability(req: Request, res: Response) {
    try {
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({ success: false, message: 'Only doctors can update availability' });
      }
      const doctorId = (req as any).user.id;
      // Expect body: { days: Array<{ dayOfWeek: string, isAvailable: boolean, startTime?: string, endTime?: string }> }
      const { days } = req.body as { days: Array<{ dayOfWeek: string; isAvailable: boolean; startTime?: string; endTime?: string; }>; };

      if (!Array.isArray(days)) {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Check for conflicts before updating
      const today = new Date();
      const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
      
      const conflicts: string[] = [];
      
      for (const dayUpdate of days) {
        if (!dayUpdate.isAvailable) {
          // Check if there are existing appointments for this day
          const existingAppointments = await prisma.appointmentRequest.findMany({
            where: {
              doctorId,
              requestedDate: {
                gte: today,
                lte: fourWeeksFromNow
              },
              status: {
                in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]
              }
            },
            select: {
              id: true,
              requestedDate: true,
              requestedTime: true
            }
          });
          
          const dayAppointments = existingAppointments.filter(apt => 
            apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' }) === dayUpdate.dayOfWeek
          );
          
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

      const validDays = new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']);
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

      await Promise.all(operations);

      res.json({ success: true, message: 'Availability updated' });
    } catch (error) {
      console.error('Error updating weekly availability:', error);
      res.status(500).json({ success: false, message: 'Failed to update availability' });
    }
  }

  // Request reschedule for appointments on days doctor wants to disable
  async requestRescheduleForDay(req: Request, res: Response) {
    try {
      if ((req as any).user.role !== Role.DOCTOR) {
        return res.status(403).json({ success: false, message: 'Only doctors can request reschedules' });
      }
      
      const doctorId = (req as any).user.id;
      const { dayOfWeek, reason, newDate, newTime } = req.body as { dayOfWeek: string; reason: string; newDate?: string; newTime?: string };
      
      if (!dayOfWeek || !reason) {
        return res.status(400).json({ success: false, message: 'dayOfWeek and reason are required' });
      }
      
      // Find appointments for this day in the next 4 weeks
      const today = new Date();
      const fourWeeksFromNow = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
      
      const appointmentsToReschedule = await prisma.appointmentRequest.findMany({
        where: {
          doctorId,
          requestedDate: {
            gte: today,
            lte: fourWeeksFromNow
          },
          status: {
            in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]
          }
        }
      });
      
      const dayAppointments = appointmentsToReschedule.filter(apt => 
        apt.requestedDate.toLocaleDateString('en-US', { weekday: 'long' }) === dayOfWeek
      );
      
      // Create reschedule requests for each appointment
      const reschedulePromises = dayAppointments.map(appointment => {
        let proposedNewDate: Date = appointment.requestedDate;
        let proposedNewTime: string = appointment.requestedTime;
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
            requestedByRole: Role.DOCTOR,
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
      
      await Promise.all(reschedulePromises);
      
      // Update appointment status to RESCHEDULED
      await prisma.appointmentRequest.updateMany({
        where: {
          id: { in: dayAppointments.map(apt => apt.id) }
        },
        data: {
          status: AppointmentStatus.RESCHEDULED
        }
      });
      
      // Audit log
      await AuditService.logUserActivity(
        doctorId,
        'REQUEST_BULK_RESCHEDULE',
        'USER_ACTIVITY',
        `Requested reschedule for ${dayAppointments.length} appointments on ${dayOfWeek}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'RESCHEDULE_REQUEST',
        dayOfWeek
      );
      
      res.json({
        success: true,
        message: `Reschedule requests sent for ${dayAppointments.length} appointments on ${dayOfWeek}`,
        rescheduledCount: dayAppointments.length
      });
      
    } catch (error) {
      console.error('Error requesting day reschedule:', error);
      res.status(500).json({ success: false, message: 'Failed to request reschedule' });
    }
  }

  // Get available doctors for appointment booking
  async getAvailableDoctors(req: Request, res: Response) {
    try {
      const doctors = await prisma.user.findMany({
        where: { role: Role.DOCTOR },
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

      const formattedDoctors = doctors.map(doctor => ({
        id: doctor.id,
        name: doctor.doctorInfo 
          ? `Dr. ${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
          : doctor.email,
        specialization: doctor.doctorInfo?.specialization || 'General Practice',
        organizationId: doctor.organizationId
      }));

      res.json({
        success: true,
        data: formattedDoctors
      });
    } catch (error) {
      console.error('Error fetching doctors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctors'
      });
    }
  }

  // Get doctor availability by doctor ID (for patients to check availability)
  async getDoctorAvailability(req: Request, res: Response) {
    try {
      const { doctorId } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctor ID format' });
      }

      // Get doctor's weekly schedule
      const schedules = await prisma.doctorSchedule.findMany({
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
    } catch (error) {
      console.error('Error fetching doctor availability:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch doctor availability' });
    }
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
