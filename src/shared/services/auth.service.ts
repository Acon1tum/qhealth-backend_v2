import { PrismaClient, Role, Sex } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { securityConfig } from '../../config/security.config';
import { AppError, ErrorTypes } from '../middleware/error-handler';
import {
  IUserProfile,
  ILoginRequest,
  IRegisterRequest,
  IAuthResponse,
  IRefreshTokenRequest,
  IChangePasswordRequest,
  IUpdateProfileRequest,
  IJWTPayload,
  IRefreshTokenPayload,
  IApiResponse,
} from '../../types';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * User login with enhanced security
   */
  static async login(loginData: ILoginRequest): Promise<IAuthResponse> {
    const { email, password } = loginData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, ErrorTypes.AUTHENTICATION_ERROR);
    }

    // Verify password
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, ErrorTypes.AUTHENTICATION_ERROR);
    }

    // Check concurrent sessions
    await this.checkConcurrentSessions(user.id);

    // Generate tokens
    const token = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Create user profile
    const userProfile: IUserProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profilePicture: user.profilePicture,
      profilePictureVerified: user.profilePictureVerified,
      profilePictureVerifiedBy: user.profilePictureVerifiedBy,
      profilePictureVerifiedAt: user.profilePictureVerifiedAt,
      doctorInfo: user.doctorInfo || undefined,
      patientInfo: user.patientInfo || undefined,
    };

    // Log successful login
    await this.logUserActivity(user.id, 'LOGIN', 'SUCCESS');

    return {
      user: userProfile,
      token,
      refreshToken,
    };
  }

  /**
   * User registration with enhanced validation
   */
  static async register(registerData: IRegisterRequest): Promise<IAuthResponse> {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      specialization,
      qualifications,
      experience,
      fullName,
      gender,
      dateOfBirth,
      contactNumber,
      address,
      bio,
      weight,
      height,
      bloodType,
      medicalHistory,
      allergies,
      medications,
      // New: Emergency contact & Insurance
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactNumber,
      emergencyContactAddress,
      insuranceProviderName,
      insurancePolicyNumber,
      insuranceContact,
    } = registerData;

    // Validate password strength
    if (!this.validatePasswordStrength(password)) {
      throw new AppError('Password does not meet security requirements', 400, ErrorTypes.VALIDATION_ERROR);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409, ErrorTypes.VALIDATION_ERROR);
    }

    // Hash password with configured salt rounds
    const hashedPassword = await hash(password, securityConfig.password.saltRounds);

    // Create user with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create base user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          role,
        },
      });

      // Create role-specific information
      if (role === Role.DOCTOR) {
        if (!firstName || !lastName || !specialization || !qualifications || !experience) {
          throw new AppError('Doctor registration requires firstName, lastName, specialization, qualifications, and experience', 400, ErrorTypes.VALIDATION_ERROR);
        }

        await tx.doctorInfo.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            specialization,
            qualifications,
            experience,
            gender: gender || Sex.OTHER,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
            contactNumber: contactNumber || '',
            address: address || '',
            bio: bio || '',
          },
        });
      } else if (role === Role.PATIENT) {
        if (!fullName || !gender || !dateOfBirth || !contactNumber || !address || !weight || !height || !bloodType) {
          throw new AppError('Patient registration requires fullName, gender, dateOfBirth, contactNumber, address, weight, height, and bloodType', 400, ErrorTypes.VALIDATION_ERROR);
        }

        const createdPatient = await tx.patientInfo.create({
          data: {
            userId: user.id,
            fullName,
            gender,
            dateOfBirth: new Date(dateOfBirth),
            contactNumber,
            address,
            weight,
            height,
            bloodType,
            medicalHistory: medicalHistory || '',
            allergies: allergies || '',
            medications: medications || '',
          },
        });

        // Optional: Emergency Contact
        if (emergencyContactName && emergencyContactRelationship && emergencyContactNumber) {
          await tx.emergencyContact.create({
            data: {
              patientId: user.id,
              contactName: emergencyContactName,
              relationship: emergencyContactRelationship,
              contactNumber: emergencyContactNumber,
              contactAddress: emergencyContactAddress || null,
            },
          });
        }

        // Optional: Insurance Info
        if (insuranceProviderName && insurancePolicyNumber && insuranceContact) {
          await tx.insuranceInfo.create({
            data: {
              patientId: user.id,
              providerName: insuranceProviderName,
              policyNumber: insurancePolicyNumber,
              insuranceContact: insuranceContact,
            },
          });
        }
      }

      return user;
    });

    // Get complete user profile
    const userProfile = await prisma.user.findUnique({
      where: { id: result.id },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!userProfile) {
      throw new AppError('Failed to create user profile', 500, ErrorTypes.INTERNAL_SERVER_ERROR);
    }

    // Generate tokens
    const token = this.generateAccessToken(userProfile);
    const refreshToken = await this.generateRefreshToken(userProfile.id);

    // Log successful registration
    await this.logUserActivity(userProfile.id, 'REGISTER', 'SUCCESS');

    return {
      user: userProfile as IUserProfile,
      token,
      refreshToken,
    };
  }

  /**
   * Refresh access token with security checks
   */
  static async refreshToken(refreshData: IRefreshTokenRequest): Promise<{ token: string }> {
    const { refreshToken } = refreshData;

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, securityConfig.jwt.refreshToken.secret) as IRefreshTokenPayload;

      // Check if refresh token exists in database
      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { id: decoded.tokenId },
        include: { user: true },
      });

      if (!tokenRecord || !tokenRecord.user) {
        throw new AppError('Invalid refresh token', 401, ErrorTypes.AUTHENTICATION_ERROR);
      }

      // Check if token is expired
      if (tokenRecord.expiresAt < new Date()) {
        // Remove expired token
        await prisma.refreshToken.delete({
          where: { id: decoded.tokenId },
        });
        throw new AppError('Refresh token expired', 401, ErrorTypes.AUTHENTICATION_ERROR);
      }

      // Check if user is still active
      // if (!tokenRecord.user.isActive) {
      //   throw new AppError('User account is deactivated', 403, ErrorTypes.AUTHORIZATION_ERROR);
      // }

      // Generate new access token
      const token = this.generateAccessToken(tokenRecord.user);

      // Log token refresh
      await this.logUserActivity(tokenRecord.user.id, 'TOKEN_REFRESH', 'SUCCESS');

      return { token };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Invalid refresh token', 401, ErrorTypes.AUTHENTICATION_ERROR);
    }
  }

  /**
   * Change password with enhanced security
   */
  static async changePassword(userId: string, changeData: IChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = changeData;

    // Validate new password strength
    if (!this.validatePasswordStrength(newPassword)) {
      throw new AppError('New password does not meet security requirements', 400, ErrorTypes.VALIDATION_ERROR);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorTypes.NOT_FOUND_ERROR);
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 401, ErrorTypes.AUTHENTICATION_ERROR);
    }

    // Check if new password is same as current
    const isSamePassword = await compare(newPassword, user.password);
    if (isSamePassword) {
      throw new AppError('New password must be different from current password', 400, ErrorTypes.VALIDATION_ERROR);
    }

    // Hash new password
    const hashedNewPassword = await hash(newPassword, securityConfig.password.saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Invalidate all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Log password change
    await this.logUserActivity(userId, 'PASSWORD_CHANGE', 'SUCCESS');
  }

  /**
   * Update user profile with validation
   */
  static async updateProfile(userId: string, updateData: IUpdateProfileRequest): Promise<IUserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorTypes.NOT_FOUND_ERROR);
    }

    // Update profile picture in User table (for all users)
    if (updateData.profilePicture !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          profilePicture: updateData.profilePicture,
        },
      });
    }

    // Update role-specific information
    if (user.role === Role.DOCTOR && user.doctorInfo) {
      await prisma.doctorInfo.update({
        where: { userId },
        data: {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          middleName: updateData.middleName,
          bio: updateData.bio,
          contactNumber: updateData.contactNumber,
          address: updateData.address,
          specialization: updateData.specialization,
          qualifications: updateData.qualifications,
          experience: updateData.experience,
        },
      });
    } else if (user.role === Role.PATIENT && user.patientInfo) {
      await prisma.patientInfo.update({
        where: { userId },
        data: {
          fullName: updateData.fullName,
          gender: updateData.gender,
          dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
          contactNumber: updateData.contactNumber,
          address: updateData.address,
          weight: updateData.weight,
          height: updateData.height,
          bloodType: updateData.bloodType,
          medicalHistory: updateData.medicalHistory,
          allergies: updateData.allergies,
          medications: updateData.medications,
        },
      });
    }

    // Get updated user profile
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!updatedUser) {
      throw new AppError('Failed to update user profile', 500, ErrorTypes.INTERNAL_SERVER_ERROR);
    }

    // Log profile update
    await this.logUserActivity(userId, 'PROFILE_UPDATE', 'SUCCESS');

    return updatedUser as IUserProfile;
  }

  /**
   * Logout user with session cleanup
   */
  static async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Remove specific refresh token
      await prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // Remove all refresh tokens for user
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    // Log logout
    await this.logUserActivity(userId, 'LOGOUT', 'SUCCESS');
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string): Promise<IUserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorTypes.NOT_FOUND_ERROR);
    }

    return user as IUserProfile;
  }

  /**
   * Generate access token with security configuration
   */
  private static generateAccessToken(user: any): string {
    const payload: IJWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    const secret = securityConfig.jwt.accessToken.secret;
    if (!secret) {
      throw new AppError('JWT_SECRET environment variable is not set', 500, ErrorTypes.INTERNAL_SERVER_ERROR);
    }

    return jwt.sign(payload, secret, {
      expiresIn: securityConfig.jwt.accessToken.expiresIn,
      algorithm: securityConfig.jwt.accessToken.algorithm,
      issuer: 'qhealth-backend',
      audience: 'qhealth-users',
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token with security configuration
   */
  private static async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        expiresAt,
        token: tokenId,
      },
    });

    // Generate JWT refresh token
    const payload: IRefreshTokenPayload = {
      userId,
      tokenId,
    };

    const refreshSecret = securityConfig.jwt.refreshToken.secret;
    if (!refreshSecret) {
      throw new AppError('JWT_REFRESH_SECRET environment variable is not set', 500, ErrorTypes.INTERNAL_SERVER_ERROR);
    }

    return jwt.sign(payload, refreshSecret, {
      expiresIn: securityConfig.jwt.refreshToken.expiresIn,
      algorithm: securityConfig.jwt.refreshToken.algorithm,
      issuer: 'qhealth-backend',
      audience: 'qhealth-users',
    } as jwt.SignOptions);
  }

  /**
   * Enhanced password strength validation
   */
  static validatePasswordStrength(password: string): boolean {
    const { password: config } = securityConfig;
    
    // Basic length check
    if (password.length < config.minLength) {
      return false;
    }

    // Check for required character types
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[@$!%*?&]/.test(password);

    return hasLowercase && hasUppercase && hasNumbers && hasSpecialChars;
  }

  /**
   * Check concurrent sessions limit
   */
  private static async checkConcurrentSessions(userId: string): Promise<void> {
    const activeSessions = await prisma.refreshToken.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeSessions >= securityConfig.session.maxConcurrentSessions) {
      // Remove oldest sessions (by expiration time as fallback)
      const oldestSessions = await prisma.refreshToken.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'asc' },
        take: activeSessions - securityConfig.session.maxConcurrentSessions + 1,
      });

      await prisma.refreshToken.deleteMany({
        where: {
          id: { in: oldestSessions.map(s => s.id) },
        },
      });

      // Log session cleanup
      await this.logUserActivity(userId, 'SESSION_CLEANUP', 'INFO');
    }
  }

  /**
   * Log user activity for audit trail
   */
  private static async logUserActivity(userId: string, action: string, status: string): Promise<void> {
    try {
      // TODO: Implement audit logging to database or external service
      console.log(`📊 User Activity: User ${userId} - ${action} - ${status} - ${new Date().toISOString()}`);
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log user activity:', error);
    }
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return !!user;
  }

  /**
   * Reset password (for admin use)
   */
  static async resetPassword(userId: string, newPassword: string): Promise<void> {
    // Validate password strength
    if (!this.validatePasswordStrength(newPassword)) {
      throw new AppError('Password does not meet security requirements', 400, ErrorTypes.VALIDATION_ERROR);
    }

    const hashedPassword = await hash(newPassword, securityConfig.password.saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Log password reset
    await this.logUserActivity(userId, 'PASSWORD_RESET', 'SUCCESS');
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string): Promise<void> {
    // You can add an isActive field to your User model
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { isActive: false },
    // });

    // For now, just remove refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Log account deactivation
    await this.logUserActivity(userId, 'ACCOUNT_DEACTIVATION', 'SUCCESS');
  }

  /**
   * Clean up expired tokens (cron job)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        console.log(`🧹 Cleaned up ${result.count} expired tokens`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }
}
