import { Request, Response } from 'express';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService } from '../audit/audit.service';
import { asyncHandler } from '../../shared/middleware/error-handler';
import { IApiResponse, ILoginRequest, IRegisterRequest, IChangePasswordRequest, IUpdateProfileRequest } from '../../types';
import { AuditCategory, AuditLevel, Role } from '@prisma/client';

export class AuthController {
  /**
   * User login
   * POST /auth/login
   */
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as ILoginRequest;

    // Basic validation
    if (!email || !password) {
      const response: IApiResponse = {
        success: false,
        message: 'Email and password are required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      // Log security event for invalid email format
      await AuditService.logSecurityEvent(
        'INVALID_EMAIL_FORMAT',
        AuditLevel.WARNING,
        `Invalid email format provided for login: ${email}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email,
          validationType: 'email_format',
          failureReason: 'malformed_email'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: 'Invalid email format',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const authResponse = await AuthService.login({ email, password });

      // Audit log for successful login
      await AuditService.logAuthEvent(
        'LOGIN',
        authResponse.user.id,
        email,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userRole: authResponse.user.role,
          organizationId: authResponse.user.organizationId,
          loginMethod: 'password',
          sessionId: authResponse.token ? 'generated' : null
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Login successful',
        data: authResponse,
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed login
      await AuditService.logAuthEvent(
        'LOGIN_FAILED',
        null,
        email,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          loginMethod: 'password',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      // Log security event for failed login
      await AuditService.logSecurityEvent(
        'LOGIN_FAILED',
        AuditLevel.WARNING,
        `Failed login attempt for email: ${email}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
    }
  });

  /**
   * User registration
   * POST /auth/register
   */
  static register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const registerData = req.body as IRegisterRequest;

