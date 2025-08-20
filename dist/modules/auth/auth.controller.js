"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../../shared/services/auth.service");
const error_handler_1 = require("../../shared/middleware/error-handler");
class AuthController {
}
exports.AuthController = AuthController;
_a = AuthController;
/**
 * User login
 * POST /auth/login
 */
AuthController.login = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    // Basic validation
    if (!email || !password) {
        const response = {
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
        const response = {
            success: false,
            message: 'Invalid email format',
            error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const authResponse = yield auth_service_1.AuthService.login({ email, password });
        const response = {
            success: true,
            message: 'Login successful',
            data: authResponse,
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Login failed',
            error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
    }
}));
/**
 * User registration
 * POST /auth/register
 */
AuthController.register = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const registerData = req.body;
    // Basic validation
    if (!registerData.email || !registerData.password || !registerData.role) {
        const response = {
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
        const response = {
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
        const response = {
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
        const missingFields = doctorFields.filter(field => !registerData[field]);
        if (missingFields.length > 0) {
            const response = {
                success: false,
                message: `Missing required fields for doctor: ${missingFields.join(', ')}`,
                error: 'VALIDATION_ERROR',
            };
            res.status(400).json(response);
            return;
        }
    }
    else if (registerData.role === 'PATIENT') {
        const patientFields = ['fullName', 'gender', 'dateOfBirth', 'contactNumber', 'address', 'weight', 'height', 'bloodType'];
        const missingFields = patientFields.filter(field => !registerData[field]);
        if (missingFields.length > 0) {
            const response = {
                success: false,
                message: `Missing required fields for patient: ${missingFields.join(', ')}`,
                error: 'VALIDATION_ERROR',
            };
            res.status(400).json(response);
            return;
        }
    }
    try {
        const authResponse = yield auth_service_1.AuthService.register(registerData);
        const response = {
            success: true,
            message: 'Registration successful',
            data: authResponse,
        };
        res.status(201).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Registration failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Refresh access token
 * POST /auth/refresh
 */
AuthController.refreshToken = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        const response = {
            success: false,
            message: 'Refresh token is required',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const result = yield auth_service_1.AuthService.refreshToken({ refreshToken });
        const response = {
            success: true,
            message: 'Token refreshed successfully',
            data: result,
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Token refresh failed',
            error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
    }
}));
/**
 * Change password
 * PUT /auth/change-password
 */
AuthController.changePassword = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { currentPassword, newPassword } = req.body;
    // Basic validation
    if (!currentPassword || !newPassword) {
        const response = {
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
        const response = {
            success: false,
            message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character',
            error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!userId) {
            const response = {
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        yield auth_service_1.AuthService.changePassword(userId, { currentPassword, newPassword });
        const response = {
            success: true,
            message: 'Password changed successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Password change failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Update user profile
 * PUT /auth/profile
 */
AuthController.updateProfile = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const updateData = req.body;
    try {
        const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!userId) {
            const response = {
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        const updatedProfile = yield auth_service_1.AuthService.updateProfile(userId, updateData);
        const response = {
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile,
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Profile update failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Logout user
 * POST /auth/logout
 */
AuthController.logout = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!userId) {
            const response = {
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        const { refreshToken } = req.body;
        yield auth_service_1.AuthService.logout(userId, refreshToken);
        const response = {
            success: true,
            message: 'Logout successful',
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Logout failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Get user profile
 * GET /auth/profile
 */
AuthController.getProfile = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!userId) {
            const response = {
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        const profile = yield auth_service_1.AuthService.getUserProfile(userId);
        const response = {
            success: true,
            message: 'Profile retrieved successfully',
            data: profile,
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Profile retrieval failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Check if email exists
 * GET /auth/check-email/:email
 */
AuthController.checkEmail = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.params;
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        const response = {
            success: false,
            message: 'Invalid email format',
            error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const exists = yield auth_service_1.AuthService.emailExists(email);
        const response = {
            success: true,
            message: 'Email check completed',
            data: { exists },
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Email check failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Validate password strength
 * POST /auth/validate-password
 */
AuthController.validatePassword = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { password } = req.body;
    if (!password) {
        const response = {
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
    const response = {
        success: true,
        message: 'Password validation completed',
        data: {
            isValid,
            message: isValid ? 'Password meets requirements' : 'Password does not meet requirements',
        },
    };
    res.status(200).json(response);
}));
/**
 * Reset password (admin only)
 * PUT /auth/reset-password/:userId
 */
AuthController.resetPassword = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { userId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
        const response = {
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
        const response = {
            success: false,
            message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character',
            error: 'VALIDATION_ERROR',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const adminUserId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!adminUserId) {
            const response = {
                success: false,
                message: 'Admin not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        // TODO: Check if user has admin role
        yield auth_service_1.AuthService.resetPassword(parseInt(userId), newPassword);
        const response = {
            success: true,
            message: 'Password reset successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Password reset failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
/**
 * Deactivate user account (admin only)
 * DELETE /auth/deactivate/:userId
 */
AuthController.deactivateUser = (0, error_handler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { userId } = req.params;
    try {
        const adminUserId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!adminUserId) {
            const response = {
                success: false,
                message: 'Admin not authenticated',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        // TODO: Check if user has admin role
        yield auth_service_1.AuthService.deactivateUser(parseInt(userId));
        const response = {
            success: true,
            message: 'User deactivated successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'User deactivation failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
