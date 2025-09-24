"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const router = (0, express_1.Router)();
/**
 * @route   POST /auth/login
 * @desc    User login
 * @access  Public
 * @body    { email: string, password: string }
 */
router.post('/login', auth_middleware_1.logAuthAttempt, (0, auth_middleware_1.rateLimit)(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
auth_controller_1.AuthController.login);
/**
 * @route   POST /auth/register
 * @desc    User registration
 * @access  Public
 * @body    { email: string, password: string, role: Role, ... }
 */
router.post('/register', auth_middleware_1.logAuthAttempt, (0, auth_middleware_1.rateLimit)(3, 60 * 60 * 1000), // 3 attempts per hour
auth_controller_1.AuthController.register);
/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken: string }
 */
router.post('/refresh', (0, auth_middleware_1.rateLimit)(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
auth_controller_1.AuthController.refreshToken);
/**
 * @route   GET /auth/check-email/:email
 * @desc    Check if email exists
 * @access  Public
 * @params  { email: string }
 */
router.get('/check-email/:email', (0, auth_middleware_1.rateLimit)(20, 15 * 60 * 1000), // 20 checks per 15 minutes
auth_controller_1.AuthController.checkEmail);
/**
 * @route   POST /auth/validate-password
 * @desc    Validate password strength
 * @access  Public
 * @body    { password: string }
 */
router.post('/validate-password', (0, auth_middleware_1.rateLimit)(20, 15 * 60 * 1000), // 20 validations per 15 minutes
auth_controller_1.AuthController.validatePassword);
// Protected routes - require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   GET /auth/profile
 * @desc    Get user profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.get('/profile', auth_middleware_1.requireAuth, auth_controller_1.AuthController.getProfile);
/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { firstName?: string, lastName?: string, ... }
 */
router.put('/profile', auth_middleware_1.requireAuth, auth_controller_1.AuthController.updateProfile);
/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { currentPassword: string, newPassword: string }
 */
router.post('/change-password', auth_middleware_1.requireAuth, auth_controller_1.AuthController.changePassword);
/**
 * @route   POST /auth/logout
 * @desc    User logout
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { refreshToken?: string }
 */
router.post('/logout', auth_middleware_1.requireAuth, auth_controller_1.AuthController.logout);
exports.default = router;
