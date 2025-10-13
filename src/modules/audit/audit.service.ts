import { PrismaClient, AuditCategory, AuditLevel, Role } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAuditLogData {
  userId?: string;
  action: string;
  category: AuditCategory;
  level: AuditLevel;
  description: string;
  ipAddress: string;
  userAgent: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
}

export interface CreateSecurityEventData {
  eventType: string;
  severity: AuditLevel;
  description: string;
  ipAddress: string;
  userAgent: string;
  userId?: string;
  details?: any;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  static async createAuditLog(data: CreateAuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          category: data.category,
          level: data.level,
          description: data.description,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          resourceType: data.resourceType || null,
          resourceId: data.resourceId || null,
          details: data.details || null,
          severity: this.getSeverityString(data.level)
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Create a security event entry
   */
  static async createSecurityEvent(data: CreateSecurityEventData): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: data.eventType,
          severity: data.severity,
          description: data.description,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          userId: data.userId || null,
          details: data.details || null
        }
      });
    } catch (error) {
      console.error('Failed to create security event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuthEvent(
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'TOKEN_REFRESH',
    userId: string | null,
    email: string | null,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    const level = action === 'LOGIN_FAILED' ? AuditLevel.WARNING : AuditLevel.INFO;
    const category = AuditCategory.AUTHENTICATION;
    
    let description = '';
    switch (action) {
      case 'LOGIN':
        description = `User ${email || 'unknown'} logged in successfully`;
        break;
      case 'LOGOUT':
        description = `User ${email || 'unknown'} logged out`;
        break;
      case 'LOGIN_FAILED':
        description = `Failed login attempt for email: ${email || 'unknown'}`;
        break;
      case 'PASSWORD_CHANGE':
        description = `User ${email || 'unknown'} changed password`;
        break;
      case 'TOKEN_REFRESH':
        description = `User ${email || 'unknown'} refreshed access token`;
        break;
    }

    await this.createAuditLog({
      userId: userId || undefined,
      action,
      category,
      level,
      description,
      ipAddress,
      userAgent,
      resourceType: 'USER',
      resourceId: userId || undefined,
      details
    });
  }

  /**
   * Log data access events
   */
  static async logDataAccess(
    action: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action,
      category: AuditCategory.DATA_ACCESS,
      level: AuditLevel.INFO,
      description: `User accessed ${resourceType}: ${resourceId}`,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      details
    });
  }

  /**
   * Log data modification events
   */
  static async logDataModification(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    userId: string,
    resourceType: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    const level = action === 'DELETE' ? AuditLevel.WARNING : AuditLevel.INFO;
    
    await this.createAuditLog({
      userId,
      action,
      category: AuditCategory.DATA_MODIFICATION,
      level,
      description: `User ${action.toLowerCase()}d ${resourceType}: ${resourceId}`,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      details
    });
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(
    eventType: string,
    severity: AuditLevel,
    description: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    // Create both audit log and security event
    await Promise.all([
      this.createAuditLog({
        userId: userId || undefined,
        action: eventType,
        category: AuditCategory.SECURITY,
        level: severity,
        description,
        ipAddress,
        userAgent,
        resourceType: 'SECURITY',
        details
      }),
      this.createSecurityEvent({
        eventType,
        severity,
        description,
        userId: userId || undefined,
        ipAddress,
        userAgent,
        details
      })
    ]);
  }

  /**
   * Log system events
   */
  static async logSystemEvent(
    action: string,
    description: string,
    level: AuditLevel = AuditLevel.INFO,
    ipAddress: string = 'system',
    userAgent: string = 'system',
    details?: any
  ): Promise<void> {
    await this.createAuditLog({
      action,
      category: AuditCategory.SYSTEM,
      level,
      description,
      ipAddress,
      userAgent,
      resourceType: 'SYSTEM',
      details
    });
  }

  /**
   * Log user activity events
   */
  static async logUserActivity(
    action: string,
    userId: string,
    description: string,
    ipAddress: string,
    userAgent: string,
    resourceType?: string,
    resourceId?: string,
    details?: any
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action,
      category: AuditCategory.USER_ACTIVITY,
      level: AuditLevel.INFO,
      description,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      details
    });
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(
    filters: {
      userId?: string;
      category?: AuditCategory;
      level?: AuditLevel;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      page?: number;
      limit?: number;
    },
    currentUser: { id: string; role: Role; organizationId?: string }
  ) {
    const {
      userId,
      category,
      level,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause based on user permissions
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
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } }
      ];
    }

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
        take: limit
      })
    ]);

    return {
      items: auditLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  /**
   * Get security events with filtering
   */
  static async getSecurityEvents(
    filters: {
      eventType?: string;
      severity?: AuditLevel;
      resolved?: boolean;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      page?: number;
      limit?: number;
    },
    currentUser: { id: string; role: Role; organizationId?: string }
  ) {
    const {
      eventType,
      severity,
      resolved,
      userId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause based on user permissions
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
      where.resolved = resolved;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { eventType: { contains: search, mode: 'insensitive' } }
      ];
    }

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
        take: limit
      })
    ]);

    return {
      items: securityEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  /**
   * Resolve security event
   */
  static async resolveSecurityEvent(
    eventId: string,
    resolvedBy: string,
    currentUser: { id: string; role: Role; organizationId?: string }
  ) {
    const where: any = { id: eventId };

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
      throw new Error('Security event not found');
    }

    if (securityEvent.resolved) {
      throw new Error('Security event is already resolved');
    }

    return await prisma.securityEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy
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
  }

  /**
   * Get audit statistics
   */
  static async getAuditStatistics(
    filters: {
      startDate?: Date;
      endDate?: Date;
    },
    currentUser: { id: string; role: Role; organizationId?: string }
  ) {
    const { startDate, endDate } = filters;

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
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

    return {
      totalLogs,
      logsByCategory,
      logsByLevel,
      recentLogs,
      totalSecurityEvents,
      unresolvedSecurityEvents,
      securityEventsBySeverity
    };
  }

  /**
   * Helper method to convert AuditLevel to string
   */
  private static getSeverityString(level: AuditLevel): string {
    switch (level) {
      case AuditLevel.INFO:
        return 'low';
      case AuditLevel.WARNING:
        return 'medium';
      case AuditLevel.ERROR:
        return 'high';
      case AuditLevel.CRITICAL:
        return 'critical';
      default:
        return 'low';
    }
  }
}
