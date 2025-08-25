# Security Implementation Guide

## Overview

This document outlines the comprehensive security features implemented in the QHealth Backend application, following industry best practices and security standards.

## 🛡️ Security Features Implemented

### 1. Authentication & Authorization Security

#### JWT-Based Authentication
- **Access Tokens**: 2-hour expiration with configurable secrets
- **Refresh Tokens**: 7-day expiration with secure rotation
- **Token Verification**: Environment-based JWT secrets
- **Session Management**: 30-minute inactivity timeout
- **Concurrent Sessions**: Maximum 5 concurrent sessions per user

#### Password Security
- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Minimum 8 characters with complexity requirements
- **Requirements**: Uppercase, lowercase, numbers, special characters
- **Change Verification**: Current password verification required

#### Role-Based Access Control (RBAC)
- **Role Middleware**: `requireRole()` for endpoint protection
- **User Verification**: Role verification before resource access
- **Resource Ownership**: Users can only access their own resources
- **Admin Override**: Admin role can access all resources

### 2. API & Network Security

#### CORS Protection
- **Configurable Origins**: Environment-based whitelisting
- **Production Restrictions**: Domain restrictions for production
- **Secure Headers**: Proper method and header restrictions
- **Credentials Support**: Secure cross-origin requests

#### Rate Limiting
- **Express Rate Limiting**: 100 requests per 15 minutes per IP
- **DDoS Protection**: Brute force attack prevention
- **User-Based Limiting**: Rate limiting per user when authenticated
- **Configurable Windows**: Adjustable time windows and limits

#### Security Headers
- **Helmet.js**: Comprehensive security headers
- **Content Security Policy**: XSS and injection protection
- **HSTS**: HTTP Strict Transport Security
- **Frame Protection**: Clickjacking prevention
- **Trust Proxy**: Proper IP handling behind load balancers

### 3. Input Validation & Sanitization

#### Data Validation
- **Express Validator**: Comprehensive input validation
- **Email Validation**: RFC-compliant email format checking
- **Phone Validation**: International format support
- **Date Validation**: Range checking and format validation
- **Required Fields**: All API endpoints validated

#### Input Sanitization
- **DOMPurify**: HTML tag removal and sanitization
- **XSS Protection**: Cross-site scripting prevention
- **SQL Injection Protection**: Basic pattern detection
- **File Upload Validation**: Type and size restrictions
- **Request Size Limits**: 10MB max for JSON and form data

### 4. Audit & Monitoring

#### Comprehensive Audit Logging
- **User Activity Tracking**: Login, logout, CRUD operations
- **IP Address Logging**: Security monitoring and tracking
- **User Agent Tracking**: Device fingerprinting
- **Severity Levels**: Info, warning, error, critical
- **Resource Access**: Detailed resource access logging

#### Security Event Logging
- **Authentication Failures**: Failed login attempts
- **Authorization Failures**: Unauthorized access attempts
- **Suspicious Activities**: Pattern-based detection
- **Rate Limit Violations**: Abuse detection
- **Data Modifications**: Before/after state tracking

### 5. Error Handling & Security

#### Secure Error Responses
- **Production Masking**: No stack traces in production
- **Custom Error Handling**: Proper HTTP status codes
- **Database Error Sanitization**: Information leakage prevention
- **Validation Errors**: Sanitized error messages

#### Request Validation
- **Middleware-Based**: All protected routes validated
- **Authentication Middleware**: Route protection
- **Not-Found Handling**: Path enumeration prevention
- **Input Sanitization**: Automatic input cleaning

## 🔧 Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=2h

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com

# Security Configuration
TRUST_PROXY=true
ENABLE_AUDIT_LOG=true
ENABLE_SECURITY_LOG=true
```

### Security Configuration File

The `src/config/security.config.ts` file centralizes all security settings:

```typescript
export const securityConfig = {
  jwt: {
    accessToken: { expiresIn: '2h' },
    refreshToken: { expiresIn: '7d' }
  },
  session: {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    maxConcurrentSessions: 5
  },
  password: {
    saltRounds: 12,
    minLength: 8
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  }
};
```

## 🚀 Usage Examples

### Protected Routes

```typescript
import { requireRole, requireAuth } from '../shared/middleware/auth-middleware';

// Require specific role
router.get('/admin/users', requireRole([Role.ADMIN]), getUsers);

// Require any authenticated user
router.get('/profile', requireAuth, getProfile);

// Require ownership or admin
router.put('/users/:userId', requireOwnershipOrAdmin('userId'), updateUser);
```

### Input Validation

```typescript
import { validate, validateEmail, validatePassword } from '../utils/validation';

