# 🏥 QHealth Backend - Getting Started Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **PostgreSQL** database
- **npm** or **pnpm** package manager

### 1. Clone and Install
```bash
# Navigate to project directory
cd qhealth-backend_v2

# Install dependencies
npm install
# or
pnpm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
DATABASE_URL="postgresql://username:password@localhost:5432/qhealth_v2"
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
NODE_ENV="development"
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed with sample data
npx prisma db seed
```

### 4. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🏗️ System Architecture

### Core Modules
```
src/
├── modules/
│   ├── auth/           # Authentication & authorization
│   ├── appointments/   # Appointment management
│   ├── consultations/  # Consultation & health scans
│   ├── medical-records/# Medical history & privacy
│   └── email/         # Email notifications
├── shared/
│   ├── middleware/     # Auth, validation, error handling
│   └── services/       # Audit, security, email
└── config/             # Security & environment config
```

### Database Schema
- **Users**: Patients, Doctors, Admins
- **Appointments**: Request → Confirm → Reschedule → Complete
- **Consultations**: Doctor-patient sessions with health scans
- **Medical Records**: Comprehensive health history with privacy controls
- **Privacy System**: Granular access control and sharing

## 🔐 Authentication Flow

### 1. User Registration
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "role": "PATIENT"
}
```

### 2. User Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### 3. Using JWT Token
```bash
# Include in headers
Authorization: Bearer <your-jwt-token>
```

## 📅 Appointment Workflow

### 1. Patient Requests Appointment
```bash
POST /api/appointments/request
{
  "patientId": 1,
  "doctorId": 2,
  "requestedDate": "2024-01-15",
  "requestedTime": "10:00",
  "reason": "Annual checkup",
  "priority": "NORMAL"
}
```

### 2. Doctor Approves/Rejects
```bash
PATCH /api/appointments/1/status
{
  "status": "CONFIRMED"
}
```

### 3. Reschedule (if needed)
```bash
POST /api/appointments/1/reschedule
{
  "newDate": "2024-01-16",
  "newTime": "14:00",
  "reason": "Doctor unavailable"
}
```

## 👨‍⚕️ Consultation Management

### 1. Create Consultation
```bash
POST /api/consultations/create
{
  "appointmentId": 1,
  "startTime": "2024-01-15T10:00:00Z",
  "consultationLink": "https://meet.example.com/123",
  "notes": "Patient presents with..."
}
```

### 2. Add Health Scan
```bash
POST /api/consultations/health-scan
{
  "consultationId": 1,
  "healthData": {
    "heartRate": 75,
    "bloodPressure": "120/80",
    "spO2": 98
  }
}
```

### 3. Update Consultation
```bash
PUT /api/consultations/1
{
  "diagnosis": "Hypertension",
  "treatment": "Lifestyle changes + medication",
  "followUpDate": "2024-02-15"
}
```

## 📋 Medical Records & Privacy

### 1. Create Medical Record
```bash
POST /api/medical-records/create
{
  "patientId": 1,
  "consultationId": 1,
  "recordType": "DIAGNOSIS",
  "title": "Hypertension Diagnosis",
  "content": "Patient diagnosed with stage 1 hypertension...",
  "isPublic": false
}
```

### 2. Manage Privacy Settings
```bash
PATCH /api/medical-records/1/privacy
{
  "privacySettings": [
    {
      "settingType": "PUBLIC_READ",
      "isEnabled": false
    },
    {
      "settingType": "SHARED_SPECIFIC",
      "isEnabled": true
    }
  ]
}
```

### 3. Share with Specific Doctor
```bash
POST /api/medical-records/1/share
{
  "doctorId": 3,
  "accessLevel": "READ_ONLY",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

## 🧪 Testing the API

### Run Test Script
```bash
# Test all endpoints (will show auth errors - this is normal)
node test-api.js
```

### Manual Testing with curl
```bash
# Health check
curl http://localhost:3000/api/health

# Test protected endpoint (will fail without auth)
curl http://localhost:3000/api/appointments/my-appointments
```

### Expected Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **200/201 Success**: Operation completed successfully

## 🔒 Security Features

### Authentication
- JWT tokens with refresh mechanism
- Role-based access control (RBAC)
- Password hashing with bcrypt

### Privacy Controls
- Patient data ownership
- Granular sharing permissions
- Time-limited access grants
- Audit trail for all operations

### API Security
- Rate limiting (100 req/15min)
- Input validation and sanitization
- CORS protection
- Security headers (CSP, HSTS, XSS protection)

## 📊 Database Management

### Prisma Commands
```bash
# View database in Prisma Studio
npx prisma studio

# Reset database (⚠️ destroys all data)
npx prisma migrate reset

# Generate new migration
npx prisma migrate dev --name add_new_feature

# Deploy to production
npx prisma migrate deploy
```

### Database Schema Changes
1. Modify `prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev`
3. Update Prisma client: `npx prisma generate`

## 🚀 Deployment

### Environment Variables
```bash
# Production settings
NODE_ENV="production"
PORT=3000
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="production-secret-key"
JWT_REFRESH_SECRET="production-refresh-key"
```

### PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs
```

### Docker Deployment
```bash
# Build image
docker build -t qhealth-backend .

# Run container
docker run -p 3000:3000 --env-file .env qhealth-backend
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

#### 2. JWT Token Issues
```bash
# Check JWT secrets in .env
echo $JWT_SECRET
echo $JWT_REFRESH_SECRET

# Verify token format
# Should be: Bearer <token>
```

#### 3. Permission Denied
```bash
# Check user role in database
npx prisma studio

# Verify middleware configuration
# Check auth-middleware.ts
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# View detailed Prisma queries
DEBUG=prisma:query npm run dev
```

## 📚 API Documentation

### Full API Reference
See `API_DOCUMENTATION.md` for complete endpoint documentation.

### Interactive Documentation
- Swagger/OpenAPI docs (if implemented)
- Postman collection (if available)

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

### Code Standards
- Use TypeScript
- Follow ESLint rules
- Add JSDoc comments
- Include error handling
- Write unit tests

## 📞 Support

### Getting Help
- Check this documentation
- Review API documentation
- Check GitHub issues
- Contact development team

### Reporting Issues
- Include error messages
- Provide reproduction steps
- Share environment details
- Include relevant logs

---

**🎉 Congratulations!** You now have a fully functional healthcare backend system with comprehensive privacy controls, appointment management, and medical record handling.

**Next Steps:**
1. Test the API endpoints
2. Set up your frontend application
3. Configure production environment
4. Deploy to your hosting platform

**Remember:** This system is designed for healthcare applications and includes HIPAA-compliant privacy controls. Always ensure proper security measures are in place for production use.

