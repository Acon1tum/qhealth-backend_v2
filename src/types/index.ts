import { Role, Sex } from '@prisma/client';

// Re-export Prisma types for use in other modules
export { Role, Sex };

// User Types
export interface IUser {
  id: number;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
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
  id: number;
  userId: number;
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
}

export interface IDoctorWithUser extends IDoctorInfo {
  user: IUser;
  doctorCategories: IDoctorCategory[];
}

// Patient Types
export interface IPatientInfo {
  id: number;
  userId: number;
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
  id: number;
  name: string;
  description?: string;
}

// Emergency Contact Types
export interface IEmergencyContact {
  id: number;
  patientId: number;
  contactName: string;
  relationship: string;
  contactNumber: string;
  contactAddress?: string;
}

// Insurance Info Types
export interface IInsuranceInfo {
  id: number;
  patientId: number;
  providerName: string;
  policyNumber: string;
  insuranceContact: string;
}

// Consultation Types
export interface IConsultation {
  id: number;
  doctorId: number;
  patientId: number;
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
  id: number;
  consultationId: number;
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
  id: number;
  doctorId: number;
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
}

// JWT Payload Types
export interface IJWTPayload {
  userId: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface IRefreshTokenPayload {
  userId: number;
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
  categoryId?: number;
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
  doctorId?: number;
  patientId?: number;
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
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId?: number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ICreateAuditLogRequest {
  userId: number;
  action: string;
  resource: string;
  resourceId?: number;
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
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: Date;
}

export interface ICreateNotificationRequest {
  userId: number;
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
  userId: number;
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
