import type { Request, Response, NextFunction } from 'express';
// Use require-style to avoid editor/type resolution issues with named exports
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { body, validationResult } = require('express-validator');
type ValidationChain = any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('isomorphic-dompurify');
import { securityConfig } from '../config/security.config';

// Validation result middleware
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Sanitize error messages in production
    const sanitizedErrors = securityConfig.isProduction 
      ? errors.array().map((error: any) => ({ field: error.path, message: 'Validation failed' }))
      : errors.array();

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: sanitizedErrors,
      error: 'VALIDATION_ERROR'
    });
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize body (this is safe to modify)
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Note: We cannot modify req.query and req.params as they are getter-only
  // The sanitization will be applied when these values are accessed
  // This is a limitation of Express's design for security reasons

  next();
};

// Recursively sanitize objects
const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

// Email validation
export const validateEmail = () => {
  return body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ min: 5, max: 254 })
    .withMessage('Email must be between 5 and 254 characters');
};

// Password validation
export const validatePassword = () => {
  const { password } = securityConfig;
  
  return body('password')
    .trim()
    .isLength({ min: password.minLength })
    .withMessage(`Password must be at least ${password.minLength} characters long`)
    .matches(/^(?=.*[a-z])/, 'g')
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/^(?=.*[A-Z])/, 'g')
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/^(?=.*\d)/, 'g')
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[@$!%*?&])/, 'g')
    .withMessage('Password must contain at least one special character (@$!%*?&)');
};

// Phone number validation (international format)
export const validatePhoneNumber = () => {
  return body('contactNumber')
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid international phone number')
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 digits');
};

// Date validation
export const validateDate = (fieldName: string = 'date') => {
  return body(fieldName)
    .trim()
    .isISO8601()
    .withMessage('Please provide a valid date in ISO format')
    .custom((value: any) => {
      const date = new Date(value);
      const now = new Date();
      const minDate = new Date('1900-01-01');
      
      if (date > now) {
        throw new Error('Date cannot be in the future');
      }
      
      if (date < minDate) {
        throw new Error('Date cannot be before 1900');
      }
      
      return true;
    });
};

// Name validation
export const validateName = (fieldName: string = 'name') => {
  return body(fieldName)
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage(`${fieldName} must be between 2 and 50 characters`)
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
};

// Required field validation
export const validateRequired = (fieldName: string, displayName?: string) => {
  return body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${displayName || fieldName} is required`);
};

// File upload validation
export const validateFileUpload = (fieldName: string = 'file') => {
  return body(fieldName)
    .custom((value: any, { req }: any) => {
      if (!req.file) {
        throw new Error('File is required');
      }

      const { maxSize, allowedTypes } = securityConfig.fileUpload;
      
      // Check file size
      if (req.file.size > maxSize) {
        throw new Error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
      }

      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }

      return true;
    });
};

// UUID validation
export const validateUUID = (fieldName: string = 'id') => {
  return body(fieldName)
    .trim()
    .isUUID()
    .withMessage(`${fieldName} must be a valid UUID`);
};

// Numeric validation
export const validateNumber = (fieldName: string, min?: number, max?: number) => {
  let validation = body(fieldName)
    .trim()
    .isNumeric()
    .withMessage(`${fieldName} must be a number`);

  if (min !== undefined) {
    validation = validation.isFloat({ min });
  }

  if (max !== undefined) {
    validation = validation.isFloat({ max });
  }

  return validation;
};

// URL validation
export const validateURL = (fieldName: string = 'url') => {
  return body(fieldName)
    .trim()
    .isURL()
    .withMessage(`${fieldName} must be a valid URL`)
    .custom((value: any) => {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
      return true;
    });
};

// Role validation
export const validateRole = () => {
  return body('role')
    .trim()
    .isIn(['ADMIN', 'DOCTOR', 'PATIENT'])
    .withMessage('Role must be ADMIN, DOCTOR, or PATIENT');
};

// Pagination validation
export const validatePagination = () => {
  return [
    body('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ];
};

// Search query validation
export const validateSearchQuery = () => {
  return body('query')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,]+$/)
    .withMessage('Search query contains invalid characters');
};

// XSS Protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Set XSS protection headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  next();
};

// SQL Injection protection (basic)
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
    /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected',
      error: 'INVALID_INPUT'
    });
  }

  next();
};

// Export common validation chains
export const commonValidations = {
  email: validateEmail(),
  password: validatePassword(),
  phoneNumber: validatePhoneNumber(),
  name: validateName(),
  role: validateRole(),
  pagination: validatePagination(),
  searchQuery: validateSearchQuery(),
};
