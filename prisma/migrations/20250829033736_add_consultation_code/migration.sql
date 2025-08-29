-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOCTOR', 'PATIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'DATA_ACCESS', 'DATA_MODIFICATION', 'SECURITY', 'SYSTEM', 'USER_ACTIVITY');

-- CreateEnum
CREATE TYPE "AuditLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RescheduleProposedBy" AS ENUM ('PATIENT', 'DOCTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PrivacySettingType" AS ENUM ('PUBLIC_READ', 'PUBLIC_WRITE', 'SHARED_SPECIFIC', 'PATIENT_APPROVED', 'TIME_LIMITED', 'ROLE_BASED');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ_ONLY', 'READ_WITH_NOTES', 'READ_WITH_HISTORY', 'FULL_ACCESS');

-- CreateEnum
CREATE TYPE "MedicalRecordType" AS ENUM ('CONSULTATION_NOTES', 'DIAGNOSIS', 'TREATMENT_PLAN', 'MEDICATION', 'LAB_RESULTS', 'IMAGING_RESULTS', 'ALLERGIES', 'CHRONIC_CONDITIONS', 'SURGICAL_HISTORY', 'FAMILY_HISTORY', 'LIFESTYLE', 'VACCINATIONS');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "DoctorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorInfo" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" "Sex" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "experience" INTEGER NOT NULL,

    CONSTRAINT "DoctorInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "consultationLink" TEXT NOT NULL,
    "consultationCode" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScan" (
    "id" SERIAL NOT NULL,
    "consultationId" INTEGER NOT NULL,
    "bloodPressure" TEXT,
    "heartRate" DOUBLE PRECISION,
    "spO2" DOUBLE PRECISION,
    "respiratoryRate" DOUBLE PRECISION,
    "stressLevel" DOUBLE PRECISION,
    "stressScore" DOUBLE PRECISION,
    "hrvSdnn" DOUBLE PRECISION,
    "hrvRmsdd" DOUBLE PRECISION,
    "generalWellness" DOUBLE PRECISION,
    "generalRisk" DOUBLE PRECISION,
    "coronaryHeartDisease" DOUBLE PRECISION,
    "congestiveHeartFailure" DOUBLE PRECISION,
    "intermittentClaudication" DOUBLE PRECISION,
    "strokeRisk" DOUBLE PRECISION,
    "covidRisk" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "smoker" BOOLEAN,
    "hypertension" BOOLEAN,
    "bpMedication" BOOLEAN,
    "diabetic" INTEGER,
    "waistCircumference" DOUBLE PRECISION,
    "heartDisease" BOOLEAN,
    "depression" BOOLEAN,
    "totalCholesterol" DOUBLE PRECISION,
    "hdl" DOUBLE PRECISION,
    "parentalHypertension" INTEGER,
    "physicalActivity" BOOLEAN,
    "healthyDiet" BOOLEAN,
    "antiHypertensive" BOOLEAN,
    "historyBloodGlucose" BOOLEAN,
    "historyFamilyDiabetes" INTEGER,

    CONSTRAINT "HealthScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientInfo" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "Sex" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "bloodType" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "medications" TEXT,

    CONSTRAINT "PatientInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "contactAddress" TEXT,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceInfo" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "providerName" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "insuranceContact" TEXT NOT NULL,

    CONSTRAINT "InsuranceInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "level" "AuditLevel" NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "AuditLevel" NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "userId" INTEGER,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" INTEGER,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestedTime" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consultationId" INTEGER,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescheduleRequest" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "requestedBy" INTEGER NOT NULL,
    "requestedByRole" "Role" NOT NULL,
    "currentDate" TIMESTAMP(3) NOT NULL,
    "currentTime" TEXT NOT NULL,
    "newDate" TIMESTAMP(3) NOT NULL,
    "newTime" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "proposedBy" "RescheduleProposedBy" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationPrivacy" (
    "id" SERIAL NOT NULL,
    "consultationId" INTEGER NOT NULL,
    "settingType" "PrivacySettingType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationPrivacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSharing" (
    "id" SERIAL NOT NULL,
    "consultationId" INTEGER NOT NULL,
    "sharedWithDoctorId" INTEGER NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'READ_ONLY',
    "sharedBy" INTEGER NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConsultationSharing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMedicalHistory" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "consultationId" INTEGER,
    "recordType" "MedicalRecordType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedicalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecordPrivacy" (
    "id" SERIAL NOT NULL,
    "medicalRecordId" INTEGER NOT NULL,
    "settingType" "PrivacySettingType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRecordPrivacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScanPrivacy" (
    "id" SERIAL NOT NULL,
    "healthScanId" INTEGER NOT NULL,
    "settingType" "PrivacySettingType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthScanPrivacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScanSharing" (
    "id" SERIAL NOT NULL,
    "healthScanId" INTEGER NOT NULL,
    "sharedWithDoctorId" INTEGER NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'READ_ONLY',
    "sharedBy" INTEGER NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HealthScanSharing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DoctorCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DoctorCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorCategory_name_key" ON "DoctorCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorInfo_userId_key" ON "DoctorInfo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_consultationCode_key" ON "Consultation"("consultationCode");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScan_consultationId_key" ON "HealthScan"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientInfo_userId_key" ON "PatientInfo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_patientId_key" ON "EmergencyContact"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceInfo_patientId_key" ON "InsuranceInfo"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX "audit_logs_level_idx" ON "audit_logs"("level");

-- CreateIndex
CREATE INDEX "security_events_userId_idx" ON "security_events"("userId");

-- CreateIndex
CREATE INDEX "security_events_timestamp_idx" ON "security_events"("timestamp");

-- CreateIndex
CREATE INDEX "security_events_eventType_idx" ON "security_events"("eventType");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_resolved_idx" ON "security_events"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRequest_consultationId_key" ON "AppointmentRequest"("consultationId");

-- CreateIndex
CREATE INDEX "AppointmentRequest_patientId_idx" ON "AppointmentRequest"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentRequest_doctorId_idx" ON "AppointmentRequest"("doctorId");

-- CreateIndex
CREATE INDEX "AppointmentRequest_status_idx" ON "AppointmentRequest"("status");

-- CreateIndex
CREATE INDEX "AppointmentRequest_requestedDate_idx" ON "AppointmentRequest"("requestedDate");

-- CreateIndex
CREATE INDEX "RescheduleRequest_appointmentId_idx" ON "RescheduleRequest"("appointmentId");

-- CreateIndex
CREATE INDEX "RescheduleRequest_requestedBy_idx" ON "RescheduleRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "RescheduleRequest_status_idx" ON "RescheduleRequest"("status");

-- CreateIndex
CREATE INDEX "RescheduleRequest_newDate_idx" ON "RescheduleRequest"("newDate");

-- CreateIndex
CREATE INDEX "ConsultationPrivacy_consultationId_idx" ON "ConsultationPrivacy"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationPrivacy_consultationId_settingType_key" ON "ConsultationPrivacy"("consultationId", "settingType");

-- CreateIndex
CREATE INDEX "ConsultationSharing_consultationId_idx" ON "ConsultationSharing"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationSharing_sharedWithDoctorId_idx" ON "ConsultationSharing"("sharedWithDoctorId");

-- CreateIndex
CREATE INDEX "ConsultationSharing_sharedBy_idx" ON "ConsultationSharing"("sharedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSharing_consultationId_sharedWithDoctorId_key" ON "ConsultationSharing"("consultationId", "sharedWithDoctorId");

-- CreateIndex
CREATE INDEX "PatientMedicalHistory_patientId_idx" ON "PatientMedicalHistory"("patientId");

-- CreateIndex
CREATE INDEX "PatientMedicalHistory_consultationId_idx" ON "PatientMedicalHistory"("consultationId");

-- CreateIndex
CREATE INDEX "PatientMedicalHistory_isPublic_idx" ON "PatientMedicalHistory"("isPublic");

-- CreateIndex
CREATE INDEX "PatientMedicalHistory_recordType_idx" ON "PatientMedicalHistory"("recordType");

-- CreateIndex
CREATE INDEX "MedicalRecordPrivacy_medicalRecordId_idx" ON "MedicalRecordPrivacy"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecordPrivacy_medicalRecordId_settingType_key" ON "MedicalRecordPrivacy"("medicalRecordId", "settingType");

-- CreateIndex
CREATE INDEX "HealthScanPrivacy_healthScanId_idx" ON "HealthScanPrivacy"("healthScanId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScanPrivacy_healthScanId_settingType_key" ON "HealthScanPrivacy"("healthScanId", "settingType");

-- CreateIndex
CREATE INDEX "HealthScanSharing_healthScanId_idx" ON "HealthScanSharing"("healthScanId");

-- CreateIndex
CREATE INDEX "HealthScanSharing_sharedWithDoctorId_idx" ON "HealthScanSharing"("sharedWithDoctorId");

-- CreateIndex
CREATE INDEX "HealthScanSharing_sharedBy_idx" ON "HealthScanSharing"("sharedBy");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScanSharing_healthScanId_sharedWithDoctorId_key" ON "HealthScanSharing"("healthScanId", "sharedWithDoctorId");

-- CreateIndex
CREATE INDEX "_DoctorCategories_B_index" ON "_DoctorCategories"("B");

-- AddForeignKey
ALTER TABLE "DoctorInfo" ADD CONSTRAINT "DoctorInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScan" ADD CONSTRAINT "HealthScan_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInfo" ADD CONSTRAINT "PatientInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_patient_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientInfo"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceInfo" ADD CONSTRAINT "InsuranceInfo_patient_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceInfo" ADD CONSTRAINT "InsuranceInfo_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientInfo"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "AppointmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPrivacy" ADD CONSTRAINT "ConsultationPrivacy_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSharing" ADD CONSTRAINT "ConsultationSharing_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSharing" ADD CONSTRAINT "ConsultationSharing_sharedWithDoctorId_fkey" FOREIGN KEY ("sharedWithDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSharing" ADD CONSTRAINT "ConsultationSharing_sharedBy_fkey" FOREIGN KEY ("sharedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedicalHistory" ADD CONSTRAINT "PatientMedicalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedicalHistory" ADD CONSTRAINT "PatientMedicalHistory_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedicalHistory" ADD CONSTRAINT "PatientMedicalHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordPrivacy" ADD CONSTRAINT "MedicalRecordPrivacy_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "PatientMedicalHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScanPrivacy" ADD CONSTRAINT "HealthScanPrivacy_healthScanId_fkey" FOREIGN KEY ("healthScanId") REFERENCES "HealthScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScanSharing" ADD CONSTRAINT "HealthScanSharing_healthScanId_fkey" FOREIGN KEY ("healthScanId") REFERENCES "HealthScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScanSharing" ADD CONSTRAINT "HealthScanSharing_sharedWithDoctorId_fkey" FOREIGN KEY ("sharedWithDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScanSharing" ADD CONSTRAINT "HealthScanSharing_sharedBy_fkey" FOREIGN KEY ("sharedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DoctorCategories" ADD CONSTRAINT "_DoctorCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "DoctorCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DoctorCategories" ADD CONSTRAINT "_DoctorCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
