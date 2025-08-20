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
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonValidations = exports.sqlInjectionProtection = exports.xssProtection = exports.validateSearchQuery = exports.validatePagination = exports.validateRole = exports.validateURL = exports.validateNumber = exports.validateUUID = exports.validateFileUpload = exports.validateRequired = exports.validateName = exports.validateDate = exports.validatePhoneNumber = exports.validatePassword = exports.validateEmail = exports.sanitizeInput = exports.validate = void 0;
// Use require-style to avoid editor/type resolution issues with named exports
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { body, validationResult } = require('express-validator');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('isomorphic-dompurify');
const security_config_1 = require("../config/security.config");
// Validation result middleware
const validate = (validations) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Execute all validations
        yield Promise.all(validations.map(validation => validation.run(req)));
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        // Sanitize error messages in production
        const sanitizedErrors = security_config_1.securityConfig.isProduction
            ? errors.array().map((error) => ({ field: error.path, message: 'Validation failed' }))
            : errors.array();
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: sanitizedErrors,
            error: 'VALIDATION_ERROR'
        });
    });
};
exports.validate = validate;
// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    // Sanitize query parameters
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    // Sanitize URL parameters
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    next();
};
exports.sanitizeInput = sanitizeInput;
// Recursively sanitize objects
const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
        return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
};
// Email validation
const validateEmail = () => {
    return body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ min: 5, max: 254 })
        .withMessage('Email must be between 5 and 254 characters');
};
exports.validateEmail = validateEmail;
// Password validation
const validatePassword = () => {
    const { password } = security_config_1.securityConfig;
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
exports.validatePassword = validatePassword;
// Phone number validation (international format)
const validatePhoneNumber = () => {
    return body('contactNumber')
        .trim()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid international phone number')
        .isLength({ min: 10, max: 15 })
        .withMessage('Phone number must be between 10 and 15 digits');
};
exports.validatePhoneNumber = validatePhoneNumber;
// Date validation
const validateDate = (fieldName = 'date') => {
    return body(fieldName)
        .trim()
        .isISO8601()
        .withMessage('Please provide a valid date in ISO format')
        .custom((value) => {
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
exports.validateDate = validateDate;
// Name validation
const validateName = (fieldName = 'name') => {
    return body(fieldName)
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage(`${fieldName} must be between 2 and 50 characters`)
        .matches(/^[a-zA-Z\s\-']+$/)
        .withMessage(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
};
exports.validateName = validateName;
// Required field validation
const validateRequired = (fieldName, displayName) => {
    return body(fieldName)
        .trim()
        .notEmpty()
        .withMessage(`${displayName || fieldName} is required`);
};
exports.validateRequired = validateRequired;
// File upload validation
const validateFileUpload = (fieldName = 'file') => {
    return body(fieldName)
        .custom((value, { req }) => {
        if (!req.file) {
            throw new Error('File is required');
        }
        const { maxSize, allowedTypes } = security_config_1.securityConfig.fileUpload;
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
exports.validateFileUpload = validateFileUpload;
// UUID validation
const validateUUID = (fieldName = 'id') => {
    return body(fieldName)
        .trim()
        .isUUID()
        .withMessage(`${fieldName} must be a valid UUID`);
};
exports.validateUUID = validateUUID;
// Numeric validation
const validateNumber = (fieldName, min, max) => {
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
exports.validateNumber = validateNumber;
// URL validation
const validateURL = (fieldName = 'url') => {
    return body(fieldName)
        .trim()
        .isURL()
        .withMessage(`${fieldName} must be a valid URL`)
        .custom((value) => {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('URL must use HTTP or HTTPS protocol');
        }
        return true;
    });
};
exports.validateURL = validateURL;
// Role validation
const validateRole = () => {
    return body('role')
        .trim()
        .isIn(['ADMIN', 'DOCTOR', 'PATIENT'])
        .withMessage('Role must be ADMIN, DOCTOR, or PATIENT');
};
exports.validateRole = validateRole;
// Pagination validation
const validatePagination = () => {
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
exports.validatePagination = validatePagination;
// Search query validation
const validateSearchQuery = () => {
    return body('query')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_.,]+$/)
        .withMessage('Search query contains invalid characters');
};
exports.validateSearchQuery = validateSearchQuery;
// XSS Protection middleware
const xssProtection = (req, res, next) => {
    // Set XSS protection headers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
};
exports.xssProtection = xssProtection;
// SQL Injection protection (basic)
const sqlInjectionProtection = (req, res, next) => {
    const suspiciousPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
        /(--|\/\*|\*\/|xp_|sp_)/i,
        /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
    ];
    const checkValue = (value) => {
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
exports.sqlInjectionProtection = sqlInjectionProtection;
// Export common validation chains
exports.commonValidations = {
    email: (0, exports.validateEmail)(),
    password: (0, exports.validatePassword)(),
    phoneNumber: (0, exports.validatePhoneNumber)(),
    name: (0, exports.validateName)(),
    role: (0, exports.validateRole)(),
    pagination: (0, exports.validatePagination)(),
    searchQuery: (0, exports.validateSearchQuery)(),
};
