"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJWTError = exports.handleRateLimitError = exports.handleValidationError = exports.handleDatabaseError = exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = exports.ErrorSeverity = exports.ErrorTypes = exports.AppError = void 0;
const security_config_1 = require("../../config/security.config");
// Custom error class for application errors
class AppError extends Error {
    constructor(message, statusCode, errorCode = 'UNKNOWN_ERROR', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Error types for different scenarios
exports.ErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    INPUT_ERROR: 'INPUT_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};
// Error severity levels
exports.ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};
// Main error handling middleware
const errorHandler = (error, req, res, next) => {
    let appError;
    // Convert to AppError if it's not already
    if (error instanceof AppError) {
        appError = error;
    }
    else {
        appError = new AppError(error.message || 'Internal server error', 500, exports.ErrorTypes.INTERNAL_SERVER_ERROR, false);
    }
    // Log the error with security context
    logError(appError, req);
    // Determine if we should expose error details
    const shouldExposeDetails = security_config_1.securityConfig.isDevelopment || security_config_1.securityConfig.isTest;
    // Prepare error response
    const errorResponse = {
        success: false,
        message: appError.message,
        error: appError.errorCode,
        timestamp: new Date().toISOString(),
    };
    // Add additional details in development/test mode
    if (shouldExposeDetails) {
        errorResponse.stack = appError.stack;
        errorResponse.details = {
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
        };
    }
    // Set appropriate status code
    const statusCode = appError.statusCode || 500;
    res.status(statusCode);
    // Send error response
    res.json(errorResponse);
};
exports.errorHandler = errorHandler;
// Not found handler middleware
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Route ${req.method} ${req.path} not found`, 404, exports.ErrorTypes.NOT_FOUND_ERROR);
    // Log 404 errors for security monitoring
    logError(error, req);
    res.status(404).json({
        success: false,
        message: 'Route not found',
        error: exports.ErrorTypes.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
    });
};
exports.notFoundHandler = notFoundHandler;
// Async error wrapper for route handlers
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Error logging function
const logError = (error, req) => {
    var _a;
    if (!security_config_1.securityConfig.logging.enableSecurityLog) {
        return;
    }
    const errorLog = {
        timestamp: new Date().toISOString(),
        errorCode: error.errorCode,
        message: error.message,
        statusCode: error.statusCode,
        severity: determineSeverity(error),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
        path: req.path,
        method: req.method,
        stack: security_config_1.securityConfig.isDevelopment ? error.stack : undefined,
        body: security_config_1.securityConfig.isDevelopment ? req.body : undefined,
        query: security_config_1.securityConfig.isDevelopment ? Object.assign({}, req.query) : undefined,
        params: security_config_1.securityConfig.isDevelopment ? Object.assign({}, req.params) : undefined,
    };
    // Log to console in development
    if (security_config_1.securityConfig.isDevelopment) {
        console.error('🚨 Error Log:', JSON.stringify(errorLog, null, 2));
    }
    // Log to file if enabled
    if (security_config_1.securityConfig.logging.logToFile) {
        // TODO: Implement file logging
        console.error('📝 File Log:', errorLog);
    }
    // Log critical errors immediately
    if (errorLog.severity === exports.ErrorSeverity.CRITICAL) {
        console.error('🚨 CRITICAL ERROR:', errorLog);
    }
};
// Determine error severity based on error type and status code
const determineSeverity = (error) => {
    // Critical errors
    if (error.statusCode >= 500) {
        return exports.ErrorSeverity.CRITICAL;
    }
    // High severity errors
    if (error.statusCode === 401 || error.statusCode === 403) {
        return exports.ErrorSeverity.HIGH;
    }
    // Medium severity errors
    if (error.statusCode === 400 || error.statusCode === 404) {
        return exports.ErrorSeverity.MEDIUM;
    }
    // Low severity errors
    return exports.ErrorSeverity.LOW;
};
// Database error handler
const handleDatabaseError = (error) => {
    // Prisma specific errors
    if (error.code) {
        switch (error.code) {
            case 'P2002':
                return new AppError('Resource already exists', 409, exports.ErrorTypes.VALIDATION_ERROR);
            case 'P2025':
                return new AppError('Resource not found', 404, exports.ErrorTypes.NOT_FOUND_ERROR);
            case 'P2003':
                return new AppError('Foreign key constraint failed', 400, exports.ErrorTypes.VALIDATION_ERROR);
            case 'P2014':
                return new AppError('Invalid relation', 400, exports.ErrorTypes.VALIDATION_ERROR);
            default:
                return new AppError('Database operation failed', 500, exports.ErrorTypes.DATABASE_ERROR);
        }
    }
    // Generic database errors
    if (error.name === 'PrismaClientKnownRequestError') {
        return new AppError('Database operation failed', 500, exports.ErrorTypes.DATABASE_ERROR);
    }
    if (error.name === 'PrismaClientValidationError') {
        return new AppError('Invalid data provided', 400, exports.ErrorTypes.VALIDATION_ERROR);
    }
    return new AppError('Database error occurred', 500, exports.ErrorTypes.DATABASE_ERROR);
};
exports.handleDatabaseError = handleDatabaseError;
// Validation error handler
const handleValidationError = (errors) => {
    const errorMessage = errors.map((err) => `${err.path}: ${err.message}`).join(', ');
    return new AppError(`Validation failed: ${errorMessage}`, 400, exports.ErrorTypes.VALIDATION_ERROR);
};
exports.handleValidationError = handleValidationError;
// Rate limit error handler
const handleRateLimitError = () => {
    return new AppError('Too many requests, please try again later', 429, exports.ErrorTypes.RATE_LIMIT_ERROR);
};
exports.handleRateLimitError = handleRateLimitError;
// JWT error handler
const handleJWTError = (error) => {
    if (error.name === 'TokenExpiredError') {
        return new AppError('Token has expired', 401, exports.ErrorTypes.AUTHENTICATION_ERROR);
    }
    if (error.name === 'JsonWebTokenError') {
        return new AppError('Invalid token', 401, exports.ErrorTypes.AUTHENTICATION_ERROR);
    }
    if (error.name === 'NotBeforeError') {
        return new AppError('Token not active', 401, exports.ErrorTypes.AUTHENTICATION_ERROR);
    }
    return new AppError('Authentication failed', 401, exports.ErrorTypes.AUTHENTICATION_ERROR);
};
exports.handleJWTError = handleJWTError;
// Export error types for use in other modules
