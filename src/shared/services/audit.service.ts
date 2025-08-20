import { PrismaClient, AuditLevel, AuditCategory } from '@prisma/client';
import { securityConfig } from '../../config/security.config';

const prisma = new PrismaClient();

// Audit log interface
export interface IAuditLog {
  id?: string;
  userId?: number;
  action: string;
  category: AuditCategory;
  level: AuditLevel;
  description: string;
  ipAddress: string;
  userAgent: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  timestamp: Date;
  severity: string;
}

// Security event interface
export interface ISecurityEvent {
  id?: string;
  eventType: string;
  severity: AuditLevel;
  description: string;
  ipAddress: string;
  userAgent: string;
  userId?: number;
  details?: any;
  timestamp: Date;
  resolved: boolean;
}

export class AuditService {
  /**
   * Log user activity for audit trail
   */
  static async logUserActivity(
    userId: number,
    action: string,
    category: AuditCategory,
    description: string,
    ipAddress: string,
    userAgent: string,
    resourceType?: string,
    resourceId?: string,
    details?: any
  ): Promise<void> {
    try {
      if (!securityConfig.logging.enableAuditLog) {
        return;
      }

      const auditLog: IAuditLog = {
        userId,
        action,
        category,
        level: AuditLevel.INFO,
        description,
        ipAddress,
        userAgent,
        resourceType,
        resourceId,
        details,
        timestamp: new Date(),
        severity: 'low',
      };

      // Log to console in development
      if (securityConfig.isDevelopment) {
        console.log('📊 Audit Log:', JSON.stringify(auditLog, null, 2));
      }

      // Store in database
      await this.storeAuditLog(auditLog);
    } catch (error) {
      console.error('Failed to log user activity:', error);
    }
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(
    eventType: string,
    severity: AuditLevel,
    description: string,
    ipAddress: string,
    userAgent: string,
    userId?: number,
    details?: any
  ): Promise<void> {
    try {
      if (!securityConfig.logging.enableSecurityLog) {
        return;
      }

      const securityEvent: ISecurityEvent = {
        eventType,
        severity,
        description,
        ipAddress,
        userAgent,
        userId,
        details,
        timestamp: new Date(),
        resolved: false,
      };

      // Log to console in development
      if (securityConfig.isDevelopment) {
        console.log('🚨 Security Event:', JSON.stringify(securityEvent, null, 2));
      }

      // Store in database
      await this.storeSecurityEvent(securityEvent);

      // Alert on critical security events
      if (severity === AuditLevel.CRITICAL) {
        await this.alertSecurityTeam(securityEvent);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log authentication attempts
   */
  static async logAuthAttempt(
    userId: number | null,
    action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET',
    success: boolean,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    const level = success ? AuditLevel.INFO : AuditLevel.WARNING;
    const description = `${action} ${success ? 'successful' : 'failed'} for user ${userId || 'unknown'}`;

    await this.logUserActivity(
      userId || 0,
      action,
      AuditCategory.AUTHENTICATION,
      description,
      ipAddress,
      userAgent,
      'USER',
      userId?.toString(),
      { success, ...details }
    );

    // Log security event for failed attempts
    if (!success) {
      await this.logSecurityEvent(
        'AUTH_FAILURE',
        AuditLevel.WARNING,
        `Failed ${action} attempt from ${ipAddress}`,
        ipAddress,
        userAgent,
        userId || undefined,
        details
      );
    }
  }

  /**
   * Log data access
   */
  static async logDataAccess(
    userId: number,
    resourceType: string,
    resourceId: string,
    action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE',
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    const description = `${action} operation on ${resourceType} ${resourceId}`;
    const category = action === 'READ' ? AuditCategory.DATA_ACCESS : AuditCategory.DATA_MODIFICATION;

    await this.logUserActivity(
      userId,
      action,
      category,
      description,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      details
    );
  }

  /**
   * Log suspicious activities
   */
  static async logSuspiciousActivity(
    activity: string,
    ipAddress: string,
    userAgent: string,
    userId?: number,
    details?: any
  ): Promise<void> {
    await this.logSecurityEvent(
      'SUSPICIOUS_ACTIVITY',
      AuditLevel.WARNING,
      activity,
      ipAddress,
      userAgent,
      userId,
      details
    );
  }

  /**
   * Log rate limit violations
   */
  static async logRateLimitViolation(
    ipAddress: string,
    userAgent: string,
    userId?: number,
    details?: any
  ): Promise<void> {
    await this.logSecurityEvent(
      'RATE_LIMIT_VIOLATION',
      AuditLevel.WARNING,
      'Rate limit exceeded',
      ipAddress,
      userAgent,
      userId,
      details
    );
  }

  /**
   * Log failed authorization attempts
   */
  static async logAuthorizationFailure(
    userId: number,
    resourceType: string,
    resourceId: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    await this.logSecurityEvent(
      'AUTHORIZATION_FAILURE',
      AuditLevel.WARNING,
      `User ${userId} attempted unauthorized ${action} on ${resourceType} ${resourceId}`,
      ipAddress,
      userAgent,
      userId,
      { resourceType, resourceId, action, ...details }
    );
  }

  /**
   * Log system events
   */
  static async logSystemEvent(
    event: string,
    level: AuditLevel,
    details?: any
  ): Promise<void> {
    const systemEvent: IAuditLog = {
      action: event,
      category: AuditCategory.SYSTEM,
      level,
      description: `System event: ${event}`,
      ipAddress: 'SYSTEM',
      userAgent: 'SYSTEM',
      details,
      timestamp: new Date(),
      severity: level.toLowerCase(),
    };

    if (securityConfig.isDevelopment) {
      console.log('🔧 System Event:', JSON.stringify(systemEvent, null, 2));
    }

    // TODO: Store system events
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(
    userId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<IAuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
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

      return auditLogs.map(log => ({
        id: log.id,
        userId: log.userId || undefined,
        action: log.action,
        category: log.category,
        level: log.level,
        description: log.description,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        resourceType: log.resourceType || undefined,
        resourceId: log.resourceId || undefined,
        details: log.details as any,
        timestamp: log.timestamp,
        severity: log.severity,
      }));
    } catch (error) {
      console.error('Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Get security events
   */
  static async getSecurityEvents(
    severity?: AuditLevel,
    resolved?: boolean,
    limit: number = 100,
    offset: number = 0
  ): Promise<ISecurityEvent[]> {
    try {
      const where: any = {};
      if (severity) where.severity = severity;
      if (resolved !== undefined) where.resolved = resolved;

      const securityEvents = await prisma.securityEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          resolvedByUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return securityEvents.map(event => ({
        id: event.id,
        eventType: event.eventType,
        severity: event.severity,
        description: event.description,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        userId: event.userId || undefined,
        details: event.details as any,
        timestamp: event.timestamp,
        resolved: event.resolved,
      }));
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      return [];
    }
  }

  /**
   * Mark security event as resolved
   */
  static async resolveSecurityEvent(eventId: string, resolvedByUserId?: number): Promise<void> {
    try {
      await prisma.securityEvent.update({
        where: { id: eventId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: resolvedByUserId,
        },
      });

      console.log(`Security event ${eventId} marked as resolved`);
    } catch (error) {
      console.error('Failed to resolve security event:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean up old audit logs
      const auditResult = await prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      });

      // Clean up old resolved security events
      const securityResult = await prisma.securityEvent.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          resolved: true,
        },
      });

      console.log(`Cleaned up ${auditResult.count} audit logs and ${securityResult.count} security events older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   */
  static async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      // TODO: Implement export logic
      console.log(`Exporting audit logs from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      return 'Export completed';
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Alert security team for critical events
   */
  private static async alertSecurityTeam(event: ISecurityEvent): Promise<void> {
    try {
      // TODO: Implement alerting (email, Slack, etc.)
      console.log('🚨 ALERT: Critical security event detected:', event);
    } catch (error) {
      console.error('Failed to alert security team:', error);
    }
  }

  /**
   * Store audit log in database
   */
  private static async storeAuditLog(log: IAuditLog): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: log.userId,
          action: log.action,
          category: log.category,
          level: log.level,
          description: log.description,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details,
          severity: log.severity,
        },
      });
    } catch (error) {
      console.error('Failed to store audit log:', error);
      // Don't throw error to prevent breaking the main operation
    }
  }

  /**
   * Store security event in database
   */
  private static async storeSecurityEvent(event: ISecurityEvent): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: event.eventType,
          severity: event.severity,
          description: event.description,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          userId: event.userId,
          details: event.details,
        },
      });
    } catch (error) {
      console.error('Failed to store security event:', error);
      // Don't throw error to prevent breaking the main operation
    }
  }
}

export default AuditService;