router.post('/register', validate([
  validateEmail(),
  validatePassword(),
  validateRequired('firstName'),
  validateRequired('lastName')
]), registerUser);
```

### Audit Logging

```typescript
import { AuditService, AuditCategory } from '../shared/services/audit.service';

// Log user activity
await AuditService.logUserActivity(
  userId,
  'LOGIN',
  AuditCategory.AUTHENTICATION,
  'User logged in successfully',
  req.ip,
  req.get('User-Agent')
);

// Log security event
await AuditService.logSecurityEvent(
  'AUTH_FAILURE',
  AuditLevel.WARNING,
  'Failed login attempt',
  req.ip,
  req.get('User-Agent')
);
```

## 🧪 Testing Security Features

### Test Environment Variables

```bash
# .env.test
NODE_ENV=test
JWT_SECRET=test-secret-key
ENABLE_AUDIT_LOG=false
ENABLE_SECURITY_LOG=false
```

### Security Testing

```typescript
// Test password validation
describe('Password Security', () => {
  it('should reject weak passwords', () => {
    const weakPassword = '123';
    expect(AuthService.validatePasswordStrength(weakPassword)).toBe(false);
  });

  it('should accept strong passwords', () => {
    const strongPassword = 'StrongPass123!';
    expect(AuthService.validatePasswordStrength(strongPassword)).toBe(true);
  });
});

// Test rate limiting
describe('Rate Limiting', () => {
  it('should block excessive requests', async () => {
    // Make 101 requests
    for (let i = 0; i < 101; i++) {
      const response = await request(app).get('/api/test');
      if (i === 100) {
        expect(response.status).toBe(429);
      }
    }
  });
});
```

## 🔒 Production Security Checklist

### Before Deployment

- [ ] Generate strong, unique JWT secrets
- [ ] Configure production CORS origins
- [ ] Enable audit and security logging
- [ ] Set appropriate log levels
- [ ] Configure HTTPS and SSL certificates
- [ ] Set `TRUST_PROXY=true` if behind load balancer
- [ ] Review and restrict file upload types
- [ ] Configure database connection security
- [ ] Set up monitoring and alerting

### Ongoing Security

- [ ] Regular security audits
- [ ] Monitor audit logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Regular penetration testing
- [ ] Security incident response plan
- [ ] Backup and disaster recovery procedures
- [ ] User access reviews
- [ ] Security training for development team

## 🚨 Security Incident Response

### Immediate Actions

1. **Isolate**: Stop affected services if necessary
2. **Assess**: Determine scope and impact
3. **Log**: Document all incident details
4. **Notify**: Alert security team and stakeholders
5. **Mitigate**: Implement immediate fixes

### Investigation

1. **Audit Logs**: Review relevant audit and security logs
2. **User Activity**: Check affected user accounts
3. **System State**: Analyze system configuration
4. **Timeline**: Establish incident timeline
5. **Root Cause**: Identify underlying cause

### Recovery

1. **Fix**: Implement permanent security fixes
2. **Test**: Verify fixes work correctly
3. **Deploy**: Deploy fixes to production
4. **Monitor**: Watch for recurrence
5. **Document**: Update security procedures

## 📚 Additional Resources

### Security Standards

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

### Tools & Libraries

- [Helmet.js](https://helmetjs.github.io/) - Security headers
- [Express Rate Limit](https://github.com/nfriedly/express-rate-limit) - Rate limiting
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js/) - Password hashing
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT handling
- [express-validator](https://express-validator.github.io/) - Input validation

### Security Testing

- [OWASP ZAP](https://owasp.org/www-project-zap/) - Security testing tool
- [Burp Suite](https://portswigger.net/burp) - Web application security testing
- [Nmap](https://nmap.org/) - Network security scanner

## 🤝 Contributing to Security

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** create a public issue
2. **Email** security@yourdomain.com
3. **Include** detailed description and steps to reproduce
4. **Wait** for security team response
5. **Follow** responsible disclosure guidelines

### Security Code Reviews

All code changes should be reviewed for:

- Input validation and sanitization
- Authentication and authorization
- Error handling and logging
- Security configuration
- Dependency security

### Security Training

Regular security training should cover:

- Secure coding practices
- Common vulnerabilities
- Incident response procedures
- Security testing techniques
- Compliance requirements

---

**Remember**: Security is an ongoing process, not a one-time implementation. Regular reviews, updates, and monitoring are essential for maintaining a secure application.



note:
in security.config.ts
change this code to       ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'] to the proper domain for frontend