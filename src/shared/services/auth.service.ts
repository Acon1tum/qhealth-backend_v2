import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import securityConfig from '../../config/security.config';
import {
  ILoginRequest,
  IRegisterRequest,
  IAuthResponse,
  IRefreshTokenRequest,
  IChangePasswordRequest,
  IUpdateProfileRequest,
  IUserProfile,
  IJWTPayload,
} from '../../types';

const prisma = new PrismaClient();

function signAccessToken(payload: IJWTPayload): string {
  return jwt.sign(payload, securityConfig.jwt.accessToken.secret, {
    algorithm: securityConfig.jwt.accessToken.algorithm,
    expiresIn: securityConfig.jwt.accessToken.expiresIn,
  });
}

function calculateExpiryDate(days: number): Date {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now;
}

export class AuthService {
  static validatePasswordStrength(password: string): boolean {
    // Password must be at least 8 characters long
    if (password.length < 8) {
      return false;
    }
    
    // Password must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }
    
    // Password must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }
    
    // Password must contain at least one number
    if (!/\d/.test(password)) {
      return false;
    }
    
    // Password must contain at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }
    
    return true;
  }

  static async login(request: ILoginRequest): Promise<IAuthResponse> {
    const { email, password } = request;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const payload: IJWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
    };

    const token = signAccessToken(payload);

