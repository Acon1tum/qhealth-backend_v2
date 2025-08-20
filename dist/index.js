"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Import security configuration
const security_config_1 = require("./config/security.config");
// Import modules
const email_routes_1 = require("./modules/email/email.routes");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
// Import middleware
const error_handler_1 = require("./shared/middleware/error-handler");
const validation_1 = require("./utils/validation");
const auth_middleware_1 = require("./shared/middleware/auth-middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Trust proxy configuration for load balancers
if (security_config_1.securityConfig.trustProxy) {
    app.set('trust proxy', 1);
}
// Enhanced rate limiting with security configuration
const limiter = (0, express_rate_limit_1.default)({
    windowMs: security_config_1.securityConfig.rateLimit.windowMs,
    max: security_config_1.securityConfig.rateLimit.max,
    message: security_config_1.securityConfig.rateLimit.message,
    standardHeaders: security_config_1.securityConfig.rateLimit.standardHeaders,
    legacyHeaders: security_config_1.securityConfig.rateLimit.legacyHeaders,
    skipSuccessfulRequests: security_config_1.securityConfig.rateLimit.skipSuccessfulRequests,
    skipFailedRequests: security_config_1.securityConfig.rateLimit.skipFailedRequests,
    // Enhanced rate limiting for security
    keyGenerator: (req) => {
        var _a;
        // Use user ID if authenticated, otherwise use IPv6-safe IP key generator
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (userId)
            return String(userId);
        return (0, express_rate_limit_1.ipKeyGenerator)(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(security_config_1.securityConfig.rateLimit.windowMs / 1000),
        });
    },
});
// Enhanced CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (security_config_1.securityConfig.cors.origin.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: security_config_1.securityConfig.cors.credentials,
    methods: security_config_1.securityConfig.cors.methods,
    allowedHeaders: security_config_1.securityConfig.cors.allowedHeaders,
    exposedHeaders: security_config_1.securityConfig.cors.exposedHeaders,
    maxAge: security_config_1.securityConfig.cors.maxAge,
};
// Enhanced Helmet configuration with security headers
const helmetConfig = {
    contentSecurityPolicy: security_config_1.securityConfig.headers.contentSecurityPolicy,
    hsts: security_config_1.securityConfig.headers.hsts,
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
};
// Middleware stack
app.use((0, helmet_1.default)(helmetConfig));
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(limiter);
// Security middleware
app.use(validation_1.xssProtection);
app.use(validation_1.sqlInjectionProtection);
app.use(validation_1.sanitizeInput);
// Request size limits
app.use(express_1.default.json({ limit: security_config_1.securityConfig.requestLimits.json }));
app.use(express_1.default.urlencoded({ extended: true, limit: security_config_1.securityConfig.requestLimits.urlencoded }));
// Health check endpoint with security headers
app.get('/health', (req, res) => {
    // Set security headers for health check
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: security_config_1.securityConfig.environment,
        version: process.env.npm_package_version || '1.0.0',
    });
});
// Security status endpoint (for monitoring)
app.get('/security-status', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            environment: security_config_1.securityConfig.environment,
            securityFeatures: {
                cors: security_config_1.securityConfig.cors.origin.length > 0,
                rateLimiting: security_config_1.securityConfig.rateLimit.max > 0,
                passwordPolicy: security_config_1.securityConfig.password.minLength >= 8,
                jwtExpiration: security_config_1.securityConfig.jwt.accessToken.expiresIn,
                sessionTimeout: security_config_1.securityConfig.session.inactivityTimeout,
            },
            timestamp: new Date().toISOString(),
        },
    });
});
// Protected admin endpoint (demonstrates auth middleware)
app.get('/admin/security-audit', auth_middleware_1.authenticateToken, auth_middleware_1.requireAuth, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Admin access granted',
        data: {
            user: req.user,
            timestamp: new Date().toISOString(),
            securityLevel: 'admin',
        },
    });
});
// API Routes with security middleware
app.use('/api/auth', auth_routes_1.default);
app.use('/api/email', email_routes_1.emailRoutes);
// Serve static files with enhanced security
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads'), {
    setHeaders: (res, filePath) => {
        // Security headers for file serving
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Download-Options', 'noopen');
        // CORS headers for file access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        // Cache control for security
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
}));
// 404 handler for undefined routes (security against path enumeration)
app.use((req, res, next) => (0, error_handler_1.notFoundHandler)(req, res, next));
// Global error handler (must be last)
app.use(error_handler_1.errorHandler);
// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});
// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${security_config_1.securityConfig.environment}`);
    console.log(`🛡️ Security features enabled:`);
    console.log(`   - CORS: ${security_config_1.securityConfig.cors.origin.length > 0 ? 'Yes' : 'No'}`);
    console.log(`   - Rate Limiting: ${security_config_1.securityConfig.rateLimit.max} requests per ${security_config_1.securityConfig.rateLimit.windowMs / 60000} minutes`);
    console.log(`   - Password Policy: Min ${security_config_1.securityConfig.password.minLength} chars`);
    console.log(`   - JWT Expiration: ${security_config_1.securityConfig.jwt.accessToken.expiresIn}`);
    console.log(`   - Session Timeout: ${security_config_1.securityConfig.session.inactivityTimeout / 60000} minutes`);
});
