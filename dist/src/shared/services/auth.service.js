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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const security_config_1 = __importDefault(require("../../config/security.config"));
const prisma = new client_1.PrismaClient();
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, security_config_1.default.jwt.accessToken.secret, {
        algorithm: security_config_1.default.jwt.accessToken.algorithm,
        expiresIn: security_config_1.default.jwt.accessToken.expiresIn,
    });
}
function calculateExpiryDate(days) {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now;
}
class AuthService {
    static validatePasswordStrength(password) {
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
    static login(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password } = request;
            const user = yield prisma.user.findUnique({
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
            const isMatch = yield bcryptjs_1.default.compare(password, user.password);
            if (!isMatch) {
                throw new Error('Invalid email or password');
            }
            const payload = {
                userId: user.id,
                email: user.email,
                role: user.role,
            };
            const token = signAccessToken(payload);
            // Create refresh token (random UUID stored in DB)
            const refreshTokenValue = (0, uuid_1.v4)();
            const refreshToken = yield prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: refreshTokenValue,
                    expiresAt: calculateExpiryDate(7),
                },
            });
            const userProfile = user;
            return {
                user: userProfile,
                token,
                refreshToken: refreshToken.token,
            };
        });
    }
    static register(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password, role } = request;
            // Check if user already exists
            const existingUser = yield prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                throw new Error('User with this email already exists');
            }
            // Hash password
            const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
            // Create user based on role
            if (role === 'PATIENT') {
                const { fullName, gender, dateOfBirth, contactNumber, address, weight, height, bloodType, medicalHistory, allergies, medications, emergencyContactName, emergencyContactRelationship, emergencyContactNumber, emergencyContactAddress, insuranceProviderName, insurancePolicyNumber, insuranceContact } = request;
                const user = yield prisma.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        role: role,
                        patientInfo: {
                            create: {
                                fullName: fullName,
                                gender: gender,
                                dateOfBirth: new Date(dateOfBirth),
                                contactNumber: contactNumber,
                                address: address,
                                weight: weight,
                                height: height,
                                bloodType: bloodType,
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
                    yield prisma.emergencyContact.create({
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
                    yield prisma.insuranceInfo.create({
                        data: {
                            patientId: user.id,
                            providerName: insuranceProviderName,
                            policyNumber: insurancePolicyNumber || '',
                            insuranceContact: insuranceContact || '',
                        },
                    });
                }
                const payload = {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                };
                const token = signAccessToken(payload);
                // Create refresh token
                const refreshTokenValue = (0, uuid_1.v4)();
                const refreshToken = yield prisma.refreshToken.create({
                    data: {
                        userId: user.id,
                        token: refreshTokenValue,
                        expiresAt: calculateExpiryDate(7),
                    },
                });
                const userProfile = user;
                return {
                    user: userProfile,
                    token,
                    refreshToken: refreshToken.token,
                };
            }
            else if (role === 'DOCTOR') {
                const { firstName, lastName, specialization, qualifications, experience, gender, dateOfBirth, contactNumber, address, bio } = request;
                const user = yield prisma.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        role: role,
                        doctorInfo: {
                            create: {
                                firstName: firstName,
                                lastName: lastName,
                                gender: gender,
                                dateOfBirth: new Date(dateOfBirth),
                                contactNumber: contactNumber,
                                address: address,
                                bio: bio || '',
                                specialization: specialization,
                                qualifications: qualifications,
                                experience: experience,
                            },
                        },
                    },
                    include: {
                        doctorInfo: true,
                    },
                });
                const payload = {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                };
                const token = signAccessToken(payload);
                // Create refresh token
                const refreshTokenValue = (0, uuid_1.v4)();
                const refreshToken = yield prisma.refreshToken.create({
                    data: {
                        userId: user.id,
                        token: refreshTokenValue,
                        expiresAt: calculateExpiryDate(7),
                    },
                });
                const userProfile = user;
                return {
                    user: userProfile,
                    token,
                    refreshToken: refreshToken.token,
                };
            }
            else {
                throw new Error('Invalid role specified');
            }
        });
    }
    static refreshToken(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const { refreshToken } = request;
            const existing = yield prisma.refreshToken.findUnique({ where: { token: refreshToken } });
            if (!existing || existing.expiresAt < new Date()) {
                throw new Error('Invalid or expired refresh token');
            }
            const user = yield prisma.user.findUnique({ where: { id: existing.userId } });
            if (!user) {
                throw new Error('User not found');
            }
            const newAccessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
            // Rotate refresh token
            const newRefreshTokenValue = (0, uuid_1.v4)();
            const updated = yield prisma.refreshToken.update({
                where: { token: refreshToken },
                data: { token: newRefreshTokenValue, expiresAt: calculateExpiryDate(7) },
            });
            return { token: newAccessToken, refreshToken: updated.token };
        });
    }
    static changePassword(_userId, _request) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Change password not implemented');
        });
    }
    static updateProfile(userId, request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            // Update User table fields
            const userUpdateData = {};
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
                yield prisma.user.update({
                    where: { id: userId },
                    data: userUpdateData,
                });
            }
            // Update DoctorInfo table fields
            const doctorUpdateData = {};
            if (request.firstName !== undefined)
                doctorUpdateData.firstName = request.firstName;
            if (request.lastName !== undefined)
                doctorUpdateData.lastName = request.lastName;
            if (request.middleName !== undefined)
                doctorUpdateData.middleName = request.middleName;
            if (request.bio !== undefined)
                doctorUpdateData.bio = request.bio;
            if (request.contactNumber !== undefined)
                doctorUpdateData.contactNumber = request.contactNumber;
            if (request.address !== undefined)
                doctorUpdateData.address = request.address;
            if (request.specialization !== undefined)
                doctorUpdateData.specialization = request.specialization;
            if (request.qualifications !== undefined)
                doctorUpdateData.qualifications = request.qualifications;
            if (request.experience !== undefined)
                doctorUpdateData.experience = request.experience;
            if (request.gender !== undefined)
                doctorUpdateData.gender = request.gender;
            if (request.dateOfBirth !== undefined)
                doctorUpdateData.dateOfBirth = request.dateOfBirth ? new Date(request.dateOfBirth) : null;
            // Medical license fields
            if (request.prcId !== undefined)
                doctorUpdateData.prcId = request.prcId;
            if (request.ptrId !== undefined)
                doctorUpdateData.ptrId = request.ptrId;
            if (request.medicalLicenseLevel !== undefined)
                doctorUpdateData.medicalLicenseLevel = request.medicalLicenseLevel;
            if (request.philHealthAccreditation !== undefined)
                doctorUpdateData.philHealthAccreditation = request.philHealthAccreditation;
            if (request.licenseNumber !== undefined)
                doctorUpdateData.licenseNumber = request.licenseNumber;
            if (request.licenseExpiry !== undefined)
                doctorUpdateData.licenseExpiry = request.licenseExpiry ? new Date(request.licenseExpiry) : null;
            if (request.isLicenseActive !== undefined)
                doctorUpdateData.isLicenseActive = request.isLicenseActive;
            if (request.additionalCertifications !== undefined)
                doctorUpdateData.additionalCertifications = request.additionalCertifications;
            if (request.licenseIssuedBy !== undefined)
                doctorUpdateData.licenseIssuedBy = request.licenseIssuedBy;
            if (request.licenseIssuedDate !== undefined)
                doctorUpdateData.licenseIssuedDate = request.licenseIssuedDate ? new Date(request.licenseIssuedDate) : null;
            if (request.renewalRequired !== undefined)
                doctorUpdateData.renewalRequired = request.renewalRequired;
            // ID Document fields
            if (request.prcIdImage !== undefined)
                doctorUpdateData.prcIdImage = request.prcIdImage;
            if (request.ptrIdImage !== undefined)
                doctorUpdateData.ptrIdImage = request.ptrIdImage;
            if (request.medicalLicenseImage !== undefined)
                doctorUpdateData.medicalLicenseImage = request.medicalLicenseImage;
            if (request.additionalIdImages !== undefined)
                doctorUpdateData.additionalIdImages = request.additionalIdImages;
            // Update DoctorInfo table if there are changes
            if (Object.keys(doctorUpdateData).length > 0) {
                yield prisma.doctorInfo.upsert({
                    where: { userId },
                    update: doctorUpdateData,
                    create: Object.assign(Object.assign({ userId }, doctorUpdateData), { 
                        // Set required fields with defaults if not provided
                        firstName: doctorUpdateData.firstName || '', lastName: doctorUpdateData.lastName || '', gender: doctorUpdateData.gender || 'OTHER', dateOfBirth: doctorUpdateData.dateOfBirth || new Date(), contactNumber: doctorUpdateData.contactNumber || '', address: doctorUpdateData.address || '', bio: doctorUpdateData.bio || '', specialization: doctorUpdateData.specialization || '', qualifications: doctorUpdateData.qualifications || '', experience: doctorUpdateData.experience || 0 }),
                });
            }
            // Update PatientInfo and related EmergencyContact when patient fields are present
            const patientUpdateData = {};
            if (request.fullName !== undefined)
                patientUpdateData.fullName = request.fullName;
            if (request.gender !== undefined)
                patientUpdateData.gender = request.gender;
            if (request.dateOfBirth !== undefined)
                patientUpdateData.dateOfBirth = request.dateOfBirth ? new Date(request.dateOfBirth) : null;
            if (request.contactNumber !== undefined)
                patientUpdateData.contactNumber = request.contactNumber;
            if (request.address !== undefined)
                patientUpdateData.address = request.address;
            if (request.weight !== undefined)
                patientUpdateData.weight = request.weight;
            if (request.height !== undefined)
                patientUpdateData.height = request.height;
            if (request.bloodType !== undefined)
                patientUpdateData.bloodType = request.bloodType;
            if (request.medicalHistory !== undefined)
                patientUpdateData.medicalHistory = (_a = request.medicalHistory) !== null && _a !== void 0 ? _a : null;
            if (request.allergies !== undefined)
                patientUpdateData.allergies = (_b = request.allergies) !== null && _b !== void 0 ? _b : null;
            if (request.medications !== undefined)
                patientUpdateData.medications = (_c = request.medications) !== null && _c !== void 0 ? _c : null;
            if (Object.keys(patientUpdateData).length > 0) {
                yield prisma.patientInfo.upsert({
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
                        medicalHistory: (_d = patientUpdateData.medicalHistory) !== null && _d !== void 0 ? _d : null,
                        allergies: (_e = patientUpdateData.allergies) !== null && _e !== void 0 ? _e : null,
                        medications: (_f = patientUpdateData.medications) !== null && _f !== void 0 ? _f : null,
                    },
                });
            }
            // Upsert EmergencyContact if provided
            if (request.emergencyContact) {
                const { contactName, relationship, contactNumber, contactAddress } = request.emergencyContact;
                yield prisma.emergencyContact.upsert({
                    where: { patientId: userId },
                    update: {
                        contactName,
                        relationship,
                        contactNumber,
                        contactAddress: contactAddress !== null && contactAddress !== void 0 ? contactAddress : null,
                    },
                    create: {
                        patientId: userId,
                        contactName,
                        relationship,
                        contactNumber,
                        contactAddress: contactAddress !== null && contactAddress !== void 0 ? contactAddress : null,
                    },
                });
            }
            // Return fresh profile
            const updated = yield prisma.user.findUnique({
                where: { id: userId },
                include: {
                    doctorInfo: true,
                    patientInfo: { include: { emergencyContact: true, insuranceInfo: true } },
                    doctorCategories: true,
                },
            });
            if (!updated)
                throw new Error('User not found');
            return updated;
        });
    }
    static logout(userId, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!refreshToken)
                return;
            yield prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } });
        });
    }
    static getUserProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({
                where: { id: userId },
                include: {
                    organization: true,
                    doctorInfo: true,
                    patientInfo: { include: { emergencyContact: true, insuranceInfo: true } },
                    doctorCategories: true,
                },
            });
            if (!user)
                throw new Error('User not found');
            return user;
        });
    }
    static emailExists(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({ where: { email } });
            return !!user;
        });
    }
    static resetPassword(_userId, _newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Reset password not implemented');
        });
    }
    static deactivateUser(_userId) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Deactivate user not implemented');
        });
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
