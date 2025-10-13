import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SuperAdminController {
  // Get comprehensive system statistics
  async getSystemStatistics(req: Request, res: Response) {
    try {
      const { timeRange = '30d' } = req.query;

      // Calculate date range
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all counts in parallel
      const [
        totalOrganizations,
        activeOrganizations,
        totalUsers,
        totalDoctors,
        totalPatients,
        totalAdmins,
        totalSuperAdmins,
        totalConsultations,
        totalAppointments,
        totalPrescriptions,
        totalLabRequests,
        totalNotifications,
        recentConsultations,
        recentAppointments,
        recentUsers,
        recentOrganizations
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { isActive: true } }),
        prisma.user.count(),
        prisma.user.count({ where: { role: 'DOCTOR' } }),
        prisma.user.count({ where: { role: 'PATIENT' } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
        prisma.consultation.count(),
        prisma.appointmentRequest.count(),
        prisma.prescription.count(),
        prisma.labRequest.count(),
        prisma.notification.count(),
        prisma.consultation.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.appointmentRequest.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.user.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.organization.count({
          where: { createdAt: { gte: startDate } }
        })
      ]);

      // Calculate system uptime
      const uptime = process.uptime();
      const days_uptime = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const systemUptime = `${days_uptime}d ${hours}h ${minutes}m`;

      // Get database size (this is a rough estimate)
      const databaseSize = '0 MB'; // Placeholder - requires database-specific query

      res.json({
        success: true,
        data: {
          totalOrganizations,
          activeOrganizations,
          totalUsers,
          totalDoctors,
          totalPatients,
          totalAdmins,
          totalSuperAdmins,
          totalConsultations,
          totalAppointments,
          totalPrescriptions,
          totalDiagnoses: 0, // No diagnoses table yet
          totalLabRequests,
          totalNotifications,
          activeSecurityEvents: 0, // Placeholder
          totalRevenue: 0, // Placeholder - would need billing/payment tracking
          systemUptime,
          databaseSize,
          apiRequestsToday: 0, // Placeholder - would need request tracking
          recentStats: {
            consultations: recentConsultations,
            appointments: recentAppointments,
            users: recentUsers,
            organizations: recentOrganizations
          }
        }
      });
    } catch (error) {
      console.error('Error fetching system statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get system health metrics
  async getSystemHealth(req: Request, res: Response) {
    try {
      const startTime = Date.now();

      // Test database connection
      let databaseStatus: 'healthy' | 'slow' | 'error' = 'healthy';
      let apiResponseTime = 0;

      try {
        await prisma.$queryRaw`SELECT 1`;
        apiResponseTime = Date.now() - startTime;
        databaseStatus = apiResponseTime > 200 ? 'slow' : 'healthy';
      } catch (error) {
        databaseStatus = 'error';
      }

      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = Math.round(
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      );

      // Get CPU usage (simplified)
      const cpuUsage = Math.round(process.cpuUsage().user / 10000);

      res.json({
        success: true,
        data: {
          serverStatus: 'online' as const,
          databaseStatus,
          apiResponseTime,
          memoryUsage: memoryUsagePercent,
          cpuUsage: Math.min(cpuUsage, 100),
          diskUsage: 0, // Placeholder - would need OS-level monitoring
          activeConnections: 0, // Placeholder - would need connection tracking
          lastHealthCheck: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching system health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system health',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get organizations with detailed statistics
  async getOrganizationsWithStats(req: Request, res: Response) {
    try {
      const organizations = await prisma.organization.findMany({
        include: {
          _count: {
            select: {
              users: true
            }
          },
          users: {
            select: {
              role: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Get consultation counts for each organization
      const organizationsWithStats = await Promise.all(
        organizations.map(async (org) => {
          // Get all users with their full data for this organization
          const orgUsers = await prisma.user.findMany({
            where: { organizationId: org.id },
            select: {
              id: true,
              role: true,
              updatedAt: true
            }
          });

          const doctorIds = orgUsers
            .filter(u => u.role === 'DOCTOR')
            .map(u => u.id);

          const consultationCount = await prisma.consultation.count({
            where: {
              doctorId: { in: doctorIds }
            }
          });

          const userCount = org._count.users;
          const doctorCount = orgUsers.filter(u => u.role === 'DOCTOR').length;
          const patientCount = orgUsers.filter(u => u.role === 'PATIENT').length;

          // Find the most recent activity
          const lastActivity = orgUsers.reduce((latest, user) => {
            const userDate = new Date(user.updatedAt);
            return userDate > latest ? userDate : latest;
          }, new Date(org.updatedAt));

          return {
            id: org.id,
            name: org.name,
            isActive: org.isActive,
            userCount,
            doctorCount,
            patientCount,
            consultationCount,
            lastActivity: lastActivity.toISOString(),
            createdAt: org.createdAt.toISOString(),
            updatedAt: org.updatedAt.toISOString()
          };
        })
      );

      res.json({
        success: true,
        data: organizationsWithStats
      });
    } catch (error) {
      console.error('Error fetching organizations with stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get recent system activities
  async getRecentActivities(req: Request, res: Response) {
    try {
      const { limit = '20' } = req.query;
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      // Get recent notifications as activities
      const notifications = await prisma.notification.findMany({
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              role: true
            }
          }
        }
      });

      const activities = notifications.map(notification => {
        const activityType = this.mapNotificationTypeToActivityType(notification.type);
        const severity = this.mapNotificationPriorityToSeverity(notification.priority);

        return {
          id: notification.id,
          type: activityType,
          description: notification.message || notification.title,
          timestamp: notification.createdAt.toISOString(),
          severity,
          userId: notification.userId,
          resourceType: notification.relatedType || undefined,
          resourceId: notification.relatedId || undefined
        };
      });

      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activities',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get user statistics
  async getUserStatistics(req: Request, res: Response) {
    try {
      const { timeRange = '30d' } = req.query;

      // Calculate date range
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalUsers, newUsers, activeUsers, usersByRoleData] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.user.count({
          where: { updatedAt: { gte: startDate } }
        }),
        prisma.user.groupBy({
          by: ['role'],
          _count: true
        })
      ]);

      const usersByRole: Record<string, number> = {};
      usersByRoleData.forEach(item => {
        usersByRole[item.role] = item._count;
      });

      res.json({
        success: true,
        data: {
          totalUsers,
          newUsers,
          activeUsers,
          usersByRole
        }
      });
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Security events (placeholder - would need actual security event tracking)
  async getSecurityEvents(req: Request, res: Response) {
    try {
      const { limit = '10', resolved } = req.query;
      
      // Placeholder response - would need actual security event tracking
      const mockEvents = [
        {
          id: '1',
          eventType: 'AUTH_FAILURE',
          severity: 'WARNING',
          description: 'Multiple failed login attempts detected',
          ipAddress: '192.168.1.100',
          userId: null,
          resolved: false,
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          eventType: 'RATE_LIMIT_VIOLATION',
          severity: 'ERROR',
          description: 'API rate limit exceeded',
          ipAddress: '10.0.0.15',
          userId: null,
          resolved: false,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ];

      let filteredEvents = mockEvents;
      if (resolved !== undefined) {
        const isResolved = resolved === 'true';
        filteredEvents = mockEvents.filter(event => event.resolved === isResolved);
      }

      res.json({
        success: true,
        data: filteredEvents.slice(0, parseInt(limit as string, 10))
      });
    } catch (error) {
      console.error('Error fetching security events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security events',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Resolve security event (placeholder)
  async resolveSecurityEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      
      // Placeholder - would update actual security event in database
      res.json({
        success: true,
        data: {
          id: eventId,
          resolved: true,
          resolvedAt: new Date().toISOString()
        },
        message: 'Security event resolved successfully'
      });
    } catch (error) {
      console.error('Error resolving security event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve security event',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods
  private mapNotificationTypeToActivityType(type: string): 'user_registration' | 'organization_created' | 'security_event' | 'system_maintenance' | 'consultation' | 'appointment' {
    const mapping: Record<string, 'user_registration' | 'organization_created' | 'security_event' | 'system_maintenance' | 'consultation' | 'appointment'> = {
      'APPOINTMENT': 'appointment',
      'CONSULTATION': 'consultation',
      'PRESCRIPTION': 'system_maintenance',
      'DIAGNOSIS': 'system_maintenance',
      'LAB_RESULT': 'system_maintenance',
      'SYSTEM': 'system_maintenance'
    };
    return mapping[type] || 'system_maintenance';
  }

  private mapNotificationPriorityToSeverity(priority: string): 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' {
    const mapping: Record<string, 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'> = {
      'LOW': 'INFO',
      'MEDIUM': 'WARNING',
      'HIGH': 'ERROR',
      'URGENT': 'CRITICAL'
    };
    return mapping[priority] || 'INFO';
  }
}

