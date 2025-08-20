import { Request, Response } from 'express';
import { AuthService } from '../../shared/services/auth.service';
import { asyncHandler } from '../../shared/middleware/error-handler';
import { IApiResponse, ILoginRequest, IRegisterRequest, IChangePasswordRequest, IUpdateProfileRequest } from '../../types';

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

      const response: IApiResponse = {
        success: true,
        message: 'Login successful',
        data: authResponse,
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Registration successful',
        data: authResponse,
      };

      res.status(201).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Logout successful',
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: profile,
      };

      res.status(200).json(response);
    } catch (error) {
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

      const response: IApiResponse = {
        success: true,
        message: 'Email check completed',
        data: { exists },
      };

      res.status(200).json(response);
    } catch (error) {
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
      await AuthService.resetPassword(parseInt(userId), newPassword);

      const response: IApiResponse = {
        success: true,
        message: 'Password reset successfully',
      };

      res.status(200).json(response);
    } catch (error) {
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
      await AuthService.deactivateUser(parseInt(userId));

      const response: IApiResponse = {
        success: true,
        message: 'User deactivated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'User deactivation failed',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
    }
  });
}
