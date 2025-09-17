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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const security_config_1 = require("../../config/security.config");
const error_handler_1 = require("../middleware/error-handler");
const prisma = new client_1.PrismaClient();
class AuthService {
    /**
     * User login with enhanced security
     */
    static login(loginData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password } = loginData;
            // Find user by email
            const user = yield prisma.user.findUnique({
                where: { email: email.toLowerCase() },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (!user) {
                throw new error_handler_1.AppError('Invalid email or password', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
            }
            // Verify password
            const isPasswordValid = yield (0, bcryptjs_1.compare)(password, user.password);
            if (!isPasswordValid) {
                throw new error_handler_1.AppError('Invalid email or password', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
            }
            // Check concurrent sessions
            yield this.checkConcurrentSessions(user.id);
            // Generate tokens
            const token = this.generateAccessToken(user);
            const refreshToken = yield this.generateRefreshToken(user.id);
            // Create user profile
            const userProfile = {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                doctorInfo: user.doctorInfo || undefined,
                patientInfo: user.patientInfo || undefined,
            };
            // Log successful login
            yield this.logUserActivity(user.id, 'LOGIN', 'SUCCESS');
            return {
                user: userProfile,
                token,
                refreshToken,
            };
        });
    }
    /**
     * User registration with enhanced validation
     */
    static register(registerData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password, role, firstName, lastName, specialization, qualifications, experience, fullName, gender, dateOfBirth, contactNumber, address, bio, weight, height, bloodType, medicalHistory, allergies, medications, 
            // New: Emergency contact & Insurance
            emergencyContactName, emergencyContactRelationship, emergencyContactNumber, emergencyContactAddress, insuranceProviderName, insurancePolicyNumber, insuranceContact, } = registerData;
            // Validate password strength
            if (!this.validatePasswordStrength(password)) {
                throw new error_handler_1.AppError('Password does not meet security requirements', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
            }
            // Check if user already exists
            const existingUser = yield prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (existingUser) {
                throw new error_handler_1.AppError('User with this email already exists', 409, error_handler_1.ErrorTypes.VALIDATION_ERROR);
            }
            // Hash password with configured salt rounds
            const hashedPassword = yield (0, bcryptjs_1.hash)(password, security_config_1.securityConfig.password.saltRounds);
            // Create user with transaction
            const result = yield prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Create base user
                const user = yield tx.user.create({
                    data: {
                        email: email.toLowerCase(),
                        password: hashedPassword,
                        role,
                    },
                });
                // Create role-specific information
                if (role === client_1.Role.DOCTOR) {
                    if (!firstName || !lastName || !specialization || !qualifications || !experience) {
                        throw new error_handler_1.AppError('Doctor registration requires firstName, lastName, specialization, qualifications, and experience', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
                    }
                    yield tx.doctorInfo.create({
                        data: {
                            userId: user.id,
                            firstName,
                            lastName,
                            specialization,
                            qualifications,
                            experience,
                            gender: gender || client_1.Sex.OTHER,
                            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
                            contactNumber: contactNumber || '',
                            address: address || '',
                            bio: bio || '',
                        },
                    });
                }
                else if (role === client_1.Role.PATIENT) {
                    if (!fullName || !gender || !dateOfBirth || !contactNumber || !address || !weight || !height || !bloodType) {
                        throw new error_handler_1.AppError('Patient registration requires fullName, gender, dateOfBirth, contactNumber, address, weight, height, and bloodType', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
                    }
                    const createdPatient = yield tx.patientInfo.create({
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
                        yield tx.emergencyContact.create({
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
                        yield tx.insuranceInfo.create({
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
            }));
            // Get complete user profile
            const userProfile = yield prisma.user.findUnique({
                where: { id: result.id },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (!userProfile) {
                throw new error_handler_1.AppError('Failed to create user profile', 500, error_handler_1.ErrorTypes.INTERNAL_SERVER_ERROR);
            }
            // Generate tokens
            const token = this.generateAccessToken(userProfile);
            const refreshToken = yield this.generateRefreshToken(userProfile.id);
            // Log successful registration
            yield this.logUserActivity(userProfile.id, 'REGISTER', 'SUCCESS');
            return {
                user: userProfile,
                token,
                refreshToken,
            };
        });
    }
    /**
     * Refresh access token with security checks
     */
    static refreshToken(refreshData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { refreshToken } = refreshData;
            try {
                // Verify refresh token
                const decoded = jsonwebtoken_1.default.verify(refreshToken, security_config_1.securityConfig.jwt.refreshToken.secret);
                // Check if refresh token exists in database
                const tokenRecord = yield prisma.refreshToken.findUnique({
                    where: { id: decoded.tokenId },
                    include: { user: true },
                });
                if (!tokenRecord || !tokenRecord.user) {
                    throw new error_handler_1.AppError('Invalid refresh token', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
                }
                // Check if token is expired
                if (tokenRecord.expiresAt < new Date()) {
                    // Remove expired token
                    yield prisma.refreshToken.delete({
                        where: { id: decoded.tokenId },
                    });
                    throw new error_handler_1.AppError('Refresh token expired', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
                }
                // Check if user is still active
                // if (!tokenRecord.user.isActive) {
                //   throw new AppError('User account is deactivated', 403, ErrorTypes.AUTHORIZATION_ERROR);
                // }
                // Generate new access token
                const token = this.generateAccessToken(tokenRecord.user);
                // Log token refresh
                yield this.logUserActivity(tokenRecord.user.id, 'TOKEN_REFRESH', 'SUCCESS');
                return { token };
            }
            catch (error) {
                if (error instanceof error_handler_1.AppError) {
                    throw error;
                }
                throw new error_handler_1.AppError('Invalid refresh token', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
            }
        });
    }
    /**
     * Change password with enhanced security
     */
    static changePassword(userId, changeData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { currentPassword, newPassword } = changeData;
            // Validate new password strength
            if (!this.validatePasswordStrength(newPassword)) {
                throw new error_handler_1.AppError('New password does not meet security requirements', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
            }
            // Get user with password
            const user = yield prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                throw new error_handler_1.AppError('User not found', 404, error_handler_1.ErrorTypes.NOT_FOUND_ERROR);
            }
            // Verify current password
            const isCurrentPasswordValid = yield (0, bcryptjs_1.compare)(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                throw new error_handler_1.AppError('Current password is incorrect', 401, error_handler_1.ErrorTypes.AUTHENTICATION_ERROR);
            }
            // Check if new password is same as current
            const isSamePassword = yield (0, bcryptjs_1.compare)(newPassword, user.password);
            if (isSamePassword) {
                throw new error_handler_1.AppError('New password must be different from current password', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
            }
            // Hash new password
            const hashedNewPassword = yield (0, bcryptjs_1.hash)(newPassword, security_config_1.securityConfig.password.saltRounds);
            // Update password
            yield prisma.user.update({
                where: { id: userId },
                data: { password: hashedNewPassword },
            });
            // Invalidate all refresh tokens for this user
            yield prisma.refreshToken.deleteMany({
                where: { userId },
            });
            // Log password change
            yield this.logUserActivity(userId, 'PASSWORD_CHANGE', 'SUCCESS');
        });
    }
    /**
     * Update user profile with validation
     */
    static updateProfile(userId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({
                where: { id: userId },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (!user) {
                throw new error_handler_1.AppError('User not found', 404, error_handler_1.ErrorTypes.NOT_FOUND_ERROR);
            }
            // Update profile picture in User table (for all users)
            if (updateData.profilePicture !== undefined) {
                yield prisma.user.update({
                    where: { id: userId },
                    data: {
                        profilePicture: updateData.profilePicture,
                    },
                });
            }
            // Update role-specific information
            if (user.role === client_1.Role.DOCTOR && user.doctorInfo) {
                yield prisma.doctorInfo.update({
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
            }
            else if (user.role === client_1.Role.PATIENT && user.patientInfo) {
                yield prisma.patientInfo.update({
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
            const updatedUser = yield prisma.user.findUnique({
                where: { id: userId },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (!updatedUser) {
                throw new error_handler_1.AppError('Failed to update user profile', 500, error_handler_1.ErrorTypes.INTERNAL_SERVER_ERROR);
            }
            // Log profile update
            yield this.logUserActivity(userId, 'PROFILE_UPDATE', 'SUCCESS');
            return updatedUser;
        });
    }
    /**
     * Logout user with session cleanup
     */
    static logout(userId, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (refreshToken) {
                // Remove specific refresh token
                yield prisma.refreshToken.deleteMany({
                    where: {
                        userId,
                        token: refreshToken,
                    },
                });
            }
            else {
                // Remove all refresh tokens for user
                yield prisma.refreshToken.deleteMany({
                    where: { userId },
                });
            }
            // Log logout
            yield this.logUserActivity(userId, 'LOGOUT', 'SUCCESS');
        });
    }
    /**
     * Get user profile
     */
    static getUserProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({
                where: { id: userId },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (!user) {
                throw new error_handler_1.AppError('User not found', 404, error_handler_1.ErrorTypes.NOT_FOUND_ERROR);
            }
            return user;
        });
    }
    /**
     * Generate access token with security configuration
     */
    static generateAccessToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            iat: Math.floor(Date.now() / 1000),
        };
        const secret = security_config_1.securityConfig.jwt.accessToken.secret;
        if (!secret) {
            throw new error_handler_1.AppError('JWT_SECRET environment variable is not set', 500, error_handler_1.ErrorTypes.INTERNAL_SERVER_ERROR);
        }
        return jsonwebtoken_1.default.sign(payload, secret, {
            expiresIn: security_config_1.securityConfig.jwt.accessToken.expiresIn,
            algorithm: security_config_1.securityConfig.jwt.accessToken.algorithm,
            issuer: 'qhealth-backend',
            audience: 'qhealth-users',
        });
    }
    /**
     * Generate refresh token with security configuration
     */
    static generateRefreshToken(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = (0, uuid_1.v4)();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            // Store refresh token in database
            yield prisma.refreshToken.create({
                data: {
                    id: tokenId,
                    userId,
                    expiresAt,
                    token: tokenId,
                },
            });
            // Generate JWT refresh token
            const payload = {
                userId,
                tokenId,
            };
            const refreshSecret = security_config_1.securityConfig.jwt.refreshToken.secret;
            if (!refreshSecret) {
                throw new error_handler_1.AppError('JWT_REFRESH_SECRET environment variable is not set', 500, error_handler_1.ErrorTypes.INTERNAL_SERVER_ERROR);
            }
            return jsonwebtoken_1.default.sign(payload, refreshSecret, {
                expiresIn: security_config_1.securityConfig.jwt.refreshToken.expiresIn,
                algorithm: security_config_1.securityConfig.jwt.refreshToken.algorithm,
                issuer: 'qhealth-backend',
                audience: 'qhealth-users',
            });
        });
    }
    /**
     * Enhanced password strength validation
     */
    static validatePasswordStrength(password) {
        const { password: config } = security_config_1.securityConfig;
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
    static checkConcurrentSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeSessions = yield prisma.refreshToken.count({
                where: {
                    userId,
                    expiresAt: { gt: new Date() },
                },
            });
            if (activeSessions >= security_config_1.securityConfig.session.maxConcurrentSessions) {
                // Remove oldest sessions (by expiration time as fallback)
                const oldestSessions = yield prisma.refreshToken.findMany({
                    where: {
                        userId,
                        expiresAt: { gt: new Date() },
                    },
                    orderBy: { expiresAt: 'asc' },
                    take: activeSessions - security_config_1.securityConfig.session.maxConcurrentSessions + 1,
                });
                yield prisma.refreshToken.deleteMany({
                    where: {
                        id: { in: oldestSessions.map(s => s.id) },
                    },
                });
                // Log session cleanup
                yield this.logUserActivity(userId, 'SESSION_CLEANUP', 'INFO');
            }
        });
    }
    /**
     * Log user activity for audit trail
     */
    static logUserActivity(userId, action, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implement audit logging to database or external service
                console.log(`📊 User Activity: User ${userId} - ${action} - ${status} - ${new Date().toISOString()}`);
            }
            catch (error) {
                // Don't fail the main operation if logging fails
                console.error('Failed to log user activity:', error);
            }
        });
    }
    /**
     * Check if email exists
     */
    static emailExists(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            return !!user;
        });
    }
    /**
     * Reset password (for admin use)
     */
    static resetPassword(userId, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate password strength
            if (!this.validatePasswordStrength(newPassword)) {
                throw new error_handler_1.AppError('Password does not meet security requirements', 400, error_handler_1.ErrorTypes.VALIDATION_ERROR);
            }
            const hashedPassword = yield (0, bcryptjs_1.hash)(newPassword, security_config_1.securityConfig.password.saltRounds);
            yield prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            // Invalidate all refresh tokens
            yield prisma.refreshToken.deleteMany({
                where: { userId },
            });
            // Log password reset
            yield this.logUserActivity(userId, 'PASSWORD_RESET', 'SUCCESS');
        });
    }
    /**
     * Deactivate user account
     */
    static deactivateUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // You can add an isActive field to your User model
            // await prisma.user.update({
            //   where: { id: userId },
            //   data: { isActive: false },
            // });
            // For now, just remove refresh tokens
            yield prisma.refreshToken.deleteMany({
                where: { userId },
            });
            // Log account deactivation
            yield this.logUserActivity(userId, 'ACCOUNT_DEACTIVATION', 'SUCCESS');
        });
    }
    /**
     * Clean up expired tokens (cron job)
     */
    static cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield prisma.refreshToken.deleteMany({
                    where: {
                        expiresAt: { lt: new Date() },
                    },
                });
                if (result.count > 0) {
                    console.log(`🧹 Cleaned up ${result.count} expired tokens`);
                }
            }
            catch (error) {
                console.error('Failed to cleanup expired tokens:', error);
            }
        });
    }
}
exports.AuthService = AuthService;
