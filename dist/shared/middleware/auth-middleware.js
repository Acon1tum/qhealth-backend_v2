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
exports.logAuthAttempt = exports.rateLimit = exports.requirePatientAccess = exports.requireOwnershipOrAdmin = exports.optionalAuth = exports.requireAuth = exports.requirePatientOrAdmin = exports.requireDoctorOrAdmin = exports.requirePatient = exports.requireDoctor = exports.requireAdmin = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const types_1 = require("../../types");
const prisma = new client_1.PrismaClient();
/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            const response = {
                success: false,
                message: 'Access token is required',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Get user from database
        const user = yield prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                doctorInfo: true,
                patientInfo: true,
                doctorCategories: true,
            },
        });
        if (!user) {
            const response = {
                success: false,
                message: 'User not found',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        // Check if user is active (you can add an isActive field to your User model)
        // if (!user.isActive) {
        //   const response: IApiResponse = {
        //     success: false,
        //     message: 'User account is deactivated',
        //     error: 'FORBIDDEN',
        //   };
        //   res.status(403).json(response);
        //   return;
        // }
        // Attach user and token to request
        req.user = user;
        req.token = token;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            const response = {
                success: false,
                message: 'Invalid or expired token',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            const response = {
                success: false,
                message: 'Token has expired',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
        }
        else {
            const response = {
                success: false,
                message: 'Authentication failed',
                error: 'INTERNAL_SERVER_ERROR',
            };
            res.status(500).json(response);
        }
    }
});
exports.authenticateToken = authenticateToken;
/**
 * Role-based access control middleware
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            const response = {
                success: false,
                message: 'Authentication required',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            const response = {
                success: false,
                message: 'Insufficient permissions',
                error: 'FORBIDDEN',
            };
            res.status(403).json(response);
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
/**
 * Require admin role
 */
exports.requireAdmin = (0, exports.requireRole)([types_1.Role.ADMIN]);
/**
 * Require doctor role
 */
exports.requireDoctor = (0, exports.requireRole)([types_1.Role.DOCTOR]);
/**
 * Require patient role
 */
exports.requirePatient = (0, exports.requireRole)([types_1.Role.PATIENT]);
/**
 * Require doctor or admin role
 */
exports.requireDoctorOrAdmin = (0, exports.requireRole)([types_1.Role.DOCTOR, types_1.Role.ADMIN]);
/**
 * Require patient or admin role
 */
exports.requirePatientOrAdmin = (0, exports.requireRole)([types_1.Role.PATIENT, types_1.Role.ADMIN]);
/**
 * Require any authenticated user
 */
exports.requireAuth = (0, exports.requireRole)([types_1.Role.ADMIN, types_1.Role.DOCTOR, types_1.Role.PATIENT]);
/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = yield prisma.user.findUnique({
                where: { id: decoded.userId },
                include: {
                    doctorInfo: true,
                    patientInfo: true,
                    doctorCategories: true,
                },
            });
            if (user) {
                req.user = user;
                req.token = token;
            }
        }
        next();
    }
    catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
});
exports.optionalAuth = optionalAuth;
/**
 * Check if user owns the resource or is admin
 */
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            const response = {
                success: false,
                message: 'Authentication required',
                error: 'UNAUTHORIZED',
            };
            res.status(401).json(response);
            return;
        }
        // Admin can access any resource
        if (req.user.role === types_1.Role.ADMIN) {
            next();
            return;
        }
        // Check if user owns the resource
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
        if (!resourceUserId) {
            const response = {
                success: false,
                message: 'Resource user ID not found',
                error: 'BAD_REQUEST',
            };
            res.status(400).json(response);
            return;
        }
        if (parseInt(resourceUserId) !== req.user.id) {
            const response = {
                success: false,
                message: 'Access denied to this resource',
                error: 'FORBIDDEN',
            };
            res.status(403).json(response);
            return;
        }
        next();
    };
};
exports.requireOwnershipOrAdmin = requireOwnershipOrAdmin;
/**
 * Check if user can access patient data (doctor or patient themselves)
 */
const requirePatientAccess = (req, res, next) => {
    if (!req.user) {
        const response = {
            success: false,
            message: 'Authentication required',
            error: 'UNAUTHORIZED',
        };
        res.status(401).json(response);
        return;
    }
    const patientId = req.params.patientId || req.body.patientId;
    if (!patientId) {
        const response = {
            success: false,
            message: 'Patient ID not found',
            error: 'BAD_REQUEST',
        };
        res.status(400).json(response);
        return;
    }
    // Admin can access any patient data
    if (req.user.role === types_1.Role.ADMIN) {
        next();
        return;
    }
    // Doctor can access patient data
    if (req.user.role === types_1.Role.DOCTOR) {
        next();
        return;
    }
    // Patient can only access their own data
    if (req.user.role === types_1.Role.PATIENT && parseInt(patientId) === req.user.id) {
        next();
        return;
    }
    const response = {
        success: false,
        message: 'Access denied to patient data',
        error: 'FORBIDDEN',
    };
    res.status(403).json(response);
};
exports.requirePatientAccess = requirePatientAccess;
/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    return (req, res, next) => {
        const ip = req.ip || 'unknown';
        const now = Date.now();
        const userRequests = requests.get(ip);
        if (!userRequests || now > userRequests.resetTime) {
            requests.set(ip, { count: 1, resetTime: now + windowMs });
            next();
            return;
        }
        if (userRequests.count >= maxRequests) {
            const response = {
                success: false,
                message: 'Too many requests, please try again later',
                error: 'TOO_MANY_REQUESTS',
            };
            res.status(429).json(response);
            return;
        }
        userRequests.count++;
        next();
    };
};
exports.rateLimit = rateLimit;
/**
 * Log authentication attempts
 */
const logAuthAttempt = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    console.log(`Auth attempt from ${ip} - User-Agent: ${userAgent}`);
    next();
};
exports.logAuthAttempt = logAuthAttempt;
