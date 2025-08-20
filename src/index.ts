import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import security configuration
import { securityConfig } from './config/security.config';

// Import modules
import { emailRoutes } from './modules/email/email.routes';
import authRoutes from './modules/auth/auth.routes';

// Import middleware
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler';
import { sanitizeInput, xssProtection, sqlInjectionProtection } from './utils/validation';
import { authenticateToken, requireAuth } from './shared/middleware/auth-middleware';

// Import types
import { Request, Response, NextFunction } from 'express';

dotenv.config();

const app = express();

// Trust proxy configuration for load balancers
if (securityConfig.trustProxy) {
  app.set('trust proxy', 1);
}

// Enhanced rate limiting with security configuration
const limiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.max,
  message: securityConfig.rateLimit.message,
  standardHeaders: securityConfig.rateLimit.standardHeaders,
  legacyHeaders: securityConfig.rateLimit.legacyHeaders,
  skipSuccessfulRequests: securityConfig.rateLimit.skipSuccessfulRequests,
  skipFailedRequests: securityConfig.rateLimit.skipFailedRequests,
  // Enhanced rate limiting for security
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IPv6-safe IP key generator
    const userId = (req as any).user?.id;
    if (userId) return String(userId);
    return ipKeyGenerator(req as any);
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(securityConfig.rateLimit.windowMs / 1000),
    });
  },
});

// Enhanced CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (securityConfig.cors.origin.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: securityConfig.cors.credentials,
  methods: securityConfig.cors.methods,
  allowedHeaders: securityConfig.cors.allowedHeaders,
  exposedHeaders: securityConfig.cors.exposedHeaders,
  maxAge: securityConfig.cors.maxAge,
};

// Enhanced Helmet configuration with security headers
const helmetConfig = {
  contentSecurityPolicy: securityConfig.headers.contentSecurityPolicy,
  hsts: securityConfig.headers.hsts,
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' as any },
  hidePoweredBy: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as any },
};

// Middleware stack
app.use(helmet(helmetConfig));
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);

// Security middleware
app.use(xssProtection);
app.use(sqlInjectionProtection);
app.use(sanitizeInput);

// Request size limits
app.use(express.json({ limit: securityConfig.requestLimits.json }));
app.use(express.urlencoded({ extended: true, limit: securityConfig.requestLimits.urlencoded }));

// Health check endpoint with security headers
app.get('/health', (req: Request, res: Response) => {
  // Set security headers for health check
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: securityConfig.environment,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Security status endpoint (for monitoring)
app.get('/security-status', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      environment: securityConfig.environment,
      securityFeatures: {
        cors: securityConfig.cors.origin.length > 0,
        rateLimiting: securityConfig.rateLimit.max > 0,
        passwordPolicy: securityConfig.password.minLength >= 8,
        jwtExpiration: securityConfig.jwt.accessToken.expiresIn,
        sessionTimeout: securityConfig.session.inactivityTimeout,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// Protected admin endpoint (demonstrates auth middleware)
app.get('/admin/security-audit', authenticateToken, requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Admin access granted',
    data: {
      user: (req as any).user,
      timestamp: new Date().toISOString(),
      securityLevel: 'admin',
    },
  });
});

// API Routes with security middleware
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);

// Serve static files with enhanced security
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res: any, filePath: string) => {
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
app.use((req: Request, res: Response, next: NextFunction) => notFoundHandler(req, res, next));

// Global error handler (must be last)
app.use(errorHandler);

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
  console.log(`📊 Environment: ${securityConfig.environment}`);
  console.log(`🛡️ Security features enabled:`);
  console.log(`   - CORS: ${securityConfig.cors.origin.length > 0 ? 'Yes' : 'No'}`);
  console.log(`   - Rate Limiting: ${securityConfig.rateLimit.max} requests per ${securityConfig.rateLimit.windowMs / 60000} minutes`);
  console.log(`   - Password Policy: Min ${securityConfig.password.minLength} chars`);
  console.log(`   - JWT Expiration: ${securityConfig.jwt.accessToken.expiresIn}`);
  console.log(`   - Session Timeout: ${securityConfig.session.inactivityTimeout / 60000} minutes`);
});
