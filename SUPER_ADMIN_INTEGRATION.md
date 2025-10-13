# Super Admin Dashboard Integration

## Overview
This document describes the integration between the super-admin dashboard frontend and the backend API endpoints.

## Backend Implementation

### New Endpoints Created
All super-admin endpoints are protected by authentication and require the `SUPER_ADMIN` role.

Base URL: `/api/super-admin`

#### 1. System Statistics
**GET** `/api/super-admin/statistics`

Query Parameters:
- `timeRange` (optional): `7d`, `30d`, or `90d` (default: `30d`)

Response:
```json
{
  "success": true,
  "data": {
    "totalOrganizations": 10,
    "activeOrganizations": 8,
    "totalUsers": 1250,
    "totalDoctors": 150,
    "totalPatients": 1000,
    "totalAdmins": 50,
    "totalSuperAdmins": 5,
    "totalConsultations": 5000,
    "totalAppointments": 8000,
    "totalPrescriptions": 4500,
    "totalDiagnoses": 0,
    "totalLabRequests": 1200,
    "totalNotifications": 15000,
    "activeSecurityEvents": 0,
    "totalRevenue": 0,
    "systemUptime": "5d 12h 30m",
    "databaseSize": "0 MB",
    "apiRequestsToday": 0,
    "recentStats": {
      "consultations": 150,
      "appointments": 200,
      "users": 25,
      "organizations": 2
    }
  }
}
```

#### 2. System Health
**GET** `/api/super-admin/health`

Response:
```json
{
  "success": true,
  "data": {
    "serverStatus": "online",
    "databaseStatus": "healthy",
    "apiResponseTime": 142,
    "memoryUsage": 68,
    "cpuUsage": 23,
    "diskUsage": 0,
    "activeConnections": 0,
    "lastHealthCheck": "2025-10-13T10:30:00.000Z"
  }
}
```

#### 3. Organizations with Statistics
**GET** `/api/super-admin/organizations`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "org-uuid",
      "name": "Healthcare Org 1",
      "isActive": true,
      "userCount": 150,
      "doctorCount": 20,
      "patientCount": 120,
      "consultationCount": 500,
      "lastActivity": "2025-10-13T10:30:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-10-13T10:30:00.000Z"
    }
  ]
}
```

#### 4. Recent Activities
**GET** `/api/super-admin/activities`

Query Parameters:
- `limit` (optional): Number of activities to return (default: `20`, max: `100`)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "activity-uuid",
      "type": "consultation",
      "description": "New consultation created",
      "timestamp": "2025-10-13T10:30:00.000Z",
      "severity": "INFO",
      "userId": "user-uuid",
      "resourceType": "CONSULTATION",
      "resourceId": "consultation-uuid"
    }
  ]
}
```

#### 5. User Statistics
**GET** `/api/super-admin/users/statistics`

Query Parameters:
- `timeRange` (optional): `7d`, `30d`, or `90d` (default: `30d`)

Response:
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "newUsers": 25,
    "activeUsers": 800,
    "usersByRole": {
      "DOCTOR": 150,
      "PATIENT": 1000,
      "ADMIN": 50,
      "SUPER_ADMIN": 5
    }
  }
}
```

#### 6. Security Events
**GET** `/api/super-admin/security/events`

Query Parameters:
- `limit` (optional): Number of events to return (default: `10`)
- `resolved` (optional): Filter by resolved status (`true` or `false`)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "event-uuid",
      "eventType": "AUTH_FAILURE",
      "severity": "WARNING",
      "description": "Multiple failed login attempts detected",
      "ipAddress": "192.168.1.100",
      "userId": null,
      "resolved": false,
      "timestamp": "2025-10-13T10:30:00.000Z"
    }
  ]
}
```

#### 7. Resolve Security Event
**PATCH** `/api/super-admin/security/events/:eventId/resolve`

Request Body:
```json
{
  "resolvedBy": "admin-user-id"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "event-uuid",
    "resolved": true,
    "resolvedAt": "2025-10-13T10:30:00.000Z"
  },
  "message": "Security event resolved successfully"
}
```

## Frontend Implementation

### Service Methods
The `SuperAdminService` in Angular provides the following methods:

1. **getSystemStatistics()**: Observable<SystemStatistics>
   - Fetches comprehensive system statistics

2. **getSystemHealth()**: Observable<SystemHealth>
   - Fetches system health metrics

3. **getOrganizationsWithStats()**: Observable<OrganizationWithStats[]>
   - Fetches all organizations with detailed statistics

4. **getRecentActivities(limit?: number)**: Observable<RecentActivity[]>
   - Fetches recent system activities

5. **getUserStatistics(timeRange?: '7d' | '30d' | '90d')**: Observable<UserStatistics>
   - Fetches user statistics for specified time range

6. **getSecurityEvents(limit?: number, resolved?: boolean)**: Observable<SecurityEvent[]>
   - Fetches security events

7. **resolveSecurityEvent(eventId: string, resolvedBy?: string)**: Observable<SecurityEvent>
   - Marks a security event as resolved

### Dashboard Component
The `DashboardSuperadminComponent` loads all data in parallel on initialization and displays:
- System overview statistics
- System health metrics
- Security events
- Quick action buttons for system management
- Organizations overview
- Recent system activities

## Testing

### Prerequisites
1. Ensure the backend server is running
2. Have a user with `SUPER_ADMIN` role
3. Have a valid JWT token

### Manual Testing Steps

1. **Login as Super Admin**
   ```bash
   # Use your auth endpoint to get a token
   POST /api/auth/login
   {
     "email": "superadmin@example.com",
     "password": "your-password"
   }
   ```

2. **Test System Statistics**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/statistics
   ```

3. **Test System Health**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/health
   ```

4. **Test Organizations**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/organizations
   ```

5. **Test Recent Activities**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/activities?limit=20
   ```

6. **Test User Statistics**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/users/statistics?timeRange=30d
   ```

7. **Test Security Events**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/super-admin/security/events?limit=10
   ```

### Frontend Testing
1. Navigate to the super-admin dashboard in your Angular application
2. Verify that all sections load without errors
3. Check browser console for any errors
4. Verify that data refreshes every 5 minutes (auto-refresh)

## Authentication & Authorization

All super-admin endpoints require:
1. Valid JWT token in the `Authorization` header
2. User must have `SUPER_ADMIN` role
3. Token must not be expired

Unauthorized requests will receive:
```json
{
  "success": false,
  "message": "Unauthorized access",
  "error": "INSUFFICIENT_PERMISSIONS"
}
```

## Notes

### Placeholder Data
Some features return placeholder data as they require additional infrastructure:
- `totalRevenue`: Requires billing/payment tracking system
- `databaseSize`: Requires database-specific queries
- `diskUsage`: Requires OS-level monitoring
- `activeConnections`: Requires connection pool tracking
- `apiRequestsToday`: Requires request tracking middleware
- Security events: Currently returns mock data, needs actual security event tracking

### Performance Considerations
- System statistics endpoint may be slow with large datasets
- Consider implementing caching for frequently accessed data
- Consider pagination for activities and events
- Auto-refresh interval is set to 5 minutes (configurable)

### Future Enhancements
1. Add caching layer for statistics
2. Implement real-time updates via WebSocket
3. Add export functionality for reports
4. Implement actual security event tracking
5. Add database size calculation
6. Add request tracking middleware
7. Add revenue tracking system
8. Add system alerts and notifications