    // Create refresh token (random UUID stored in DB)
    const refreshTokenValue = uuidv4();
    const refreshToken = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: calculateExpiryDate(7),
      },
    });

    const userProfile = user as unknown as IUserProfile;

    return {
      user: userProfile,
      token,
      refreshToken: refreshToken.token,
    };
  }

  static async register(request: IRegisterRequest): Promise<IAuthResponse> {
    const { email, password, role } = request;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user based on role
    if (role === 'PATIENT') {
      const { fullName, gender, dateOfBirth, contactNumber, address, weight, height, bloodType, medicalHistory, allergies, medications, emergencyContactName, emergencyContactRelationship, emergencyContactNumber, emergencyContactAddress, insuranceProviderName, insurancePolicyNumber, insuranceContact } = request;

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role as any,
          patientInfo: {
            create: {
              fullName: fullName!,
              gender: gender as any,
              dateOfBirth: new Date(dateOfBirth!),
              contactNumber: contactNumber!,
              address: address!,
              weight: weight!,
              height: height!,
              bloodType: bloodType!,
              medicalHistory: medicalHistory || null,
              allergies: allergies || null,
              medications: medications || null,
            },
          },
        },
        include: {
          patientInfo: true,
        },
      });

      // Create emergency contact if provided
      if (emergencyContactName) {
        await prisma.emergencyContact.create({
          data: {
            patientId: user.id,
            contactName: emergencyContactName,
            relationship: emergencyContactRelationship || '',
            contactNumber: emergencyContactNumber || '',
            contactAddress: emergencyContactAddress || null,
          },
        });
      }

      // Create insurance info if provided
      if (insuranceProviderName) {
        await prisma.insuranceInfo.create({
          data: {
            patientId: user.id,
            providerName: insuranceProviderName,
            policyNumber: insurancePolicyNumber || '',
            insuranceContact: insuranceContact || '',
          },
        });
      }

      const payload: IJWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as any,
      };

      const token = signAccessToken(payload);

      // Create refresh token
      const refreshTokenValue = uuidv4();
      const refreshToken = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshTokenValue,
          expiresAt: calculateExpiryDate(7),
        },
      });

      const userProfile = user as unknown as IUserProfile;

      return {
        user: userProfile,
        token,
        refreshToken: refreshToken.token,
      };
    } else if (role === 'DOCTOR') {
      const { firstName, lastName, specialization, qualifications, experience, gender, dateOfBirth, contactNumber, address, bio } = request;

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role as any,
          doctorInfo: {
            create: {
              firstName: firstName!,
              lastName: lastName!,
              gender: gender as any,
              dateOfBirth: new Date(dateOfBirth!),
              contactNumber: contactNumber!,
              address: address!,
              bio: bio || '',
              specialization: specialization!,
              qualifications: qualifications!,
              experience: experience!,
            },
          },
        },
        include: {
          doctorInfo: true,
        },
      });

      const payload: IJWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as any,
      };

      const token = signAccessToken(payload);

      // Create refresh token
      const refreshTokenValue = uuidv4();
      const refreshToken = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshTokenValue,
          expiresAt: calculateExpiryDate(7),
        },
      });

      const userProfile = user as unknown as IUserProfile;

      return {
        user: userProfile,
        token,
        refreshToken: refreshToken.token,
      };
    } else {
      throw new Error('Invalid role specified');
    }
  }

  static async refreshToken(request: IRefreshTokenRequest): Promise<{ token: string; refreshToken: string }> {
    const { refreshToken } = request;

    const existing = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!existing || existing.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const newAccessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role as any });

    // Rotate refresh token
    const newRefreshTokenValue = uuidv4();
    const updated = await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { token: newRefreshTokenValue, expiresAt: calculateExpiryDate(7) },
    });

    return { token: newAccessToken, refreshToken: updated.token };
  }

  static async changePassword(_userId: string, _request: IChangePasswordRequest): Promise<void> {
    throw new Error('Change password not implemented');
  }

  static async updateProfile(userId: string, request: IUpdateProfileRequest): Promise<IUserProfile> {
    // Update User table fields
    const userUpdateData: any = {};
    
    if (Object.prototype.hasOwnProperty.call(request, 'profilePicture')) {
      userUpdateData.profilePicture = (request.profilePicture === null || request.profilePicture === undefined || request.profilePicture === '')
        ? null
        : request.profilePicture;
      userUpdateData.profilePictureVerified = false;
      userUpdateData.profilePictureVerifiedBy = null;
      userUpdateData.profilePictureVerifiedAt = null;
    }

    if (request.email !== undefined) {
      userUpdateData.email = request.email;
    }

    // Update User table if there are changes
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    // Update DoctorInfo table fields
    const doctorUpdateData: any = {};
    
    if (request.firstName !== undefined) doctorUpdateData.firstName = request.firstName;
    if (request.lastName !== undefined) doctorUpdateData.lastName = request.lastName;
    if (request.middleName !== undefined) doctorUpdateData.middleName = request.middleName;
    if (request.bio !== undefined) doctorUpdateData.bio = request.bio;
    if (request.contactNumber !== undefined) doctorUpdateData.contactNumber = request.contactNumber;
    if (request.address !== undefined) doctorUpdateData.address = request.address;
    if (request.specialization !== undefined) doctorUpdateData.specialization = request.specialization;
    if (request.qualifications !== undefined) doctorUpdateData.qualifications = request.qualifications;
    if (request.experience !== undefined) doctorUpdateData.experience = request.experience;
    if (request.gender !== undefined) doctorUpdateData.gender = request.gender;
    if (request.dateOfBirth !== undefined) doctorUpdateData.dateOfBirth = request.dateOfBirth ? new Date(request.dateOfBirth) : null;
    
    // Medical license fields
    if (request.prcId !== undefined) doctorUpdateData.prcId = request.prcId;
    if (request.ptrId !== undefined) doctorUpdateData.ptrId = request.ptrId;
    if (request.medicalLicenseLevel !== undefined) doctorUpdateData.medicalLicenseLevel = request.medicalLicenseLevel;
    if (request.philHealthAccreditation !== undefined) doctorUpdateData.philHealthAccreditation = request.philHealthAccreditation;
    if (request.licenseNumber !== undefined) doctorUpdateData.licenseNumber = request.licenseNumber;
    if (request.licenseExpiry !== undefined) doctorUpdateData.licenseExpiry = request.licenseExpiry ? new Date(request.licenseExpiry) : null;
    if (request.isLicenseActive !== undefined) doctorUpdateData.isLicenseActive = request.isLicenseActive;
    if (request.additionalCertifications !== undefined) doctorUpdateData.additionalCertifications = request.additionalCertifications;
    if (request.licenseIssuedBy !== undefined) doctorUpdateData.licenseIssuedBy = request.licenseIssuedBy;
    if (request.licenseIssuedDate !== undefined) doctorUpdateData.licenseIssuedDate = request.licenseIssuedDate ? new Date(request.licenseIssuedDate) : null;
    if (request.renewalRequired !== undefined) doctorUpdateData.renewalRequired = request.renewalRequired;
    
    // ID Document fields
    if (request.prcIdImage !== undefined) doctorUpdateData.prcIdImage = request.prcIdImage;
    if (request.ptrIdImage !== undefined) doctorUpdateData.ptrIdImage = request.ptrIdImage;
    if (request.medicalLicenseImage !== undefined) doctorUpdateData.medicalLicenseImage = request.medicalLicenseImage;
    if (request.additionalIdImages !== undefined) doctorUpdateData.additionalIdImages = request.additionalIdImages;

    // Update DoctorInfo table if there are changes
    if (Object.keys(doctorUpdateData).length > 0) {
      await prisma.doctorInfo.upsert({
        where: { userId },
        update: doctorUpdateData,
        create: {
          userId,
          ...doctorUpdateData,
          // Set required fields with defaults if not provided
          firstName: doctorUpdateData.firstName || '',
          lastName: doctorUpdateData.lastName || '',
          gender: doctorUpdateData.gender || 'OTHER',
          dateOfBirth: doctorUpdateData.dateOfBirth || new Date(),
          contactNumber: doctorUpdateData.contactNumber || '',
          address: doctorUpdateData.address || '',
          bio: doctorUpdateData.bio || '',
          specialization: doctorUpdateData.specialization || '',
          qualifications: doctorUpdateData.qualifications || '',
          experience: doctorUpdateData.experience || 0,
        },
      });
    }

    // Update PatientInfo and related EmergencyContact when patient fields are present
    const patientUpdateData: any = {};
    if (request.fullName !== undefined) patientUpdateData.fullName = request.fullName;
    if (request.gender !== undefined) patientUpdateData.gender = request.gender;
    if (request.dateOfBirth !== undefined) patientUpdateData.dateOfBirth = request.dateOfBirth ? new Date(request.dateOfBirth) : null;
    if (request.contactNumber !== undefined) patientUpdateData.contactNumber = request.contactNumber;
    if (request.address !== undefined) patientUpdateData.address = request.address;
    if (request.weight !== undefined) patientUpdateData.weight = request.weight as number;
    if (request.height !== undefined) patientUpdateData.height = request.height as number;
    if (request.bloodType !== undefined) patientUpdateData.bloodType = request.bloodType as string;
    if (request.medicalHistory !== undefined) patientUpdateData.medicalHistory = request.medicalHistory ?? null;
    if (request.allergies !== undefined) patientUpdateData.allergies = request.allergies ?? null;
    if (request.medications !== undefined) patientUpdateData.medications = request.medications ?? null;

    if (Object.keys(patientUpdateData).length > 0) {
      await prisma.patientInfo.upsert({
        where: { userId },
        update: patientUpdateData,
        create: {
          userId,
          fullName: patientUpdateData.fullName || '',
          gender: patientUpdateData.gender || 'OTHER',
          dateOfBirth: patientUpdateData.dateOfBirth || new Date(),
          contactNumber: patientUpdateData.contactNumber || '',
          address: patientUpdateData.address || '',
          weight: typeof patientUpdateData.weight === 'number' ? patientUpdateData.weight : 0,
          height: typeof patientUpdateData.height === 'number' ? patientUpdateData.height : 0,
          bloodType: patientUpdateData.bloodType || '',
          medicalHistory: patientUpdateData.medicalHistory ?? null,
          allergies: patientUpdateData.allergies ?? null,
          medications: patientUpdateData.medications ?? null,
        },
      });
    }

    // Upsert EmergencyContact if provided
    if (request.emergencyContact) {
      const { contactName, relationship, contactNumber, contactAddress } = request.emergencyContact;
      await prisma.emergencyContact.upsert({
        where: { patientId: userId },
        update: {
          contactName,
          relationship,
          contactNumber,
          contactAddress: contactAddress ?? null,
        },
        create: {
          patientId: userId,
          contactName,
          relationship,
          contactNumber,
          contactAddress: contactAddress ?? null,
        },
      });
    }

    // Return fresh profile
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorInfo: true,
        patientInfo: { include: { emergencyContact: true, insuranceInfo: true } },
        doctorCategories: true,
      },
    });

    if (!updated) throw new Error('User not found');
    return updated as unknown as IUserProfile;
  }

  static async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } });
  }

  static async getUserProfile(userId: string): Promise<IUserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        doctorInfo: true,
        patientInfo: { include: { emergencyContact: true, insuranceInfo: true } },
        doctorCategories: true,
      },
    });
    if (!user) throw new Error('User not found');
    return user as unknown as IUserProfile;
  }

  static async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { email } });
    return !!user;
  }

  static async resetPassword(_userId: string, _newPassword: string): Promise<void> {
    throw new Error('Reset password not implemented');
  }

  static async deactivateUser(_userId: string): Promise<void> {
    throw new Error('Deactivate user not implemented');
  }
}

export default AuthService;


