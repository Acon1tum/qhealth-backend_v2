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
exports.AuditService = void 0;
const client_1 = require("@prisma/client");
const security_config_1 = require("../../config/security.config");
const prisma = new client_1.PrismaClient();
class AuditService {
    /**
     * Log user activity for audit trail
     */
    static logUserActivity(userId, action, category, description, ipAddress, userAgent, resourceType, resourceId, details) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!security_config_1.securityConfig.logging.enableAuditLog) {
                    return;
                }
                const auditLog = {
                    userId,
                    action,
                    category,
                    level: client_1.AuditLevel.INFO,
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
                if (security_config_1.securityConfig.isDevelopment) {
                    console.log('📊 Audit Log:', JSON.stringify(auditLog, null, 2));
                }
                // Store in database
                yield this.storeAuditLog(auditLog);
            }
            catch (error) {
                console.error('Failed to log user activity:', error);
            }
        });
    }
    /**
     * Log security events
     */
    static logSecurityEvent(eventType, severity, description, ipAddress, userAgent, userId, details) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!security_config_1.securityConfig.logging.enableSecurityLog) {
                    return;
                }
                const securityEvent = {
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
                if (security_config_1.securityConfig.isDevelopment) {
                    console.log('🚨 Security Event:', JSON.stringify(securityEvent, null, 2));
                }
                // Store in database
                yield this.storeSecurityEvent(securityEvent);
                // Alert on critical security events
                if (severity === client_1.AuditLevel.CRITICAL) {
                    yield this.alertSecurityTeam(securityEvent);
                }
            }
            catch (error) {
                console.error('Failed to log security event:', error);
            }
        });
    }
    /**
     * Log authentication attempts
     */
    static logAuthAttempt(userId, action, success, ipAddress, userAgent, details) {
        return __awaiter(this, void 0, void 0, function* () {
            const level = success ? client_1.AuditLevel.INFO : client_1.AuditLevel.WARNING;
            const description = `${action} ${success ? 'successful' : 'failed'} for user ${userId || 'unknown'}`;
            yield this.logUserActivity(userId || '', action, client_1.AuditCategory.AUTHENTICATION, description, ipAddress, userAgent, 'USER', userId || undefined, Object.assign({ success }, details));
            // Log security event for failed attempts
            if (!success) {
                yield this.logSecurityEvent('AUTH_FAILURE', client_1.AuditLevel.WARNING, `Failed ${action} attempt from ${ipAddress}`, ipAddress, userAgent, userId || undefined, details);
            }
        });
    }
    /**
     * Log data access
     */
    static logDataAccess(userId, resourceType, resourceId, action, ipAddress, userAgent, details) {
        return __awaiter(this, void 0, void 0, function* () {
            const description = `${action} operation on ${resourceType} ${resourceId}`;
            const category = action === 'READ' ? client_1.AuditCategory.DATA_ACCESS : client_1.AuditCategory.DATA_MODIFICATION;
            yield this.logUserActivity(userId, action, category, description, ipAddress, userAgent, resourceType, resourceId, details);
        });
    }
    /**
     * Log suspicious activities
     */
    static logSuspiciousActivity(activity, ipAddress, userAgent, userId, details) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logSecurityEvent('SUSPICIOUS_ACTIVITY', client_1.AuditLevel.WARNING, activity, ipAddress, userAgent, userId, details);
        });
    }
    /**
     * Log rate limit violations
     */
    static logRateLimitViolation(ipAddress, userAgent, userId, details) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logSecurityEvent('RATE_LIMIT_VIOLATION', client_1.AuditLevel.WARNING, 'Rate limit exceeded', ipAddress, userAgent, userId, details);
        });
    }
    /**
     * Log failed authorization attempts
     */
    static logAuthorizationFailure(userId, resourceType, resourceId, action, ipAddress, userAgent, details) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logSecurityEvent('AUTHORIZATION_FAILURE', client_1.AuditLevel.WARNING, `User ${userId} attempted unauthorized ${action} on ${resourceType} ${resourceId}`, ipAddress, userAgent, userId, Object.assign({ resourceType, resourceId, action }, details));
        });
    }
    /**
     * Log system events
     */
    static logSystemEvent(event, level, details) {
        return __awaiter(this, void 0, void 0, function* () {
            const systemEvent = {
                action: event,
                category: client_1.AuditCategory.SYSTEM,
                level,
                description: `System event: ${event}`,
                ipAddress: 'SYSTEM',
                userAgent: 'SYSTEM',
                details,
                timestamp: new Date(),
                severity: level.toLowerCase(),
            };
            if (security_config_1.securityConfig.isDevelopment) {
                console.log('🔧 System Event:', JSON.stringify(systemEvent, null, 2));
            }
            // TODO: Store system events
        });
    }
    /**
     * Get audit logs for a user
     */
    static getUserAuditLogs(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 100, offset = 0) {
            try {
                const auditLogs = yield prisma.auditLog.findMany({
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
                    details: log.details,
                    timestamp: log.timestamp,
                    severity: log.severity,
                }));
            }
            catch (error) {
                console.error('Failed to fetch user audit logs:', error);
                return [];
            }
        });
    }
    /**
     * Get security events
     */
    static getSecurityEvents(severity_1, resolved_1) {
        return __awaiter(this, arguments, void 0, function* (severity, resolved, limit = 100, offset = 0) {
            try {
                const where = {};
                if (severity)
                    where.severity = severity;
                if (resolved !== undefined)
                    where.resolved = resolved;
                const securityEvents = yield prisma.securityEvent.findMany({
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
                    details: event.details,
                    timestamp: event.timestamp,
                    resolved: event.resolved,
                }));
            }
            catch (error) {
                console.error('Failed to fetch security events:', error);
                return [];
            }
        });
    }
    /**
     * Mark security event as resolved
     */
    static resolveSecurityEvent(eventId, resolvedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma.securityEvent.update({
                    where: { id: eventId },
                    data: {
                        resolved: true,
                        resolvedAt: new Date(),
                        resolvedBy: resolvedByUserId,
                    },
                });
                console.log(`Security event ${eventId} marked as resolved`);
            }
            catch (error) {
                console.error('Failed to resolve security event:', error);
                throw error;
            }
        });
    }
    /**
     * Clean up old audit logs
     */
    static cleanupOldLogs() {
        return __awaiter(this, arguments, void 0, function* (daysToKeep = 90) {
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
                // Clean up old audit logs
                const auditResult = yield prisma.auditLog.deleteMany({
                    where: {
                        timestamp: { lt: cutoffDate },
                    },
                });
                // Clean up old resolved security events
                const securityResult = yield prisma.securityEvent.deleteMany({
                    where: {
                        timestamp: { lt: cutoffDate },
                        resolved: true,
                    },
                });
                console.log(`Cleaned up ${auditResult.count} audit logs and ${securityResult.count} security events older than ${cutoffDate.toISOString()}`);
            }
            catch (error) {
                console.error('Failed to cleanup old logs:', error);
                throw error;
            }
        });
    }
    /**
     * Export audit logs for compliance
     */
    static exportAuditLogs(startDate_1, endDate_1) {
        return __awaiter(this, arguments, void 0, function* (startDate, endDate, format = 'json') {
            try {
                // TODO: Implement export logic
                console.log(`Exporting audit logs from ${startDate.toISOString()} to ${endDate.toISOString()}`);
                return 'Export completed';
            }
            catch (error) {
                console.error('Failed to export audit logs:', error);
                throw error;
            }
        });
    }
    /**
     * Alert security team for critical events
     */
    static alertSecurityTeam(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implement alerting (email, Slack, etc.)
                console.log('🚨 ALERT: Critical security event detected:', event);
            }
            catch (error) {
                console.error('Failed to alert security team:', error);
            }
        });
    }
    /**
     * Store audit log in database
     */
    static storeAuditLog(log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma.auditLog.create({
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
            }
            catch (error) {
                console.error('Failed to store audit log:', error);
                // Don't throw error to prevent breaking the main operation
            }
        });
    }
    /**
     * Store security event in database
     */
    static storeSecurityEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma.securityEvent.create({
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
            }
            catch (error) {
                console.error('Failed to store security event:', error);
                // Don't throw error to prevent breaking the main operation
            }
        });
    }
}
exports.AuditService = AuditService;
exports.default = AuditService;
