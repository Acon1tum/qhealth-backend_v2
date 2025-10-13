import { Request, Response } from 'express';
import { PrismaClient, AuditCategory, AuditLevel, Role } from '@prisma/client';
import { asyncHandler } from '../../shared/middleware/error-handler';
import { IApiResponse } from '../../types';

const prisma = new PrismaClient();

type AuditListQuery = {
  page?: string;
  limit?: string;
  userId?: string;
  category?: AuditCategory;
  level?: AuditLevel;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  module?: string;
  pageName?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

type SecurityEventsQuery = {
  page?: string;
  limit?: string;
  eventType?: string;
  severity?: AuditLevel;
  resolved?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export class AuditController {
  /**
   * Get audit logs with filtering and pagination
   * GET /audit/logs
   */
  static getAuditLogs = asyncHandler(async (req: Request<{}, {}, {}, AuditListQuery>, res: Response): Promise<void> => {
    const {
      page = '1',
      limit = '10',
      userId,
      category,
      level,
      action,
      resourceType,
      resourceId,
      module,
      pageName,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Check user permissions
    const currentUser = (req as any).user;
    if (!currentUser) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
      return;
    }

    // Build where clause
    const where: any = {};

    // Super admin can see all logs
    if (currentUser.role === Role.SUPER_ADMIN) {
      // No additional restrictions
    } else if (currentUser.role === Role.ADMIN) {
      // Admin can only see logs for their organization
      where.OR = [
        { userId: currentUser.id }, // Their own logs
        { user: { organizationId: currentUser.organizationId } }, // Organization logs
        { userId: null } // System logs
      ];
    } else {
      // Regular users can only see their own logs
      where.userId = currentUser.id;
    }

    // Apply filters
    if (userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = category;
    }

    if (level) {
      where.level = level;
    }

    if (action) {
      where.action = {
        contains: action,
        mode: 'insensitive'
      };
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    if (module) {
      // Filter by module based on action patterns
      const moduleActions: { [key: string]: string[] } = {
        'AUTH': ['LOGIN', 'LOGOUT', 'PASSWORD', 'TOKEN'],
        'APPOINTMENTS': ['APPOINTMENT'],
        'CONSULTATIONS': ['CONSULTATION'],
        'MEDICAL_RECORDS': ['MEDICAL', 'RECORD'],
        'PRESCRIPTIONS': ['PRESCRIPTION'],
        'DIAGNOSES': ['DIAGNOSIS', 'DIAGNOSE'],
        'DOCTORS': ['DOCTOR'],
        'PATIENTS': ['PATIENT'],
        'ORGANIZATIONS': ['ORGANIZATION'],
        'LAB_REQUESTS': ['LAB', 'REQUEST'],
        'SELF_CHECK': ['SELF', 'CHECK'],
        'NOTIFICATIONS': ['NOTIFICATION'],
        'EMAIL': ['EMAIL', 'SEND'],
        'SUPER_ADMIN': ['AUDIT', 'SECURITY', 'ADMIN'],
        'SYSTEM': ['SYSTEM', 'HEALTH', 'STATISTICS']
      };
      
      const actions = moduleActions[module.toUpperCase()];
      if (actions) {
        where.OR = actions.map((actionPattern: string) => ({
          action: { contains: actionPattern, mode: 'insensitive' }
        }));
      }
    }

    if (pageName) {
      // Filter by page based on resource type patterns
      const pageResources: { [key: string]: string[] } = {
        'dashboard': ['SYSTEM', 'STATISTICS'],
        'login': ['USER', 'AUTH'],
        'profile': ['USER', 'AUTH'],
        'appointments': ['APPOINTMENT'],
        'consultations': ['CONSULTATION'],
        'medical-records': ['MEDICAL_RECORD', 'MEDICALRECORD'],
        'prescriptions': ['PRESCRIPTION'],
        'diagnoses': ['DIAGNOSIS'],
        'doctors': ['DOCTOR'],
        'patients': ['PATIENT'],
        'organizations': ['ORGANIZATION'],
        'lab-requests': ['LAB_REQUEST', 'LABREQUEST'],
        'self-check': ['SELF_CHECK', 'SELFCHECK'],
        'notifications': ['NOTIFICATION'],
        'audit-logs': ['AUDIT_LOG', 'AUDITLOG'],
        'settings': ['SETTING', 'CONFIG'],
        'reports': ['REPORT', 'STATISTICS']
      };
      
      const resources = pageResources[pageName.toLowerCase()];
      if (resources) {
        where.OR = resources.map((resourcePattern: string) => ({
          resourceType: { contains: resourcePattern, mode: 'insensitive' }
        }));
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } }
      ];
    }

    try {
      const [total, auditLogs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                organization: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            timestamp: 'desc'
          },
          skip,
          take: limitNum
        })
      ]);

      const response: IApiResponse = {
        success: true,
        message: 'Audit logs retrieved successfully',
        data: {
          items: auditLogs,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve audit logs',
        error: 'INTERNAL_ERROR',
      };
      res.status(500).json(response);
    }
  });

  /**
   * Get audit log by ID
   * GET /audit/logs/:id
   */
  static getAuditLogById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      const response: IApiResponse = {
        success: false,
        message: 'Audit log ID is required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Check user permissions
    const currentUser = (req as any).user;
    if (!currentUser) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
      return;
    }

    try {
      const where: any = { id };

      // Super admin can see all logs
      if (currentUser.role === Role.SUPER_ADMIN) {
        // No additional restrictions
      } else if (currentUser.role === Role.ADMIN) {
        // Admin can only see logs for their organization
        where.OR = [
          { userId: currentUser.id }, // Their own logs
          { user: { organizationId: currentUser.organizationId } }, // Organization logs
          { userId: null } // System logs
        ];
      } else {
        // Regular users can only see their own logs
        where.userId = currentUser.id;
      }

      const auditLog = await prisma.auditLog.findFirst({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!auditLog) {
        const response: IApiResponse = {
          success: false,
          message: 'Audit log not found',
          error: 'NOT_FOUND',
        };
        res.status(404).json(response);
        return;
      }

      const response: IApiResponse = {
        success: true,
        message: 'Audit log retrieved successfully',
        data: auditLog
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve audit log',
        error: 'INTERNAL_ERROR',
      };
      res.status(500).json(response);
    }
  });

  /**
   * Get security events with filtering and pagination
   * GET /audit/security-events
   */
  static getSecurityEvents = asyncHandler(async (req: Request<{}, {}, {}, SecurityEventsQuery>, res: Response): Promise<void> => {
    const {
      page = '1',
      limit = '10',
      eventType,
      severity,
      resolved,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Check user permissions - only super admin and admin can see security events
    const currentUser = (req as any).user;
    if (!currentUser || ![Role.SUPER_ADMIN, Role.ADMIN].includes(currentUser.role)) {
      const response: IApiResponse = {
        success: false,
        message: 'Insufficient permissions to view security events',
        error: 'FORBIDDEN',
      };
      res.status(403).json(response);
      return;
    }

    // Build where clause
    const where: any = {};

    // Super admin can see all security events
    if (currentUser.role === Role.SUPER_ADMIN) {
      // No additional restrictions
    } else if (currentUser.role === Role.ADMIN) {
      // Admin can only see security events for their organization
      where.OR = [
        { user: { organizationId: currentUser.organizationId } },
        { userId: null } // System events
      ];
    }

    // Apply filters
    if (eventType) {
      where.eventType = {
        contains: eventType,
        mode: 'insensitive'
      };
    }

    if (severity) {
      where.severity = severity;
    }

    if (resolved !== undefined) {
      where.resolved = resolved === 'true';
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { eventType: { contains: search, mode: 'insensitive' } }
      ];
    }

    try {
      const [total, securityEvents] = await Promise.all([
        prisma.securityEvent.count({ where }),
        prisma.securityEvent.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                organization: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            resolvedByUser: {
              select: {
                id: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            timestamp: 'desc'
          },
          skip,
          take: limitNum
        })
      ]);

      const response: IApiResponse = {
        success: true,
        message: 'Security events retrieved successfully',
        data: {
          items: securityEvents,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve security events',
        error: 'INTERNAL_ERROR',
      };
      res.status(500).json(response);
    }
  });

  /**
   * Resolve security event
   * PUT /audit/security-events/:id/resolve
   */
  static resolveSecurityEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      const response: IApiResponse = {
        success: false,
        message: 'Security event ID is required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Check user permissions - only super admin and admin can resolve security events
    const currentUser = (req as any).user;
    if (!currentUser || ![Role.SUPER_ADMIN, Role.ADMIN].includes(currentUser.role)) {
      const response: IApiResponse = {
        success: false,
        message: 'Insufficient permissions to resolve security events',
        error: 'FORBIDDEN',
      };
      res.status(403).json(response);
      return;
    }

    try {
      const where: any = { id };

      // Super admin can resolve all security events
      if (currentUser.role === Role.SUPER_ADMIN) {
        // No additional restrictions
      } else if (currentUser.role === Role.ADMIN) {
        // Admin can only resolve security events for their organization
        where.OR = [
          { user: { organizationId: currentUser.organizationId } },
          { userId: null } // System events
        ];
      }

      const securityEvent = await prisma.securityEvent.findFirst({
        where,
        select: { id: true, resolved: true }
      });

      if (!securityEvent) {
        const response: IApiResponse = {
          success: false,
          message: 'Security event not found',
          error: 'NOT_FOUND',
        };
        res.status(404).json(response);
        return;
      }

      if (securityEvent.resolved) {
        const response: IApiResponse = {
          success: false,
          message: 'Security event is already resolved',
          error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
        return;
      }

      const updatedEvent = await prisma.securityEvent.update({
        where: { id },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: currentUser.id
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          resolvedByUser: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        }
      });

      const response: IApiResponse = {
        success: true,
        message: 'Security event resolved successfully',
        data: updatedEvent
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resolve security event',
        error: 'INTERNAL_ERROR',
      };
      res.status(500).json(response);
    }
  });

  /**
   * Get audit statistics
   * GET /audit/statistics
   */
  static getAuditStatistics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    // Check user permissions
    const currentUser = (req as any).user;
    if (!currentUser || ![Role.SUPER_ADMIN, Role.ADMIN].includes(currentUser.role)) {
      const response: IApiResponse = {
        success: false,
        message: 'Insufficient permissions to view audit statistics',
        error: 'FORBIDDEN',
      };
      res.status(403).json(response);
      return;
    }

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    const where: any = {};
    if (Object.keys(dateFilter).length > 0) {
      where.timestamp = dateFilter;
    }

    // Super admin can see all statistics
    if (currentUser.role === Role.SUPER_ADMIN) {
      // No additional restrictions
    } else if (currentUser.role === Role.ADMIN) {
      // Admin can only see statistics for their organization
      where.OR = [
        { userId: currentUser.id }, // Their own logs
        { user: { organizationId: currentUser.organizationId } }, // Organization logs
        { userId: null } // System logs
      ];
    }

    try {
      const [
        totalLogs,
        logsByCategory,
        logsByLevel,
        recentLogs,
        totalSecurityEvents,
        unresolvedSecurityEvents,
        securityEventsBySeverity
      ] = await Promise.all([
        // Total audit logs
        prisma.auditLog.count({ where }),
        
        // Logs by category
        prisma.auditLog.groupBy({
          by: ['category'],
          where,
          _count: { category: true }
        }),
        
        // Logs by level
        prisma.auditLog.groupBy({
          by: ['level'],
          where,
          _count: { level: true }
        }),
        
        // Recent logs (last 24 hours)
        prisma.auditLog.count({
          where: {
            ...where,
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        
        // Total security events
        prisma.securityEvent.count({
          where: {
            ...where,
            OR: [
              { user: currentUser.role === Role.SUPER_ADMIN ? undefined : { organizationId: currentUser.organizationId } },
              { userId: null }
            ]
          }
        }),
        
        // Unresolved security events
        prisma.securityEvent.count({
          where: {
            ...where,
            resolved: false,
            OR: [
              { user: currentUser.role === Role.SUPER_ADMIN ? undefined : { organizationId: currentUser.organizationId } },
              { userId: null }
            ]
          }
        }),
        
        // Security events by severity
        prisma.securityEvent.groupBy({
          by: ['severity'],
          where: {
            ...where,
            OR: [
              { user: currentUser.role === Role.SUPER_ADMIN ? undefined : { organizationId: currentUser.organizationId } },
              { userId: null }
            ]
          },
          _count: { severity: true }
        })
      ]);

      const response: IApiResponse = {
        success: true,
        message: 'Audit statistics retrieved successfully',
        data: {
          totalLogs,
          logsByCategory,
          logsByLevel,
          recentLogs,
          totalSecurityEvents,
          unresolvedSecurityEvents,
          securityEventsBySeverity
        }
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve audit statistics',
        error: 'INTERNAL_ERROR',
      };
      res.status(500).json(response);
    }
  });
}
