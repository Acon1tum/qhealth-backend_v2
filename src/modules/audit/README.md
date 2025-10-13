# Audit Module

This module provides comprehensive audit trail and security event logging capabilities for the QHealth system.

## Features

- **Audit Logging**: Track all user activities, data access, and system events
- **Security Events**: Monitor security-related incidents and threats
- **Role-based Access**: Different access levels for different user roles
- **Filtering & Search**: Advanced filtering and search capabilities
- **Statistics**: Audit analytics and reporting

## API Endpoints

### Audit Logs

#### GET /api/audit/logs
Get audit logs with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `userId` (optional): Filter by user ID
- `category` (optional): Filter by audit category
- `level` (optional): Filter by audit level
- `action` (optional): Filter by action
- `resourceType` (optional): Filter by resource type
- `resourceId` (optional): Filter by resource ID
- `startDate` (optional): Filter by start date (ISO string)
- `endDate` (optional): Filter by end date (ISO string)
- `search` (optional): Search in description, action, or resource type

**Access Control:**
- **Super Admin**: Can see all audit logs
- **Admin**: Can see logs for their organization and system logs
- **Regular Users**: Can only see their own logs

#### GET /api/audit/logs/:id
Get a specific audit log by ID.

### Security Events

#### GET /api/audit/security-events
Get security events with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `eventType` (optional): Filter by event type
- `severity` (optional): Filter by severity level
- `resolved` (optional): Filter by resolution status (true/false)
- `userId` (optional): Filter by user ID
- `startDate` (optional): Filter by start date (ISO string)
- `endDate` (optional): Filter by end date (ISO string)
- `search` (optional): Search in description or event type

**Access Control:**
- **Admin & Super Admin**: Can view security events

#### PUT /api/audit/security-events/:id/resolve
Resolve a security event.

**Access Control:**
- **Admin & Super Admin**: Can resolve security events

### Statistics

#### GET /api/audit/statistics
Get audit statistics and analytics.

**Query Parameters:**
- `startDate` (optional): Filter by start date (ISO string)
- `endDate` (optional): Filter by end date (ISO string)

**Access Control:**
- **Admin & Super Admin**: Can view statistics

## Usage Examples

### Using the Audit Service

```typescript
import { AuditService } from './audit.service';
import { AuditCategory, AuditLevel } from '@prisma/client';

// Log user authentication
await AuditService.logAuthEvent(
  'LOGIN',
  userId,
  email,
  ipAddress,
  userAgent,
  { loginMethod: 'password' }
);

// Log data access
await AuditService.logDataAccess(
  'VIEW_MEDICAL_RECORD',
  userId,
  'MEDICAL_RECORD',
  recordId,
  ipAddress,
  userAgent,
  { recordType: 'consultation' }
);

// Log data modification
await AuditService.logDataModification(
  'UPDATE',
  userId,
  'PRESCRIPTION',
  prescriptionId,
  ipAddress,
  userAgent,
  { changes: { dosage: 'new_dosage' } }
);

// Log security event
await AuditService.logSecurityEvent(
  'SUSPICIOUS_LOGIN_ATTEMPT',
  AuditLevel.WARNING,
  'Multiple failed login attempts detected',
  userId,
  ipAddress,
  userAgent,
  { attempts: 5, timeWindow: '10 minutes' }
);

// Log system event
await AuditService.logSystemEvent(
  'BACKUP_COMPLETED',
  'Daily backup completed successfully',
  AuditLevel.INFO,
  'system',
  'backup-service',
  { backupSize: '2.5GB', duration: '45 minutes' }
);
```

### Middleware Integration

```typescript
import { AuditService } from '../audit/audit.service';

// Example middleware for logging requests
export const auditMiddleware = (action: string, category: AuditCategory) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log after response is sent
      AuditService.logUserActivity(
        action,
        req.user?.id,
        `${action} request to ${req.path}`,
        req.ip,
        req.get('User-Agent') || 'unknown',
        req.route?.path,
        req.params.id,
        {
          method: req.method,
          statusCode: res.statusCode,
          responseTime: Date.now() - req.startTime
        }
      );
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};
```

## Data Models

### AuditLog
- `id`: Unique identifier
- `userId`: User who performed the action (nullable for system events)
- `action`: Action performed (e.g., LOGIN, CREATE, UPDATE, DELETE)
- `category`: Category of the audit log
- `level`: Severity level (INFO, WARNING, ERROR, CRITICAL)
- `description`: Human-readable description
- `ipAddress`: IP address of the user
- `userAgent`: User agent string
- `resourceType`: Type of resource affected
- `resourceId`: ID of the resource affected
- `details`: Additional details in JSON format
- `timestamp`: When the action occurred
- `severity`: Severity level as string

### SecurityEvent
- `id`: Unique identifier
- `eventType`: Type of security event
- `severity`: Severity level
- `description`: Description of the security event
- `ipAddress`: IP address associated with the event
- `userAgent`: User agent string
- `userId`: User associated with the event (nullable)
- `details`: Additional details in JSON format
- `timestamp`: When the event occurred
- `resolved`: Whether the security event has been resolved
- `resolvedAt`: When the event was resolved
- `resolvedBy`: User who resolved the event

## Security Considerations

1. **Access Control**: Different user roles have different access levels to audit data
2. **Data Privacy**: Sensitive information should not be logged in the details field
3. **Performance**: Audit logging is designed to be non-blocking and should not affect main operations
4. **Retention**: Consider implementing data retention policies for audit logs
5. **Monitoring**: Security events should be monitored and alerts configured

## Rate Limiting

- Audit logs: 100 requests per 15 minutes
- Security events: 50 requests per 15 minutes
- Statistics: 30 requests per 15 minutes
- Resolve security events: 20 requests per 15 minutes
