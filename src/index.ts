import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables first
dotenv.config();

// Import security configuration
import { securityConfig } from './config/security.config';

// Import modules
import { emailRoutes } from './modules/email/email.routes';
import authRoutes from './modules/auth/auth.routes';
import { medicalRecordsRoutes } from './modules/medical-records/medical-records.routes';
import { appointmentsRoutes } from './modules/appointments/appointments.routes';
import { consultationsRoutes } from './modules/consultations/consultations.routes';
import { prescriptionsRoutes } from './modules/prescriptions/prescriptions.routes';
import { diagnosesRoutes } from './modules/diagnoses/diagnoses.routes';
import { selfCheckRoutes } from './modules/self-check/self-check.routes';
import { organizationsRoutes } from './modules/organizations/organizations.routes';

// Import middleware
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler';
import { sanitizeInput, xssProtection, sqlInjectionProtection } from './utils/validation';
import { authenticateToken, requireAuth } from './shared/middleware/auth-middleware';

// Import types
import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const app = express();
const httpServer = http.createServer(app);

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

// Root endpoint for basic connectivity test
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'QHealth Backend API is running',
    timestamp: new Date().toISOString(),
    environment: securityConfig.environment,
    version: process.env.npm_package_version || '1.0.0',
  });
});

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
app.use('/api/medical-records', medicalRecordsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/consultations', consultationsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/diagnoses', diagnosesRoutes);
app.use('/api/self-check', selfCheckRoutes);
app.use('/api/organizations', organizationsRoutes);  

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

// --- Socket.IO signaling server (1:1 rooms) ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: securityConfig.cors.origin,
    credentials: securityConfig.cors.credentials,
    methods: securityConfig.cors.methods,
    allowedHeaders: securityConfig.cors.allowedHeaders,
  },
});

type JoinPayload = { roomId: string; userId?: string; role?: 'doctor' | 'patient' };
type SignalPayload = { roomId: string; sdp?: any; candidate?: any };

const getRoomSize = (roomId: string): number => {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
};

// Track roles per room: ensures exactly one doctor and one patient
const roomRoles = new Map<string, { doctor?: string; patient?: string }>();

