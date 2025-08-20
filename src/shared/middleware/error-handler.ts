import { Request, Response, NextFunction } from 'express';
import { securityConfig } from '../../config/security.config';

// Custom error class for application errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string = 'UNKNOWN_ERROR', isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types for different scenarios
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INPUT_ERROR: 'INPUT_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// Error logging interface
interface ErrorLog {
  timestamp: string;
  errorCode: string;
  message: string;
  statusCode: number;
  severity: string;
  ip: string;
  userAgent: string;
  userId?: number;
  path: string;
  method: string;
  stack?: string;
  body?: any;
  query?: any;
  params?: any;
}

// Main error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Convert to AppError if it's not already
  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = new AppError(
      error.message || 'Internal server error',
      500,
      ErrorTypes.INTERNAL_SERVER_ERROR,
      false
    );
  }

  // Log the error with security context
  logError(appError, req);

  // Determine if we should expose error details
  const shouldExposeDetails = securityConfig.isDevelopment || securityConfig.isTest;

  // Prepare error response
  const errorResponse: any = {
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

// Not found handler middleware
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    ErrorTypes.NOT_FOUND_ERROR
  );

  // Log 404 errors for security monitoring
  logError(error, req);

  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: ErrorTypes.NOT_FOUND_ERROR,
    timestamp: new Date().toISOString(),
  });
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error logging function
const logError = (error: AppError, req: Request): void => {
  if (!securityConfig.logging.enableSecurityLog) {
    return;
  }

  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    errorCode: error.errorCode,
    message: error.message,
    statusCode: error.statusCode,
    severity: determineSeverity(error),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    userId: (req as any).user?.id,
    path: req.path,
    method: req.method,
    stack: securityConfig.isDevelopment ? error.stack : undefined,
    body: securityConfig.isDevelopment ? req.body : undefined,
    query: securityConfig.isDevelopment ? Object.assign({}, req.query) : undefined,
    params: securityConfig.isDevelopment ? Object.assign({}, req.params) : undefined,
  };

  // Log to console in development
  if (securityConfig.isDevelopment) {
    console.error('🚨 Error Log:', JSON.stringify(errorLog, null, 2));
  }

  // Log to file if enabled
  if (securityConfig.logging.logToFile) {
    // TODO: Implement file logging
    console.error('📝 File Log:', errorLog);
  }

  // Log critical errors immediately
  if (errorLog.severity === ErrorSeverity.CRITICAL) {
    console.error('🚨 CRITICAL ERROR:', errorLog);
  }
};

// Determine error severity based on error type and status code
const determineSeverity = (error: AppError): string => {
  // Critical errors
  if (error.statusCode >= 500) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (error.statusCode === 401 || error.statusCode === 403) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors
  if (error.statusCode === 400 || error.statusCode === 404) {
    return ErrorSeverity.MEDIUM;
  }

  // Low severity errors
  return ErrorSeverity.LOW;
};

// Database error handler
export const handleDatabaseError = (error: any): AppError => {
  // Prisma specific errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return new AppError('Resource already exists', 409, ErrorTypes.VALIDATION_ERROR);
      case 'P2025':
        return new AppError('Resource not found', 404, ErrorTypes.NOT_FOUND_ERROR);
      case 'P2003':
        return new AppError('Foreign key constraint failed', 400, ErrorTypes.VALIDATION_ERROR);
      case 'P2014':
        return new AppError('Invalid relation', 400, ErrorTypes.VALIDATION_ERROR);
      default:
        return new AppError('Database operation failed', 500, ErrorTypes.DATABASE_ERROR);
    }
  }

  // Generic database errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return new AppError('Database operation failed', 500, ErrorTypes.DATABASE_ERROR);
  }

  if (error.name === 'PrismaClientValidationError') {
    return new AppError('Invalid data provided', 400, ErrorTypes.VALIDATION_ERROR);
  }

  return new AppError('Database error occurred', 500, ErrorTypes.DATABASE_ERROR);
};

// Validation error handler
export const handleValidationError = (errors: any[]): AppError => {
  const errorMessage = errors.map((err: any) => `${err.path}: ${err.message}`).join(', ');
  return new AppError(`Validation failed: ${errorMessage}`, 400, ErrorTypes.VALIDATION_ERROR);
};

// Rate limit error handler
export const handleRateLimitError = (): AppError => {
  return new AppError(
    'Too many requests, please try again later',
    429,
    ErrorTypes.RATE_LIMIT_ERROR
  );
};

// JWT error handler
export const handleJWTError = (error: any): AppError => {
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token has expired', 401, ErrorTypes.AUTHENTICATION_ERROR);
  }
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, ErrorTypes.AUTHENTICATION_ERROR);
  }
  if (error.name === 'NotBeforeError') {
    return new AppError('Token not active', 401, ErrorTypes.AUTHENTICATION_ERROR);
  }
  return new AppError('Authentication failed', 401, ErrorTypes.AUTHENTICATION_ERROR);
};

// Export error types for use in other modules
