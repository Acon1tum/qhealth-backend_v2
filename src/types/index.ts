import { Role, Sex, MedicalLicenseLevel, PhilHealthAccreditation } from '@prisma/client';

// Re-export Prisma types for use in other modules
export { Role, Sex, MedicalLicenseLevel, PhilHealthAccreditation };

// User Types
export interface IUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  profilePicture: string | null;
  profilePictureVerified: boolean;
  profilePictureVerifiedBy: string | null;
  profilePictureVerifiedAt: Date | null;
}

export interface IUserWithPassword extends IUser {
  password: string;
}

export interface IUserProfile extends IUser {
  doctorInfo?: IDoctorInfo;
  patientInfo?: IPatientInfo;
}

// Doctor Types
export interface IDoctorInfo {
  id: string;
  userId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Sex;
  dateOfBirth: Date;
  contactNumber: string;
  address: string;
  bio: string;
  specialization: string;
  qualifications: string;
  experience: number;
  // Medical License Information
  prcId: string | null;
  ptrId: string | null;
  medicalLicenseLevel: MedicalLicenseLevel | null;
  philHealthAccreditation: PhilHealthAccreditation | null;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  isLicenseActive: boolean;
  // Additional License Information
  additionalCertifications: string | null;
  licenseIssuedBy: string | null;
  licenseIssuedDate: Date | null;
  renewalRequired: boolean;
  // ID Document Uploads (Base64 encoded)
  prcIdImage: string | null;
  ptrIdImage: string | null;
  medicalLicenseImage: string | null;
  additionalIdImages: string | null;
  idDocumentsVerified: boolean;
  idDocumentsVerifiedBy: string | null;
  idDocumentsVerifiedAt: Date | null;
}

export interface IDoctorWithUser extends IDoctorInfo {
  user: IUser;
  doctorCategories: IDoctorCategory[];
}

// Patient Types
export interface IPatientInfo {
  id: string;
  userId: string;
  fullName: string;
  gender: Sex;
  dateOfBirth: Date;
  contactNumber: string;
  address: string;
  weight: number;
  height: number;
  bloodType: string;
  medicalHistory: string | null;
  allergies: string | null;
  medications: string | null;
}

export interface IPatientWithUser extends IPatientInfo {
  user: IUser;
  emergencyContact?: IEmergencyContact;
  insuranceInfo?: IInsuranceInfo;
}

// Doctor Category Types
export interface IDoctorCategory {
  id: string;
  name: string;
  description?: string;
}

// Emergency Contact Types
export interface IEmergencyContact {
  id: string;
  patientId: string;
  contactName: string;
  relationship: string;
  contactNumber: string;
  contactAddress?: string;
}

// Insurance Info Types
export interface IInsuranceInfo {
  id: string;
  patientId: string;
  providerName: string;
  policyNumber: string;
  insuranceContact: string;
}

// Consultation Types
export interface IConsultation {
  id: string;
  doctorId: string;
  patientId: string;
  startTime: Date;
  endTime?: Date;
  consultationLink: string;
}

export interface IConsultationWithRelations extends IConsultation {
  doctor: IUser;
  patient: IUser;
  healthScan?: IHealthScan;
}

// Health Scan Types
export interface IHealthScan {
  id: string;
  consultationId: string;
  bloodPressure?: string;
  heartRate?: number;
  spO2?: number;
  respiratoryRate?: number;
  stressLevel?: number;
  stressScore?: number;
  hrvSdnn?: number;
  hrvRmsdd?: number;
  generalWellness?: number;
  generalRisk?: number;
  coronaryHeartDisease?: number;
  congestiveHeartFailure?: number;
  intermittentClaudication?: number;
  strokeRisk?: number;
  covidRisk?: number;
  height?: number;
  weight?: number;
  smoker?: boolean;
  hypertension?: boolean;
  bpMedication?: boolean;
  diabetic?: number;
  waistCircumference?: number;
  heartDisease?: boolean;
  depression?: boolean;
  totalCholesterol?: number;
  hdl?: number;
  parentalHypertension?: number;
  physicalActivity?: boolean;
  healthyDiet?: boolean;
  antiHypertensive?: boolean;
  historyBloodGlucose?: boolean;
  historyFamilyDiabetes?: number;
}

// Doctor Schedule Types
export interface IDoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: string;
  startTime: Date;
  endTime: Date;
}

export interface IDoctorScheduleWithDoctor extends IDoctorSchedule {
  doctor: IUser;
}

