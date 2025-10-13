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
const audit_service_1 = require("../audit/audit.service");
const error_handler_1 = require("../../shared/middleware/error-handler");
const client_1 = require("@prisma/client");
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
        // Log security event for invalid email format
        yield audit_service_1.AuditService.logSecurityEvent('INVALID_EMAIL_FORMAT', client_1.AuditLevel.WARNING, `Invalid email format provided for login: ${email}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email,
            validationType: 'email_format',
            failureReason: 'malformed_email'
        });
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
        // Audit log for successful login
        yield audit_service_1.AuditService.logAuthEvent('LOGIN', authResponse.user.id, email, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userRole: authResponse.user.role,
            organizationId: authResponse.user.organizationId,
            loginMethod: 'password',
            sessionId: authResponse.token ? 'generated' : null
        });
        const response = {
            success: true,
            message: 'Login successful',
            data: authResponse,
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed login
        yield audit_service_1.AuditService.logAuthEvent('LOGIN_FAILED', null, email, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            error: error instanceof Error ? error.message : 'Unknown error',
            loginMethod: 'password',
            failureReason: error instanceof Error ? error.message : 'Unknown error'
        });
        // Log security event for failed login
        yield audit_service_1.AuditService.logSecurityEvent('LOGIN_FAILED', client_1.AuditLevel.WARNING, `Failed login attempt for email: ${email}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown'
        });
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
        // Log security event for invalid email format in registration
        yield audit_service_1.AuditService.logSecurityEvent('INVALID_EMAIL_FORMAT_REGISTRATION', client_1.AuditLevel.WARNING, `Invalid email format provided for registration: ${registerData.email}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email: registerData.email,
            role: registerData.role,
            validationType: 'email_format',
            failureReason: 'malformed_email'
        });
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
        // Log security event for weak password in registration
        yield audit_service_1.AuditService.logSecurityEvent('WEAK_PASSWORD_REGISTRATION', client_1.AuditLevel.WARNING, `Weak password provided for registration: ${registerData.email}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email: registerData.email,
            role: registerData.role,
            validationType: 'password_strength',
            failureReason: 'insufficient_complexity'
        });
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
        // Audit log for successful registration
        yield audit_service_1.AuditService.logUserActivity('USER_REGISTRATION', authResponse.user.id, `New user registered with role: ${registerData.role}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'USER', authResponse.user.id, {
            email: registerData.email,
            role: registerData.role,
            organizationId: registerData.organizationId || null,
            registrationMethod: 'self_registration',
            hasRequiredFields: true
        });
        const response = {
            success: true,
            message: 'Registration successful',
            data: authResponse,
        };
        res.status(201).json(response);
    }
    catch (error) {
        // Audit log for failed registration
        yield audit_service_1.AuditService.logSecurityEvent('REGISTRATION_FAILED', client_1.AuditLevel.ERROR, `User registration failed for email: ${registerData.email}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email: registerData.email,
            role: registerData.role,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
        });
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
        // Audit log for successful token refresh
        yield audit_service_1.AuditService.logAuthEvent('TOKEN_REFRESH', null, // User ID not available in refresh token response
        'token_refresh', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            tokenType: 'refresh_token',
            sessionRenewed: true
        });
        const response = {
            success: true,
            message: 'Token refreshed successfully',
            data: result,
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed token refresh
        yield audit_service_1.AuditService.logSecurityEvent('TOKEN_REFRESH_FAILED', client_1.AuditLevel.WARNING, `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`, null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            refreshToken: refreshToken ? 'provided' : 'missing',
            error: error instanceof Error ? error.message : 'Unknown error',
            failureReason: 'invalid_or_expired_token'
        });
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
    var _b, _c, _d, _e, _f, _g;
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
        // Audit log for successful password change
        yield audit_service_1.AuditService.logAuthEvent('PASSWORD_CHANGE', userId, ((_c = req.user) === null || _c === void 0 ? void 0 : _c.email) || 'unknown', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userRole: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role) || 'unknown',
            passwordChangeMethod: 'user_initiated',
            securityLevel: 'high'
        });
        const response = {
            success: true,
            message: 'Password changed successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed password change
        yield audit_service_1.AuditService.logSecurityEvent('PASSWORD_CHANGE_FAILED', client_1.AuditLevel.WARNING, `Password change failed for user ${(_e = req.user) === null || _e === void 0 ? void 0 : _e.id}`, (_f = req.user) === null || _f === void 0 ? void 0 : _f.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userId: (_g = req.user) === null || _g === void 0 ? void 0 : _g.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            failureReason: 'invalid_current_password_or_validation_error'
        });
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
    var _b, _c, _d, _e, _f;
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
        // Audit log for successful profile update
        yield audit_service_1.AuditService.logDataModification('UPDATE', userId, 'USER_PROFILE', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            updatedFields: Object.keys(updateData),
            userRole: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) || 'unknown',
            profileUpdateMethod: 'user_initiated'
        });
        const response = {
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile,
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed profile update
        yield audit_service_1.AuditService.logSecurityEvent('PROFILE_UPDATE_FAILED', client_1.AuditLevel.ERROR, `Profile update failed for user ${(_d = req.user) === null || _d === void 0 ? void 0 : _d.id}`, (_e = req.user) === null || _e === void 0 ? void 0 : _e.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userId: (_f = req.user) === null || _f === void 0 ? void 0 : _f.id,
            updateData: req.body,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
        });
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
    var _b, _c, _d, _e, _f, _g;
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
        // Audit log for successful logout
        yield audit_service_1.AuditService.logAuthEvent('LOGOUT', userId, ((_c = req.user) === null || _c === void 0 ? void 0 : _c.email) || 'unknown', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userRole: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role) || 'unknown',
            logoutMethod: 'user_initiated',
            refreshTokenProvided: !!refreshToken
        });
        const response = {
            success: true,
            message: 'Logout successful',
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed logout
        yield audit_service_1.AuditService.logSecurityEvent('LOGOUT_FAILED', client_1.AuditLevel.ERROR, `Logout failed for user ${(_e = req.user) === null || _e === void 0 ? void 0 : _e.id}`, (_f = req.user) === null || _f === void 0 ? void 0 : _f.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userId: (_g = req.user) === null || _g === void 0 ? void 0 : _g.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            refreshTokenProvided: !!(req.body.refreshToken)
        });
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
    var _b, _c, _d, _e, _f;
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
        // Audit log for profile access
        yield audit_service_1.AuditService.logDataAccess('VIEW_PROFILE', userId, 'USER_PROFILE', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userRole: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) || 'unknown',
            profileAccessMethod: 'self_access'
        });
        const response = {
            success: true,
            message: 'Profile retrieved successfully',
            data: profile,
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed profile access
        yield audit_service_1.AuditService.logSecurityEvent('PROFILE_ACCESS_FAILED', client_1.AuditLevel.ERROR, `Profile access failed for user ${(_d = req.user) === null || _d === void 0 ? void 0 : _d.id}`, (_e = req.user) === null || _e === void 0 ? void 0 : _e.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            userId: (_f = req.user) === null || _f === void 0 ? void 0 : _f.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
        });
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
    var _b, _c, _d, _e;
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
        // Audit log for email check
        yield audit_service_1.AuditService.logDataAccess('CHECK_EMAIL_EXISTS', ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'anonymous', 'USER_EMAIL', email, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email,
            exists,
            requestedBy: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous',
            userRole: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role) || 'anonymous'
        });
        const response = {
            success: true,
            message: 'Email check completed',
            data: { exists },
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed email check
        yield audit_service_1.AuditService.logSecurityEvent('EMAIL_CHECK_FAILED', client_1.AuditLevel.ERROR, `Email check failed for: ${email}`, ((_e = req.user) === null || _e === void 0 ? void 0 : _e.id) || null, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
        });
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
    var _b, _c, _d;
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
    // Audit log for password validation
    yield audit_service_1.AuditService.logDataAccess('VALIDATE_PASSWORD_STRENGTH', ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'anonymous', 'PASSWORD_VALIDATION', 'validation_request', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
        isValid,
        requestedBy: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous',
        userRole: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role) || 'anonymous',
        validationResult: isValid ? 'PASSED' : 'FAILED'
    });
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
    var _b, _c, _d, _e;
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
        yield auth_service_1.AuthService.resetPassword(userId, newPassword);
        // Audit log for admin password reset
        yield audit_service_1.AuditService.logUserActivity('PASSWORD_RESET_BY_ADMIN', userId, `Admin reset password for user ${userId}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', 'USER_ACCOUNT', userId, {
            resetBy: adminUserId,
            resetByRole: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) || 'unknown',
            resetMethod: 'admin_initiated',
            securityLevel: 'critical'
        });
        const response = {
            success: true,
            message: 'Password reset successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed admin password reset
        yield audit_service_1.AuditService.logSecurityEvent('ADMIN_PASSWORD_RESET_FAILED', client_1.AuditLevel.CRITICAL, `Admin password reset failed for user ${userId}`, (_d = req.user) === null || _d === void 0 ? void 0 : _d.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            targetUserId: userId,
            resetBy: (_e = req.user) === null || _e === void 0 ? void 0 : _e.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            failureReason: 'admin_action_failed'
        });
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
    var _b, _c, _d, _e, _f;
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
        yield auth_service_1.AuthService.deactivateUser(userId);
        // Audit log for admin user deactivation
        yield audit_service_1.AuditService.logDataModification('DELETE', adminUserId, 'USER_ACCOUNT', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            targetUserId: userId,
            deactivatedBy: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
            deactivatedByRole: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role) || 'unknown',
            actionType: 'account_deactivation',
            securityLevel: 'critical'
        });
        const response = {
            success: true,
            message: 'User deactivated successfully',
        };
        res.status(200).json(response);
    }
    catch (error) {
        // Audit log for failed admin user deactivation
        yield audit_service_1.AuditService.logSecurityEvent('ADMIN_USER_DEACTIVATION_FAILED', client_1.AuditLevel.CRITICAL, `Admin user deactivation failed for user ${userId}`, (_e = req.user) === null || _e === void 0 ? void 0 : _e.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
            targetUserId: userId,
            deactivatedBy: (_f = req.user) === null || _f === void 0 ? void 0 : _f.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            failureReason: 'admin_action_failed'
        });
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'User deactivation failed',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
    }
}));
