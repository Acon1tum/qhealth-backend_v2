import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { IJWTPayload, IUserProfile, Role, IApiResponse } from '../../types';

const prisma = new PrismaClient();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUserProfile;
      token?: string;
    }
  }
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      const response: IApiResponse = {
        success: false,
        message: 'Access token is required',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IJWTPayload;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        doctorInfo: true,
        patientInfo: true,
        doctorCategories: true,
      },
    });

    if (!user) {
      const response: IApiResponse = {
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
    req.user = user as IUserProfile;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      const response: IApiResponse = {
        success: false,
        message: 'Invalid or expired token',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
    } else if (error instanceof jwt.TokenExpiredError) {
      const response: IApiResponse = {
        success: false,
        message: 'Token has expired',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
    } else {
      const response: IApiResponse = {
        success: false,
        message: 'Authentication failed',
        error: 'INTERNAL_SERVER_ERROR',
      };
      res.status(500).json(response);
    }
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: IApiResponse = {
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const response: IApiResponse = {
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

/**
 * Require admin role
 */
export const requireAdmin = requireRole([Role.SUPER_ADMIN, Role.ADMIN]);

/**
 * Require doctor role
 */
export const requireDoctor = requireRole([Role.DOCTOR]);

/**
 * Require patient role
 */
export const requirePatient = requireRole([Role.PATIENT]);

/**
 * Require doctor or admin role
 */
export const requireDoctorOrAdmin = requireRole([Role.SUPER_ADMIN, Role.DOCTOR, Role.ADMIN]);

/**
 * Require patient or admin role
 */
export const requirePatientOrAdmin = requireRole([Role.SUPER_ADMIN, Role.PATIENT, Role.ADMIN]);

/**
 * Require any authenticated user
 */
export const requireAuth = requireRole([Role.SUPER_ADMIN, Role.ADMIN, Role.DOCTOR, Role.PATIENT]);

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IJWTPayload;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          doctorInfo: true,
          patientInfo: true,
          doctorCategories: true,
        },
      });

      if (user) {
        req.user = user as IUserProfile;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Check if user owns the resource or is admin
 */
export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: IApiResponse = {
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED',
      };
      res.status(401).json(response);
      return;
    }

    // Admin and Super Admin can access any resource
    if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) {
      next();
      return;
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      const response: IApiResponse = {
        success: false,
        message: 'Resource user ID not found',
        error: 'BAD_REQUEST',
      };
      res.status(400).json(response);
      return;
    }

    if (resourceUserId !== req.user.id) {
      const response: IApiResponse = {
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

/**
 * Check if user can access patient data (doctor or patient themselves)
 */
export const requirePatientAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    const response: IApiResponse = {
      success: false,
      message: 'Authentication required',
      error: 'UNAUTHORIZED',
    };
    res.status(401).json(response);
    return;
  }

  const patientId = req.params.patientId || req.body.patientId;
  
  if (!patientId) {
    const response: IApiResponse = {
      success: false,
      message: 'Patient ID not found',
      error: 'BAD_REQUEST',
    };
    res.status(400).json(response);
    return;
  }

  // Admin and Super Admin can access any patient data
  if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) {
    next();
    return;
  }

  // Doctor can access patient data
  if (req.user.role === Role.DOCTOR) {
    next();
    return;
  }

  // Patient can only access their own data
  if (req.user.role === Role.PATIENT && patientId === req.user.id) {
    next();
    return;
  }

  const response: IApiResponse = {
    success: false,
    message: 'Access denied to patient data',
    error: 'FORBIDDEN',
  };
  res.status(403).json(response);
};

/**
 * Rate limiting middleware (basic implementation)
 */
export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    const userRequests = requests.get(ip);
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      const response: IApiResponse = {
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

/**
 * Log authentication attempts
 */
export const logAuthAttempt = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  console.log(`Auth attempt from ${ip} - User-Agent: ${userAgent}`);
  
  next();
};