// Authentication Types
export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  specialization?: string;
  qualifications?: string;
  experience?: number;
  fullName?: string;
  gender?: Sex;
  dateOfBirth?: string;
  contactNumber?: string;
  address?: string;
  bio?: string;
  weight?: number;
  height?: number;
  bloodType?: string;
  medicalHistory?: string;
  allergies?: string;
  medications?: string;
  // Medical License Information (for doctor)
  prcId?: string;
  ptrId?: string;
  medicalLicenseLevel?: MedicalLicenseLevel;
  philHealthAccreditation?: PhilHealthAccreditation;
  licenseNumber?: string;
  licenseExpiry?: string;
  isLicenseActive?: boolean;
  additionalCertifications?: string;
  licenseIssuedBy?: string;
  licenseIssuedDate?: string;
  renewalRequired?: boolean;
  // ID Document Uploads (for doctor)
  prcIdImage?: string;
  ptrIdImage?: string;
  medicalLicenseImage?: string;
  additionalIdImages?: string;
  // Emergency Contact (for patient)
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  emergencyContactAddress?: string;
  // Insurance Info (for patient)
  insuranceProviderName?: string;
  insurancePolicyNumber?: string;
  insuranceContact?: string;
}

export interface IAuthResponse {
  user: IUserProfile;
  token: string;
  refreshToken: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IUpdateProfileRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  bio?: string;
  contactNumber?: string;
  address?: string;
  specialization?: string;
  qualifications?: string;
  experience?: number;
  fullName?: string;
  gender?: Sex;
  dateOfBirth?: string;
  weight?: number;
  height?: number;
  bloodType?: string;
  medicalHistory?: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: {
    contactName: string;
    relationship: string;
    contactNumber: string;
    contactAddress?: string;
  };
  // Profile Picture (for all users)
  profilePicture?: string;
  // Medical License Information (for doctor)
  prcId?: string;
  ptrId?: string;
  medicalLicenseLevel?: MedicalLicenseLevel;
  philHealthAccreditation?: PhilHealthAccreditation;
  licenseNumber?: string;
  licenseExpiry?: string;
  isLicenseActive?: boolean;
  additionalCertifications?: string;
  licenseIssuedBy?: string;
  licenseIssuedDate?: string;
  renewalRequired?: boolean;
  // ID Document Uploads (for doctor)
  prcIdImage?: string;
  ptrIdImage?: string;
  medicalLicenseImage?: string;
  additionalIdImages?: string;
}

// JWT Payload Types
export interface IJWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface IRefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

// API Response Types
export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: IPagination;
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error Types
export interface IApiError {
  statusCode: number;
  message: string;
  error?: string;
  stack?: string;
}

// Request Types
export interface IAuthenticatedRequest extends Request {
  user?: IUserProfile;
  token?: string;
}

// Filter Types
export interface IUserFilters {
  role?: Role;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IDoctorFilters {
  categoryId?: string;
  specialization?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IPatientFilters {
  search?: string;
  bloodType?: string;
  page?: number;
  limit?: number;
}

export interface IConsultationFilters {
  doctorId?: string;
  patientId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// Validation Types
export interface IValidationError {
  field: string;
  message: string;
}

export interface IValidationResult {
  isValid: boolean;
  errors: IValidationError[];
}

// Audit Log Types
export interface IAuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ICreateAuditLogRequest {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Email Types
export interface IEmailRequest {
  to: string;
  subject: string;
  template: string;
  data?: any;
}

export interface IEmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

// File Upload Types
export interface IFileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

// Search Types
export interface ISearchRequest {
  query: string;
  filters?: any;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Export Types
export interface IExportRequest {
  format: 'csv' | 'excel' | 'pdf';
  filters?: any;
  fields?: string[];
}

// Notification Types
export interface INotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: Date;
}

export interface ICreateNotificationRequest {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

// Dashboard Types
export interface IDashboardStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalConsultations: number;
  totalHealthScans: number;
  recentConsultations: IConsultationWithRelations[];
  upcomingConsultations: IConsultationWithRelations[];
  healthMetrics: {
    averageHeartRate: number;
    averageStressLevel: number;
    averageWellness: number;
  };
}

// Health Metrics Types
export interface IHealthMetrics {
  userId: string;
  date: Date;
  heartRate: number;
  bloodPressure: string;
  spO2: number;
  stressLevel: number;
  wellness: number;
}

export interface IHealthTrends {
  period: string;
  metrics: IHealthMetrics[];
  averages: {
    heartRate: number;
    stressLevel: number;
    wellness: number;
  };
}
