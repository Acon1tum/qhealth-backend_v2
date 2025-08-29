# QHealth Backend API Documentation

## Overview
This is a comprehensive healthcare backend system that handles patient-doctor consultations, appointment management, medical records, and privacy controls. The system ensures patient data privacy while enabling care continuity through controlled information sharing.

## Features
- **User Management**: Patients, Doctors, and Admins with role-based access control
- **Appointment System**: Request, confirm, reschedule, and cancel appointments
- **Consultation Management**: Create and manage consultations with health scans
- **Medical Records**: Comprehensive patient medical history with privacy controls
- **Privacy System**: Granular control over data sharing and access
- **Audit Logging**: Complete audit trail of all system activities
- **Security**: JWT authentication, rate limiting, and security headers

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Appointments
- `POST /api/appointments/request` - Create appointment request (Patients only)
- `GET /api/appointments/my-appointments` - Get user appointments
- `PATCH /api/appointments/:appointmentId/status` - Update appointment status (Doctors only)
- `POST /api/appointments/:appointmentId/reschedule` - Request reschedule
- `PATCH /api/appointments/reschedule/:rescheduleId/status` - Approve/reject reschedule
- `PATCH /api/appointments/:appointmentId/cancel` - Cancel appointment

### Consultations
- `POST /api/consultations/create` - Create consultation from appointment (Doctors only)
- `GET /api/consultations/:consultationId` - Get consultation details
- `PUT /api/consultations/:consultationId` - Update consultation (Doctors only)
- `POST /api/consultations/health-scan` - Create health scan (Doctors only)
- `GET /api/consultations/health-scan/:scanId` - Get health scan details
- `PATCH /api/consultations/:consultationId/privacy` - Update privacy settings
- `POST /api/consultations/:consultationId/share` - Share consultation with doctor

### Medical Records
- `POST /api/medical-records/create` - Create medical record
- `GET /api/medical-records/patient/:patientId` - Get patient medical records
- `PUT /api/medical-records/:recordId` - Update medical record
- `PATCH /api/medical-records/:recordId/privacy` - Update privacy settings
- `POST /api/medical-records/:recordId/share` - Share medical record
- `DELETE /api/medical-records/:recordId` - Delete medical record

### Email Services
- `POST /api/email/send` - Send email notifications

## Data Models

### User Roles
- **PATIENT**: Can create appointments, view their medical records, manage privacy
- **DOCTOR**: Can manage appointments, create consultations, access shared records
- **ADMIN**: Full system access for management

### Privacy Levels
- **Private** (default): Only patient and original doctor can access
- **Public**: All doctors can read (patient choice)
- **Shared Specific**: Only selected doctors can access
- **Time Limited**: Access expires after certain period
- **Role Based**: Access based on medical specialization

### Access Levels
- **READ_ONLY**: Can only view records
- **READ_WITH_NOTES**: Can see doctor's notes
- **READ_WITH_HISTORY**: Can see related medical history
- **FULL_ACCESS**: Full access (rare, for specialists)

## Privacy & Security Features

### Patient Data Control
- Patients control their own data privacy
- Granular sharing permissions
- Time-limited access grants
- Audit trail of all data access

### Doctor Access Control
- Role-based access permissions
- Specialization-based restrictions
- Patient approval requirements
- Access expiration controls

### Security Measures
- JWT authentication with refresh tokens
- Rate limiting and IP blocking
- Input sanitization and validation
- Comprehensive audit logging
- Security event monitoring

## Workflow Examples

### 1. Patient Consultation Request
```
1. Patient creates appointment request
2. Doctor reviews and approves
3. Consultation takes place
4. Health scan performed and stored
5. Medical records created
6. Patient controls privacy settings
```

### 2. Data Sharing for Care Continuity
```
1. Patient consults with Doctor A
2. Patient later sees Doctor B
3. Patient shares relevant records with Doctor B
4. Doctor B can read but not modify records
5. Access can be time-limited or permanent
```

### 3. Rescheduling Process
```
1. Either party requests reschedule
2. Other party approves/rejects
3. Appointment updated with new time
4. Audit trail maintained
```

## Environment Variables

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
EMAIL_SERVICE_API_KEY="your-email-service-key"
NODE_ENV="development"
```

## Database Setup

1. **Install Prisma**: `npm install prisma`
2. **Generate Client**: `npx prisma generate`
3. **Run Migrations**: `npx prisma migrate dev`
4. **Seed Database**: `npx prisma db seed`

## Running the Application

1. **Install Dependencies**: `npm install`
2. **Setup Environment**: Copy `.env.example` to `.env`
3. **Database Setup**: Follow database setup steps above
4. **Start Server**: `npm run dev` or `npm start`

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Rate Limiting

- **General**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **API Endpoints**: 1000 requests per hour per user

## Security Headers

- **CSP**: Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **XSS Protection**: Cross-site scripting protection
- **Frame Options**: Clickjacking protection
- **Referrer Policy**: Referrer information control

## Audit Logging

All system activities are logged including:
- User authentication
- Data access and modifications
- Privacy setting changes
- Security events
- API usage patterns

## Support & Contact

For technical support or questions about the API, please contact the development team.

---

**Note**: This API is designed for healthcare applications and includes comprehensive privacy controls to ensure HIPAA compliance and patient data protection.
