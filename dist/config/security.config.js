"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.securityConfig = {
    // JWT Configuration
    jwt: {
        accessToken: {
            secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
            expiresIn: process.env.JWT_EXPIRES_IN || '2h', // 2 hours
            algorithm: 'HS256',
        },
        refreshToken: {
            secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-super-secret-refresh-key-change-in-production',
            expiresIn: '7d', // 7 days
            algorithm: 'HS256',
        },
    },
    // Session Configuration
    session: {
        inactivityTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
        maxConcurrentSessions: 5, // Maximum concurrent sessions per user
    },
    // Password Security
    password: {
        saltRounds: 12,
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        // Commented out for testing - uncomment for production
        // strictValidation: true,
    },
    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window per IP
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    },
    // CORS Configuration
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ((_a = process.env.ALLOWED_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(',')) || ['https://yourdomain.com']
            : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
        maxAge: 86400, // 24 hours
    },
    // Security Headers
    headers: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        },
    },
    // File Upload Security
    fileUpload: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
        uploadDir: './uploads',
        tempDir: './temp',
    },
    // Request Size Limits
    requestLimits: {
        json: '10mb',
        urlencoded: '10mb',
        formData: '10mb',
    },
    // Environment-specific settings
    environment: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',
    // Trust Proxy (for load balancers)
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
        enableSecurityLog: process.env.ENABLE_SECURITY_LOG !== 'false',
        logToFile: process.env.LOG_TO_FILE === 'true',
        logDir: process.env.LOG_DIR || './logs',
    },
};
exports.default = exports.securityConfig;
