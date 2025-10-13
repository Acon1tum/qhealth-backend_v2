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
exports.SelfCheckController = void 0;
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const notification_service_1 = require("../notifications/notification.service");
const prisma = new client_1.PrismaClient();
class SelfCheckController {
    // Test database connection
    testDatabaseConnection(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                console.log('🔍 Testing database connection...');
                // Test basic database connection
                const userCount = yield prisma.user.count();
                const healthScanCount = yield prisma.healthScan.count();
                const consultationCount = yield prisma.consultation.count();
                console.log('✅ Database connection successful. User count:', userCount);
                console.log('✅ Health scan count:', healthScanCount);
                console.log('✅ Consultation count:', consultationCount);
                yield audit_service_1.AuditService.logDataAccess('TEST_DATABASE_CONNECTION', ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system', 'SYSTEM', 'database_connection', req.ip || 'unknown', req.get('User-Agent') || 'unknown', { userCount, healthScanCount, consultationCount, auditDescription: 'Database connectivity test successful' });
                res.json({
                    success: true,
                    message: 'Database connection successful',
                    data: {
                        userCount,
                        healthScanCount,
                        consultationCount,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            catch (error) {
                console.error('❌ Database connection failed:', error);
                try {
                    yield audit_service_1.AuditService.logSecurityEvent('DATABASE_CONNECTION_FAILED', client_1.AuditLevel.ERROR, `Database connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'system', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {});
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Database connection failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Save self-check health scan results to user profile
    saveSelfCheckResults(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { healthData, scanResults, scanType, timestamp } = req.body;
                const userId = req.user.id;
                const userRole = req.user.role;
                // Enhanced debug logging
                console.log('🔍 ===== FACE SCAN SAVE REQUEST =====');
                console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
                console.log('🔍 User ID:', userId);
                console.log('🔍 User Role:', userRole);
                console.log('🔍 Health data:', JSON.stringify(healthData, null, 2));
                console.log('🔍 Health data keys:', Object.keys(healthData || {}));
                console.log('🔍 Health data values:', Object.values(healthData || {}));
                console.log('🔍 Scan results:', JSON.stringify(scanResults, null, 2));
                console.log('🔍 Scan results count:', scanResults ? scanResults.length : 'undefined');
                console.log('🔍 Scan type:', scanType);
                console.log('🔍 Timestamp:', timestamp);
                // Verify user is a patient
                if (userRole !== client_1.Role.PATIENT) {
                    yield audit_service_1.AuditService.logSecurityEvent('UNAUTHORIZED_SELF_CHECK_SAVE', client_1.AuditLevel.WARNING, 'Non-patient attempted to save self-check results', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { userRole });
                    return res.status(403).json({
                        success: false,
                        message: 'Only patients can save self-check results'
                    });
                }
                // Validate required data
                if (!healthData || Object.keys(healthData).length === 0) {
                    console.error('❌ No health data provided');
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_MISSING_HEALTH_DATA', client_1.AuditLevel.WARNING, 'Health data missing in self-check save', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {});
                    return res.status(400).json({
                        success: false,
                        message: 'Health data is required'
                    });
                }
                if (!scanResults || scanResults.length === 0) {
                    console.error('❌ No scan results provided');
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_MISSING_SCAN_RESULTS', client_1.AuditLevel.WARNING, 'Scan results missing in self-check save', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {});
                    return res.status(400).json({
                        success: false,
                        message: 'Scan results are required'
                    });
                }
                // Create a self-check consultation record
                const consultationCode = this.generateSelfCheckCode(userId);
                console.log('🔍 Generated consultation code:', consultationCode);
                console.log('🔍 Creating consultation record...');
                const consultation = yield prisma.consultation.create({
                    data: {
                        doctorId: userId, // For self-check, the patient is both doctor and patient
                        patientId: userId,
                        startTime: new Date(timestamp || new Date()),
                        endTime: new Date(timestamp || new Date()),
                        consultationCode,
                        isPublic: false, // Self-check results are private by default
                        notes: 'Self-check health scan performed by patient',
                        diagnosis: 'Self-check health assessment',
                        treatment: 'Continue monitoring health metrics',
                        followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                    }
                });
                console.log('✅ Consultation created with ID:', consultation.id);
                // Create health scan record
                console.log('🔍 Creating health scan record...');
                const healthScanData = {
                    consultationId: consultation.id,
                    // Map the health data to the schema fields
                    bloodPressure: healthData.bloodPressure || null,
                    heartRate: healthData.heartRate || null,
                    spO2: healthData.spO2 || null,
                    respiratoryRate: healthData.respiratoryRate || null,
                    stressLevel: healthData.stressLevel || null,
                    stressScore: healthData.stressScore || null,
                    hrvSdnn: healthData.hrvSdnn || null,
                    hrvRmsdd: healthData.hrvRmsdd || null,
                    generalWellness: healthData.generalWellness || null,
                    // Health Risk Assessment
                    generalRisk: healthData.generalRisk || null,
                    coronaryHeartDisease: healthData.coronaryHeartDisease || null,
                    congestiveHeartFailure: healthData.congestiveHeartFailure || null,
                    intermittentClaudication: healthData.intermittentClaudication || null,
                    strokeRisk: healthData.strokeRisk || null,
                    // COVID-19 Risk
                    covidRisk: healthData.covidRisk || null,
                    // Additional health parameters (if available)
                    height: healthData.height || null,
                    weight: healthData.weight || null,
                    smoker: healthData.smoker || null,
                    hypertension: healthData.hypertension || null,
                    bpMedication: healthData.bpMedication || null,
                    diabetic: healthData.diabetic || null,
                    waistCircumference: healthData.waistCircumference || null,
                    heartDisease: healthData.heartDisease || null,
                    depression: healthData.depression || null,
                    totalCholesterol: healthData.totalCholesterol || null,
                    hdl: healthData.hdl || null,
                    parentalHypertension: healthData.parentalHypertension || null,
                    physicalActivity: healthData.physicalActivity || null,
                    healthyDiet: healthData.healthyDiet || null,
                    antiHypertensive: healthData.antiHypertensive || null,
                    historyBloodGlucose: healthData.historyBloodGlucose || null,
                    historyFamilyDiabetes: healthData.historyFamilyDiabetes || null
                };
                console.log('🔍 Health scan data to be saved:', JSON.stringify(healthScanData, null, 2));
                const healthScan = yield prisma.healthScan.create({
                    data: healthScanData
                });
                console.log('✅ Health scan created with ID:', healthScan.id);
                // Create medical history record for the self-check
                const medicalHistory = yield prisma.patientMedicalHistory.create({
                    data: {
                        patientId: userId,
                        consultationId: consultation.id,
                        recordType: 'CONSULTATION_NOTES',
                        title: 'Self-Check Health Scan Results',
                        content: `Self-check health scan performed on ${new Date(timestamp || new Date()).toLocaleDateString()}. Results include: ${JSON.stringify(scanResults, null, 2)}`,
                        isPublic: false,
                        isSensitive: true,
                        createdBy: userId
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logDataModification('CREATE', userId, 'HEALTH_SCAN', healthScan.id.toString(), req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    consultationId: consultation.id,
                    healthScanId: healthScan.id,
                    isSelfCheck: true,
                    metricsIncluded: Object.keys(healthData || {}),
                    scanType,
                    auditDescription: `Self-check results saved by user ${userId}`
                });
                // Send notification to patient
                yield notification_service_1.NotificationService.notifyHealthScanCompleted(consultation.id, userId, userId // For self-check, doctor and patient are the same
                );
                const responseData = {
                    success: true,
                    message: 'Self-check results saved successfully',
                    data: {
                        consultationId: consultation.id,
                        healthScanId: healthScan.id,
                        medicalHistoryId: medicalHistory.id,
                        consultationCode: consultation.consultationCode,
                        timestamp: new Date(timestamp || new Date())
                    }
                };
                console.log('✅ ===== SUCCESS RESPONSE =====');
                console.log('✅ Response data:', JSON.stringify(responseData, null, 2));
                res.status(201).json(responseData);
            }
            catch (error) {
                console.error('❌ ===== ERROR SAVING FACE SCAN RESULTS =====');
                console.error('❌ Error details:', error);
                console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
                console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                try {
                    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'unknown';
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_SAVE_FAILED', client_1.AuditLevel.ERROR, `Failed to save self-check results: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { bodyKeys: Object.keys(req.body || {}) });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to save self-check results',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get user's self-check history
    getSelfCheckHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                // Verify user is a patient
                if (userRole !== client_1.Role.PATIENT) {
                    return res.status(403).json({
                        success: false,
                        message: 'Only patients can view self-check history'
                    });
                }
                // Get self-check consultations (where doctorId = patientId = userId)
                const selfCheckHistory = yield prisma.consultation.findMany({
                    where: {
                        doctorId: userId,
                        patientId: userId,
                        notes: {
                            contains: 'Self-check health scan'
                        }
                    },
                    include: {
                        healthScan: true,
                        medicalHistory: {
                            where: {
                                recordType: 'CONSULTATION_NOTES',
                                title: {
                                    contains: 'Self-Check Health Scan Results'
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                });
                yield audit_service_1.AuditService.logDataAccess('VIEW_SELF_CHECK_HISTORY', userId, 'HEALTH_SCAN', 'self_check_history', req.ip || 'unknown', req.get('User-Agent') || 'unknown', { totalCount: selfCheckHistory.length, auditDescription: `Self-check history viewed by user ${userId}` });
                res.json({
                    success: true,
                    data: {
                        selfCheckHistory,
                        totalCount: selfCheckHistory.length
                    }
                });
            }
            catch (error) {
                console.error('Error fetching self-check history:', error);
                try {
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_HISTORY_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch self-check history: ${error instanceof Error ? error.message : 'Unknown error'}`, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'unknown', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {});
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch self-check history',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get specific self-check result
    getSelfCheckResult(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { consultationId } = req.params;
                const userId = req.user.id;
                const userRole = req.user.role;
                // Verify user is a patient
                if (userRole !== client_1.Role.PATIENT) {
                    yield audit_service_1.AuditService.logSecurityEvent('UNAUTHORIZED_SELF_CHECK_VIEW', client_1.AuditLevel.WARNING, 'Non-patient attempted to view self-check result', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId });
                    return res.status(403).json({
                        success: false,
                        message: 'Only patients can view self-check results'
                    });
                }
                // Get self-check consultation
                const selfCheckResult = yield prisma.consultation.findFirst({
                    where: {
                        id: consultationId,
                        doctorId: userId,
                        patientId: userId,
                        notes: {
                            contains: 'Self-check health scan'
                        }
                    },
                    include: {
                        healthScan: true,
                        medicalHistory: {
                            where: {
                                recordType: 'CONSULTATION_NOTES',
                                title: {
                                    contains: 'Self-Check Health Scan Results'
                                }
                            }
                        }
                    }
                });
                if (!selfCheckResult) {
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_RESULT_NOT_FOUND', client_1.AuditLevel.WARNING, 'Self-check result not found or no permission', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId });
                    return res.status(404).json({
                        success: false,
                        message: 'Self-check result not found or you do not have permission to view it'
                    });
                }
                yield audit_service_1.AuditService.logDataAccess('VIEW_SELF_CHECK_RESULT', userId, 'HEALTH_SCAN', consultationId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId, auditDescription: `Self-check result viewed by user ${userId}` });
                res.json({
                    success: true,
                    data: selfCheckResult
                });
            }
            catch (error) {
                console.error('Error fetching self-check result:', error);
                try {
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_RESULT_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch self-check result: ${error instanceof Error ? error.message : 'Unknown error'}`, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'unknown', req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId: (_b = req.params) === null || _b === void 0 ? void 0 : _b.consultationId });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch self-check result',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Delete self-check result
    deleteSelfCheckResult(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { consultationId } = req.params;
                const userId = req.user.id;
                const userRole = req.user.role;
                // Verify user is a patient
                if (userRole !== client_1.Role.PATIENT) {
                    yield audit_service_1.AuditService.logSecurityEvent('UNAUTHORIZED_SELF_CHECK_DELETE', client_1.AuditLevel.WARNING, 'Non-patient attempted to delete self-check result', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId });
                    return res.status(403).json({
                        success: false,
                        message: 'Only patients can delete self-check results'
                    });
                }
                // Get self-check consultation
                const selfCheckResult = yield prisma.consultation.findFirst({
                    where: {
                        id: consultationId,
                        doctorId: userId,
                        patientId: userId,
                        notes: {
                            contains: 'Self-check health scan'
                        }
                    }
                });
                if (!selfCheckResult) {
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_RESULT_DELETE_NOT_FOUND', client_1.AuditLevel.WARNING, 'Self-check result not found or no permission for deletion', userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId });
                    return res.status(404).json({
                        success: false,
                        message: 'Self-check result not found or you do not have permission to delete it'
                    });
                }
                // Delete related records (cascade will handle health scan and medical history)
                yield prisma.consultation.delete({
                    where: {
                        id: consultationId
                    }
                });
                // Audit log
                yield audit_service_1.AuditService.logDataModification('DELETE', userId, 'HEALTH_SCAN', consultationId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId, deletedBy: userId, isSelfCheck: true, auditDescription: `Self-check result ${consultationId} deleted by user ${userId}` });
                res.json({
                    success: true,
                    message: 'Self-check result deleted successfully'
                });
            }
            catch (error) {
                console.error('Error deleting self-check result:', error);
                try {
                    yield audit_service_1.AuditService.logSecurityEvent('SELF_CHECK_RESULT_DELETE_FAILED', client_1.AuditLevel.ERROR, `Failed to delete self-check result: ${error instanceof Error ? error.message : 'Unknown error'}`, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'unknown', req.ip || 'unknown', req.get('User-Agent') || 'unknown', { consultationId: (_b = req.params) === null || _b === void 0 ? void 0 : _b.consultationId });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete self-check result',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Private method to generate a unique self-check consultation code
    generateSelfCheckCode(userId) {
        // Create a 9-character code: SC + 2 digits from user ID + 2 digits from date + 3 random chars
        const userSuffix = (userId % 100).toString().padStart(2, '0');
        const date = new Date();
        const daySuffix = date.getDate().toString().padStart(2, '0');
        const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
        const consultationCode = `SC${userSuffix}${daySuffix}${randomChars}`;
        return consultationCode;
    }
}
exports.SelfCheckController = SelfCheckController;
