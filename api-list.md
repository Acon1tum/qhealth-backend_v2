# API List - Payroll Backend

This document provides a comprehensive list of all available APIs in the payroll backend system, organized by module.

## Table of Contents
- [Authentication Module](#authentication-module)
- [Payroll Management Module](#payroll-management-module)
- [System Administration Module](#system-administration-module)

---

## Authentication Module

**Base Path:** `/auth`

### Public Endpoints
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/auth/register` | Register a new user | None |
| POST | `/auth/login` | User login | None |
| POST | `/auth/refresh-token` | Refresh access token | None |

### Protected Endpoints
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/auth/change-password` | Change user password | Required |
| POST | `/auth/logout` | User logout | Required |

---

## Payroll Management Module

**Base Path:** `/payroll`

*All endpoints require authentication*

### Payroll Runs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payroll/runs` | Create a new payroll run |
| GET | `/payroll/runs` | Get all payroll runs |
| GET | `/payroll/runs/:id` | Get payroll run by ID |
| PUT | `/payroll/runs/:id/process` | Process a payroll run |
| PUT | `/payroll/runs/:id/approve` | Approve a payroll run |
| PUT | `/payroll/runs/:id/release` | Release a payroll run |

### Payslips
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/payslips` | Get all payslips |
| GET | `/payroll/payslips/:id` | Get payslip by ID |
| PUT | `/payroll/payslips/:id/release` | Release a payslip |
| GET | `/payroll/payslips/:id/pdf` | Generate payslip PDF |

### Contributions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/contributions/rates` | Get contribution rates |
| POST | `/payroll/contributions/rates` | Create contribution rate |
| GET | `/payroll/contributions/history` | Get contribution history |

### Custom Deductions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/deductions` | Get custom deductions |
| POST | `/payroll/deductions` | Create custom deduction |

### Loans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/loans` | Get all loans |
| POST | `/payroll/loans` | Create a new loan |
| PUT | `/payroll/loans/:id/status` | Update loan status |

### 13th Month Pay
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/thirteenth-month` | Get 13th month records |
| POST | `/payroll/thirteenth-month/calculate` | Calculate 13th month pay |

### Final Pay
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/final-pay` | Get final pays |
| POST | `/payroll/final-pay` | Create final pay |

### Government Remittance Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payroll/remittance/generate` | Generate remittance file |
| GET | `/payroll/remittance/files` | Get remittance files |

### Bank Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payroll/bank/generate` | Generate bank file |
| GET | `/payroll/bank/files` | Get bank files |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/reports/summary` | Get payroll summary |
| GET | `/payroll/reports/contributions` | Get contribution breakdown |
| GET | `/payroll/reports/loans` | Get loan balances |
| GET | `/payroll/reports/audit-logs` | Get audit logs |

---

## System Administration Module

**Base Path:** `/system`

### Users Management
**Base Path:** `/system/users`

*All endpoints require Admin role*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/users` | List all users |
| GET | `/system/users/:id` | Get user by ID |
| POST | `/system/users` | Create a new user |
| PUT | `/system/users/:id` | Update user |
| DELETE | `/system/users/:id` | Delete user |
| PATCH | `/system/users/:id/password` | Change user password |
| PATCH | `/system/users/:id/roles` | Assign roles to user |

### Roles Management
**Base Path:** `/system/roles`

*All endpoints require Admin role*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/roles` | List all available roles |

### Departments Management
**Base Path:** `/system/departments`

*All endpoints require Admin or HR role*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/departments` | Get all departments |

### Audit Logs
**Base Path:** `/system/audit-logs`

*All endpoints require Admin role*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/audit-logs` | List audit logs |
| GET | `/system/audit-logs/:id` | Get specific audit log |

### System Root
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system` | System administration module root |

---

## Authentication & Authorization

### Authentication Levels
- **None**: Public endpoints that don't require authentication
- **Required**: Protected endpoints that require valid authentication token
- **Admin**: Endpoints that require Admin role
- **HR**: Endpoints that require HR role

### Middleware
- `authMiddleware`: Validates JWT tokens
- `requireRole`: Checks user roles for authorization

### Common Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Response Format

All APIs follow a consistent response format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Notes

- All timestamps are in ISO 8601 format
- Pagination is supported for list endpoints using query parameters
- File uploads (PDFs, bank files) are handled via multipart/form-data
- Rate limiting may be applied to prevent abuse
- All sensitive operations are logged in the audit system

---

*Last updated: Generated from route files* 