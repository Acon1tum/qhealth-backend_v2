# QHealth Backend

A comprehensive healthcare backend application built with Node.js, Express, TypeScript, and PostgreSQL using Prisma ORM.

## 🏥 Features

- **User Management**: Support for Doctors, Patients, and Admins
- **Doctor Categories**: Specialization-based doctor categorization
- **Consultation Management**: Virtual consultation scheduling and management
- **Health Monitoring**: Comprehensive health scan data collection and analysis
- **Patient Records**: Complete patient information management
- **Emergency Contacts**: Patient emergency contact information
- **Insurance Management**: Patient insurance information tracking
- **Doctor Scheduling**: Doctor availability and scheduling system

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- pnpm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd qhealth-backend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"
   JWT_SECRET="your_jwt_secret_key"
   PORT=3000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   pnpm db:generate
   
   # Push schema to database
   pnpm db:push
   ```

5. **Seed the Database**
   ```bash
   pnpm seed
   ```

6. **Start the Application**
   ```bash
   # Development mode
   pnpm dev
   
   # Production mode
   pnpm build
   pnpm start
   ```

## 🗄️ Database Schema

### Core Models

- **User**: Base user model with role-based access (Doctor, Patient, Admin)
- **DoctorInfo**: Detailed doctor information and qualifications
- **PatientInfo**: Comprehensive patient health records
- **DoctorCategory**: Medical specializations and categories
- **Consultation**: Virtual consultation management
- **HealthScan**: Detailed health monitoring data
- **DoctorSchedule**: Doctor availability scheduling
- **EmergencyContact**: Patient emergency contact information
- **InsuranceInfo**: Patient insurance details

### Relationships

- One-to-one relationships between User and DoctorInfo/PatientInfo
- One-to-many relationships for consultations and schedules
- Many-to-many relationships for doctor categories

## 🌱 Database Seeding

The seed script (`prisma/seed.ts`) creates comprehensive dummy data for testing:

### Created Data

- **1 Admin User**
  - Email: `admin@qhealth.com`
  - Password: `admin123`

- **5 Doctor Categories**
  - Cardiologist, Dermatologist, Neurologist, Orthopedist, Pediatrician

- **3 Doctors**
  - Dr. John Smith (Cardiologist)
  - Dr. Sarah Johnson (Dermatologist)
  - Dr. Michael Williams (Neurologist)
  - Password: `doctor123`

- **3 Patients**
  - Emily Anderson, David Brown, Maria Garcia
  - Password: `patient123`

- **3 Emergency Contacts**
  - One for each patient with realistic relationships

- **3 Insurance Records**
  - Different insurance providers for each patient

- **8 Doctor Schedules**
  - Various availability times across different days

- **3 Consultations**
  - Sample consultations between doctors and patients

- **2 Health Scans**
  - Comprehensive health data with risk assessments

### Running the Seed Script

```bash
# Seed the database
pnpm seed

# Or run directly
pnpm run seed
```

## 📚 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Users
- `GET /users` - Get all users (Admin only)
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user (Admin only)

### Doctors
- `GET /doctors` - Get all doctors
- `GET /doctors/:id` - Get doctor by ID
- `GET /doctors/category/:categoryId` - Get doctors by category
- `POST /doctors` - Create doctor (Admin only)
- `PUT /doctors/:id` - Update doctor
- `DELETE /doctors/:id` - Delete doctor (Admin only)

### Patients
- `GET /patients` - Get all patients (Admin/Doctor only)
- `GET /patients/:id` - Get patient by ID
- `POST /patients` - Create patient (Admin only)
- `PUT /patients/:id` - Update patient
- `DELETE /patients/:id` - Delete patient (Admin only)

### Consultations
- `GET /consultations` - Get all consultations
- `GET /consultations/:id` - Get consultation by ID
- `POST /consultations` - Create consultation
- `PUT /consultations/:id` - Update consultation
- `DELETE /consultations/:id` - Delete consultation

### Health Scans
- `GET /health-scans` - Get all health scans
- `GET /health-scans/:id` - Get health scan by ID
- `POST /health-scans` - Create health scan
- `PUT /health-scans/:id` - Update health scan
- `DELETE /health-scans/:id` - Delete health scan

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push         # Push schema changes to database
pnpm db:migrate      # Run database migrations
pnpm db:reset        # Reset database
pnpm db:studio       # Open Prisma Studio

# Seeding
pnpm seed            # Seed database with dummy data

# Build & Production
pnpm build           # Build TypeScript to JavaScript
pnpm start           # Start production server
```

### Project Structure

```
qhealth-backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Database seeding script
├── src/
│   ├── modules/         # Feature modules
│   │   └── email/       # Email functionality
│   └── index.ts         # Application entry point
├── package.json
├── tsconfig.json
└── README.md
```

## 🔒 Security Features

- **Password Hashing**: Bcrypt-based password encryption
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Different permissions for different user roles
- **Input Validation**: Request data validation and sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **Helmet**: Security headers and middleware

## 🧪 Testing

The application includes comprehensive dummy data for testing:

- **Test Users**: Pre-configured admin, doctor, and patient accounts
- **Realistic Data**: Medical information, schedules, and health metrics
- **Relationship Testing**: All database relationships are properly established

## 📝 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please open an issue in the repository or contact the development team.

---

**Note**: This is a healthcare application. Ensure all data handling complies with relevant healthcare data protection regulations (HIPAA, GDPR, etc.) in your jurisdiction.


