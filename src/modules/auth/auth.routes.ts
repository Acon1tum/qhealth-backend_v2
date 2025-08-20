import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  authenticateToken,
  requireAuth,
  rateLimit,
  logAuthAttempt,
} from '../../shared/middleware/auth-middleware';

const router = Router();

/**
 * @route   POST /auth/login
 * @desc    User login
 * @access  Public
 * @body    { email: string, password: string }
 */
router.post(
  '/login',
  logAuthAttempt,
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  AuthController.login
);

/**
 * @route   POST /auth/register
 * @desc    User registration
 * @access  Public
 * @body    { email: string, password: string, role: Role, ... }
 */
router.post(
  '/register',
  logAuthAttempt,
  rateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  AuthController.register
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken: string }
 */
router.post(
  '/refresh',
  rateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  AuthController.refreshToken
);

/**
 * @route   GET /auth/check-email/:email
 * @desc    Check if email exists
 * @access  Public
 * @params  { email: string }
 */
router.get(
  '/check-email/:email',
  rateLimit(20, 15 * 60 * 1000), // 20 checks per 15 minutes
  AuthController.checkEmail
);

/**
 * @route   POST /auth/validate-password
 * @desc    Validate password strength
 * @access  Public
 * @body    { password: string }
 */
router.post(
  '/validate-password',
  rateLimit(20, 15 * 60 * 1000), // 20 validations per 15 minutes
  AuthController.validatePassword
);



// Protected routes - require authentication
router.use(authenticateToken);

/**
 * @route   GET /auth/profile
 * @desc    Get user profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.get('/profile', requireAuth, AuthController.getProfile);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { firstName?: string, lastName?: string, ... }
 */
router.put('/profile', requireAuth, AuthController.updateProfile);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { currentPassword: string, newPassword: string }
 */
router.post('/change-password', requireAuth, AuthController.changePassword);

/**
 * @route   POST /auth/logout
 * @desc    User logout
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { refreshToken?: string }
 */
router.post('/logout', requireAuth, AuthController.logout);

export default router;