// Validate JWT from Socket.IO handshake and attach user info
io.use((socket, next) => {
  console.log('🔐 Socket.IO handshake attempt from:', socket.handshake.address);
  console.log('🔧 JWT_SECRET available:', !!process.env.JWT_SECRET);
  console.log('🔧 JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
  
  try {
    const tokenRaw = (socket.handshake.auth && (socket.handshake.auth as any).token) as string | undefined;
    console.log('🔑 Token received:', tokenRaw ? 'Yes' : 'No');
    console.log('🔑 Token preview:', tokenRaw ? `${tokenRaw.substring(0, 20)}...` : 'None');
    
    if (!tokenRaw) {
      console.log('❌ No token provided');
      return next(new Error('UNAUTHORIZED'));
    }
    
    // Remove 'Bearer ' prefix if present
    const token = tokenRaw.startsWith('Bearer ') ? tokenRaw.split(' ')[1] : tokenRaw;
    console.log('🔑 Cleaned token preview:', `${token.substring(0, 20)}...`);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number; role: Role };
    console.log('✅ JWT verified for user:', decoded.userId, 'role:', decoded.role);
    
    socket.data.userId = decoded.userId;
    socket.data.userRole = decoded.role;
    
    return next();
  } catch (err: any) {
    console.error('❌ JWT verification failed:', err);
    console.error('❌ Error details:', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack
    });
    return next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  // Join room (limit 2 participants)
  socket.on('webrtc:join', (payload: JoinPayload, ack?: Function) => {
    console.log('🚪 Join request from socket:', socket.id, 'payload:', payload);
    const roomId = payload?.roomId;
    if (!roomId) {
      console.log('❌ No room ID provided');
      if (ack) ack({ ok: false, error: 'ROOM_ID_REQUIRED' });
      return;
    }
    // Derive role from JWT (doctor/patient only)
    const userRole: Role | undefined = socket.data?.userRole as Role | undefined;
    console.log('👤 User role from JWT:', userRole);
    let role: 'doctor' | 'patient' | undefined;
    if (userRole === 'DOCTOR') role = 'doctor';
    if (userRole === 'PATIENT') role = 'patient';
    if (!role) {
      console.log('❌ Role not allowed:', userRole);
      if (ack) ack({ ok: false, error: 'ROLE_NOT_ALLOWED' });
      return;
    }
    const currentSize = getRoomSize(roomId);
    console.log('📊 Room size:', currentSize, 'for room:', roomId);
    if (currentSize >= 2) {
      console.log('❌ Room is full');
      if (ack) ack({ ok: false, error: 'ROOM_FULL' });
      return;
    }
    const roles = roomRoles.get(roomId) || {};
    console.log('🎭 Current roles in room:', roles);
    if (roles[role]) {
      console.log('❌ Role already taken:', role);
      if (ack) ack({ ok: false, error: 'ROLE_TAKEN' });
      return;
    }
    // Assign role and join
    roles[role] = socket.id;
    roomRoles.set(roomId, roles);
    socket.data.role = role;
    socket.data.roomId = roomId;
    socket.join(roomId);
    const newSize = currentSize + 1;
    console.log('✅ User joined room:', roomId, 'as', role, 'new size:', newSize);
    socket.to(roomId).emit('webrtc:peer-joined', { socketId: socket.id, role });
    if (ack) ack({ ok: true, participants: newSize, role });
  });

  // Offer/Answer exchange
  socket.on('webrtc:offer', (payload: SignalPayload) => {
    if (!payload?.roomId || !payload?.sdp) return;
    socket.to(payload.roomId).emit('webrtc:offer', { from: socket.id, sdp: payload.sdp });
  });

  socket.on('webrtc:answer', (payload: SignalPayload) => {
    if (!payload?.roomId || !payload?.sdp) return;
    socket.to(payload.roomId).emit('webrtc:answer', { from: socket.id, sdp: payload.sdp });
  });

  // ICE candidates
  socket.on('webrtc:ice-candidate', (payload: SignalPayload) => {
    if (!payload?.roomId || !payload?.candidate) return;
    socket.to(payload.roomId).emit('webrtc:ice-candidate', { from: socket.id, candidate: payload.candidate });
  });

  // Leave room
  socket.on('webrtc:leave', (payload: { roomId: string }) => {
    const roomId = payload?.roomId;
    if (!roomId) return;
    const roles = roomRoles.get(roomId);
    if (roles) {
      if (roles.doctor === socket.id) roles.doctor = undefined;
      if (roles.patient === socket.id) roles.patient = undefined;
      if (!roles.doctor && !roles.patient) roomRoles.delete(roomId); else roomRoles.set(roomId, roles);
    }
    socket.leave(roomId);
    socket.to(roomId).emit('webrtc:peer-left', { socketId: socket.id });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const roomId: string | undefined = socket.data?.roomId;
    if (roomId) {
      const roles = roomRoles.get(roomId);
      if (roles) {
        if (roles.doctor === socket.id) roles.doctor = undefined;
        if (roles.patient === socket.id) roles.patient = undefined;
        if (!roles.doctor && !roles.patient) roomRoles.delete(roomId); else roomRoles.set(roomId, roles);
      }
      socket.to(roomId).emit('webrtc:peer-left', { socketId: socket.id });
    }
  });
});

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

// Log environment information
console.log('🔧 Environment Variables:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   Using PORT:', PORT);
console.log('   PWD:', process.cwd());
console.log('   Files in current directory:', fs.readdirSync('.'));

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server bound to port ${PORT}`);
  console.log(`📊 Environment: ${securityConfig.environment}`);
  console.log(`🛡️ Security features enabled:`);
  console.log(`   - CORS: ${securityConfig.cors.origin.length > 0 ? 'Yes' : 'No'}`);
  console.log(`   - Rate Limiting: ${securityConfig.rateLimit.max} requests per ${securityConfig.rateLimit.windowMs / 60000} minutes`);
  console.log(`   - Password Policy: Min ${securityConfig.password.minLength} chars`);
  console.log(`   - JWT Expiration: ${securityConfig.jwt.accessToken.expiresIn}`);
  console.log(`   - Session Timeout: ${securityConfig.session.inactivityTimeout / 60000} minutes`);
});

// Add error handling for the server
httpServer.on('error', (error: any) => {
  console.error('🚨 Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`❌ Permission denied to bind to port ${PORT}`);
  }
  process.exit(1);
});
