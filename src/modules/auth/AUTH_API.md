# Authentication API Documentation

## Overview

The Authentication API provides endpoints for user management, authentication, and profile management in the QHealth healthcare application. It supports three user roles: Admin, Doctor, and Patient.

## Base URL

```
http://localhost:3000/api/auth
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. User Login

**POST** `/auth/login`

Authenticate a user and receive access and refresh tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "DOCTOR",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "doctorInfo": {
        "id": 1,
        "firstName": "John",
        "lastName": "Smith",
        "specialization": "Cardiology",
        "qualifications": "MD, FACC",
        "experience": 15
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Rate Limit:** 5 attempts per 15 minutes

---

### 2. User Registration

**POST** `/auth/register`

Register a new user account. Different fields are required based on the user role.

**Request Body for Doctor:**
```json
{
  "email": "doctor@qhealth.com",
  "password": "SecurePassword123!",
  "role": "DOCTOR",
  "firstName": "John",
  "lastName": "Smith",
  "gender": "MALE",
  "dateOfBirth": "1980-05-15",
  "contactNumber": "+1-555-0101",
  "address": "123 Medical Center Dr",
  "bio": "Experienced cardiologist",
  "specialization": "Cardiology",
  "qualifications": "MD, FACC",
  "experience": 15
}
```

**Request Body for Patient:**
```json
{
  "email": "patient@qhealth.com",
  "password": "SecurePassword123!",
  "role": "PATIENT",
  "fullName": "Jane Doe",
  "gender": "FEMALE",
  "dateOfBirth": "1990-01-01",
  "contactNumber": "+1-555-0201",
  "address": "456 Health Ave",
  "weight": 65.5,
  "height": 165.0,
  "bloodType": "A+",
  "medicalHistory": "No significant history",
  "allergies": "None",
  "medications": "None"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { /* user profile */ },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Rate Limit:** 3 attempts per hour

---

### 3. Refresh Access Token

**POST** `/auth/refresh`

Get a new access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Rate Limit:** 10 attempts per 15 minutes

---

### 4. Get User Profile

**GET** `/auth/profile`

Get the authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "DOCTOR",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "doctorInfo": {
      "id": 1,
      "firstName": "John",
      "lastName": "Smith",
      "specialization": "Cardiology",
      "qualifications": "MD, FACC",
      "experience": 15
    }
  }
}
```

**Authentication Required:** Yes

---

### 5. Update User Profile

**PUT** `/auth/profile`

Update the authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Request Body (Doctor):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "bio": "Updated bio",
  "contactNumber": "+1-555-0102",
  "address": "Updated address"
}
```

**Request Body (Patient):**
```json
{
  "fullName": "Jane Doe",
  "contactNumber": "+1-555-0202",
  "address": "Updated address",
  "weight": 66.0,
  "height": 165.0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { /* updated user profile */ }
}
```

**Authentication Required:** Yes

---

### 6. Change Password

**POST** `/auth/change-password`

Change the authenticated user's password.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Authentication Required:** Yes

---

### 7. User Logout

**POST** `/auth/logout`

Logout the authenticated user and invalidate refresh tokens.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Request Body (Optional):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Authentication Required:** Yes

---

### 8. Check Email Availability

**GET** `/auth/check-email/:email`

Check if an email address is already registered.

**Response:**
```json
{
  "success": true,
  "message": "Email check completed",
  "data": {
    "exists": false
  }
}
```

**Rate Limit:** 20 checks per 15 minutes

---

### 9. Validate Password Strength

**POST** `/auth/validate-password`

Validate password strength without creating an account.

**Request Body:**
```json
{
  "password": "TestPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password validation completed",
  "data": {
    "isValid": true,
    "errors": []
  }
}
```

**Rate Limit:** 20 validations per 15 minutes

---

### 10. Health Check

**GET** `/auth/health`

Check the authentication service health status.

**Response:**
```json
{
  "success": true,
  "message": "Auth service is healthy",
  "data": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "service": "auth",
    "status": "operational"
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_TYPE"
}
```

### Common Error Types

- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required or failed
- `FORBIDDEN` - Insufficient permissions
- `BAD_REQUEST` - Invalid request data
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `TOO_MANY_REQUESTS` - Rate limit exceeded
- `INTERNAL_SERVER_ERROR` - Server error

---

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

---

## JWT Token Information

- **Access Token Expiry:** 15 minutes (configurable)
- **Refresh Token Expiry:** 7 days
- **Token Format:** Bearer token in Authorization header

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Login: 5 attempts per 15 minutes
- Registration: 3 attempts per hour
- Token refresh: 10 attempts per 15 minutes
- Email checks: 20 checks per 15 minutes
- Password validation: 20 validations per 15 minutes

---

## Security Features

- Password hashing using bcrypt
- JWT-based authentication
- Refresh token rotation
- Rate limiting
- Input validation and sanitization
- CORS protection
- Helmet security headers

---

## Testing

You can test the API using the provided seed data:

**Admin User:**
- Email: `admin@qhealth.com`
- Password: `admin123`

**Doctor User:**
- Email: `dr.smith@qhealth.com`
- Password: `doctor123`

**Patient User:**
- Email: `patient.anderson@email.com`
- Password: `patient123`

---

## Support

For API support and questions, please refer to the main project documentation or contact the development team.