    // Basic validation
    if (!registerData.email || !registerData.password || !registerData.role) {
      const response: IApiResponse = {
        success: false,
        message: 'Email, password, and role are required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerData.email)) {
      // Log security event for invalid email format in registration
      await AuditService.logSecurityEvent(
        'INVALID_EMAIL_FORMAT_REGISTRATION',
        AuditLevel.WARNING,
        `Invalid email format provided for registration: ${registerData.email}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email: registerData.email,
          role: registerData.role,
          validationType: 'email_format',
          failureReason: 'malformed_email'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: 'Invalid email format',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(registerData.password)) {
      // Log security event for weak password in registration
      await AuditService.logSecurityEvent(
        'WEAK_PASSWORD_REGISTRATION',
        AuditLevel.WARNING,
        `Weak password provided for registration: ${registerData.email}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email: registerData.email,
          role: registerData.role,
          validationType: 'password_strength',
          failureReason: 'insufficient_complexity'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Validate role-specific required fields
    if (registerData.role === 'DOCTOR') {
      const doctorFields = ['firstName', 'lastName', 'specialization', 'qualifications', 'experience'];
      const missingFields = doctorFields.filter(field => !registerData[field as keyof IRegisterRequest]);
      if (missingFields.length > 0) {
        const response: IApiResponse = {
          success: false,
          message: `Missing required fields for doctor: ${missingFields.join(', ')}`,
          error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
      }
    } else if (registerData.role === 'PATIENT') {
      const patientFields = ['fullName', 'gender', 'dateOfBirth', 'contactNumber', 'address', 'weight', 'height', 'bloodType'];
      const missingFields = patientFields.filter(field => !registerData[field as keyof IRegisterRequest]);
      if (missingFields.length > 0) {
        const response: IApiResponse = {
          success: false,
          message: `Missing required fields for patient: ${missingFields.join(', ')}`,
          error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
      }
    }

    try {
      const authResponse = await AuthService.register(registerData);

      // Audit log for successful registration
      await AuditService.logUserActivity(
        'USER_REGISTRATION',
        authResponse.user.id,
        `New user registered with role: ${registerData.role}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'USER',
        authResponse.user.id,
        {
          email: registerData.email,
          role: registerData.role,
          organizationId: (registerData as any).organizationId || null,
          registrationMethod: 'self_registration',
          hasRequiredFields: true
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Registration successful',
        data: authResponse,
      };

      res.status(201).json(response);
    } catch (error) {
      // Audit log for failed registration
      await AuditService.logSecurityEvent(
        'REGISTRATION_FAILED',
        AuditLevel.ERROR,
        `User registration failed for email: ${registerData.email}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email: registerData.email,
          role: registerData.role,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : null
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  static refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      const response: IApiResponse = {
        success: false,
        message: 'Refresh token is required',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const result = await AuthService.refreshToken({ refreshToken });

      // Audit log for successful token refresh
      await AuditService.logAuthEvent(
        'TOKEN_REFRESH',
        null, // User ID not available in refresh token response
        'token_refresh',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          tokenType: 'refresh_token',
          sessionRenewed: true
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed token refresh
      await AuditService.logSecurityEvent(
        'TOKEN_REFRESH_FAILED',
        AuditLevel.WARNING,
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          refreshToken: refreshToken ? 'provided' : 'missing',
          error: error instanceof Error ? error.message : 'Unknown error',
          failureReason: 'invalid_or_expired_token'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Token refresh failed',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
    }
  });

  /**
   * Change password
   * PUT /auth/change-password
   */
  static changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body as IChangePasswordRequest;

    // Basic validation
    if (!currentPassword || !newPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'Current password and new password are required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      const response: IApiResponse = {
        success: false,
        message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        const response: IApiResponse = {
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      await AuthService.changePassword(userId, { currentPassword, newPassword });

      // Audit log for successful password change
      await AuditService.logAuthEvent(
        'PASSWORD_CHANGE',
        userId,
        (req as any).user?.email || 'unknown',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userRole: (req as any).user?.role || 'unknown',
          passwordChangeMethod: 'user_initiated',
          securityLevel: 'high'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed password change
      await AuditService.logSecurityEvent(
        'PASSWORD_CHANGE_FAILED',
        AuditLevel.WARNING,
        `Password change failed for user ${(req as any).user?.id}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userId: (req as any).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          failureReason: 'invalid_current_password_or_validation_error'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Update user profile
   * PUT /auth/profile
   */
  static updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const updateData = req.body as IUpdateProfileRequest;

    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        const response: IApiResponse = {
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      const updatedProfile = await AuthService.updateProfile(userId, updateData);

      // Audit log for successful profile update
      await AuditService.logDataModification(
        'UPDATE',
        userId,
        'USER_PROFILE',
        userId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          updatedFields: Object.keys(updateData),
          userRole: (req as any).user?.role || 'unknown',
          profileUpdateMethod: 'user_initiated'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed profile update
      await AuditService.logSecurityEvent(
        'PROFILE_UPDATE_FAILED',
        AuditLevel.ERROR,
        `Profile update failed for user ${(req as any).user?.id}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userId: (req as any).user?.id,
          updateData: req.body,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : null
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Profile update failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Logout user
   * POST /auth/logout
   */
  static logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        const response: IApiResponse = {
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      const { refreshToken } = req.body;
      await AuthService.logout(userId, refreshToken);

      // Audit log for successful logout
      await AuditService.logAuthEvent(
        'LOGOUT',
        userId,
        (req as any).user?.email || 'unknown',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userRole: (req as any).user?.role || 'unknown',
          logoutMethod: 'user_initiated',
          refreshTokenProvided: !!refreshToken
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Logout successful',
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed logout
      await AuditService.logSecurityEvent(
        'LOGOUT_FAILED',
        AuditLevel.ERROR,
        `Logout failed for user ${(req as any).user?.id}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userId: (req as any).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          refreshTokenProvided: !!(req.body.refreshToken)
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Logout failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Get user profile
   * GET /auth/profile
   */
  static getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        const response: IApiResponse = {
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      const profile = await AuthService.getUserProfile(userId);

      // Audit log for profile access
      await AuditService.logDataAccess(
        'VIEW_PROFILE',
        userId,
        'USER_PROFILE',
        userId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userRole: (req as any).user?.role || 'unknown',
          profileAccessMethod: 'self_access'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: profile,
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed profile access
      await AuditService.logSecurityEvent(
        'PROFILE_ACCESS_FAILED',
        AuditLevel.ERROR,
        `Profile access failed for user ${(req as any).user?.id}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          userId: (req as any).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : null
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Profile retrieval failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Check if email exists
   * GET /auth/check-email/:email
   */
  static checkEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.params;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email format',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const exists = await AuthService.emailExists(email);

      // Audit log for email check
      await AuditService.logDataAccess(
        'CHECK_EMAIL_EXISTS',
        (req as any).user?.id || 'anonymous',
        'USER_EMAIL',
        email,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email,
          exists,
          requestedBy: (req as any).user?.id || 'anonymous',
          userRole: (req as any).user?.role || 'anonymous'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Email check completed',
        data: { exists },
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed email check
      await AuditService.logSecurityEvent(
        'EMAIL_CHECK_FAILED',
        AuditLevel.ERROR,
        `Email check failed for: ${email}`,
        (req as any).user?.id || null,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : null
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Email check failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Validate password strength
   * POST /auth/validate-password
   */
  static validatePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { password } = req.body;

    if (!password) {
      const response: IApiResponse = {
        success: false,
        message: 'Password is required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const isValid = passwordRegex.test(password);

    // Audit log for password validation
    await AuditService.logDataAccess(
      'VALIDATE_PASSWORD_STRENGTH',
      (req as any).user?.id || 'anonymous',
      'PASSWORD_VALIDATION',
      'validation_request',
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      {
        isValid,
        requestedBy: (req as any).user?.id || 'anonymous',
        userRole: (req as any).user?.role || 'anonymous',
        validationResult: isValid ? 'PASSED' : 'FAILED'
      }
    );

    const response: IApiResponse = {
      success: true,
      message: 'Password validation completed',
      data: {
        isValid,
        message: isValid ? 'Password meets requirements' : 'Password does not meet requirements',
      },
    };

    res.status(200).json(response);
  });

  /**
   * Reset password (admin only)
   * PUT /auth/reset-password/:userId
   */
  static resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'New password is required',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      const response: IApiResponse = {
        success: false,
        message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character',
        error: 'VALIDATION_ERROR',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const adminUserId = (req as any).user?.id;
      if (!adminUserId) {
        const response: IApiResponse = {
          success: false,
          message: 'Admin not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      // TODO: Check if user has admin role
      await AuthService.resetPassword(userId, newPassword);

      // Audit log for admin password reset
      await AuditService.logUserActivity(
        'PASSWORD_RESET_BY_ADMIN',
        userId,
        `Admin reset password for user ${userId}`,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'USER_ACCOUNT',
        userId,
        {
          resetBy: adminUserId,
          resetByRole: (req as any).user?.role || 'unknown',
          resetMethod: 'admin_initiated',
          securityLevel: 'critical'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'Password reset successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed admin password reset
      await AuditService.logSecurityEvent(
        'ADMIN_PASSWORD_RESET_FAILED',
        AuditLevel.CRITICAL,
        `Admin password reset failed for user ${userId}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          targetUserId: userId,
          resetBy: (req as any).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          failureReason: 'admin_action_failed'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Password reset failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });

  /**
   * Deactivate user account (admin only)
   * DELETE /auth/deactivate/:userId
   */
  static deactivateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const adminUserId = (req as any).user?.id;
      if (!adminUserId) {
        const response: IApiResponse = {
          success: false,
          message: 'Admin not authenticated',
          error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
      }

      // TODO: Check if user has admin role
      await AuthService.deactivateUser(userId);

      // Audit log for admin user deactivation
      await AuditService.logDataModification(
        'DELETE',
        adminUserId,
        'USER_ACCOUNT',
        userId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          targetUserId: userId,
          deactivatedBy: (req as any).user?.id,
          deactivatedByRole: (req as any).user?.role || 'unknown',
          actionType: 'account_deactivation',
          securityLevel: 'critical'
        }
      );

      const response: IApiResponse = {
        success: true,
        message: 'User deactivated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      // Audit log for failed admin user deactivation
      await AuditService.logSecurityEvent(
        'ADMIN_USER_DEACTIVATION_FAILED',
        AuditLevel.CRITICAL,
        `Admin user deactivation failed for user ${userId}`,
        (req as any).user?.id,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        {
          targetUserId: userId,
          deactivatedBy: (req as any).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          failureReason: 'admin_action_failed'
        }
      );

      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'User deactivation failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });
}
