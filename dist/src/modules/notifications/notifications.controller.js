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
exports.NotificationsController = void 0;
exports.setIOInstance = setIOInstance;
const client_1 = require("@prisma/client");
const notification_service_1 = require("./notification.service");
const audit_service_1 = require("../audit/audit.service");
const prisma = new client_1.PrismaClient();
// Helper function to get Socket.IO instance
let ioInstance = null;
function setIOInstance(io) {
    ioInstance = io;
}
class NotificationsController {
    /**
     * Get all notifications for the authenticated user
     */
    getNotifications(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = req.user.id;
                const { isRead, isArchived, type, priority, limit = 50, offset = 0 } = req.query;
                // Build filter object
                const where = { userId };
                if (isRead !== undefined) {
                    where.isRead = isRead === 'true';
                }
                if (isArchived !== undefined) {
                    where.isArchived = isArchived === 'true';
                }
                if (type) {
                    where.type = type;
                }
                if (priority) {
                    where.priority = priority;
                }
                // Get notifications with pagination
                const [notifications, total] = yield Promise.all([
                    prisma.notification.findMany({
                        where,
                        orderBy: [
                            { priority: 'desc' },
                            { createdAt: 'desc' }
                        ],
                        take: Number(limit),
                        skip: Number(offset),
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    role: true,
                                },
                            },
                        },
                    }),
                    prisma.notification.count({ where }),
                ]);
                // Get unread count
                const unreadCount = yield prisma.notification.count({
                    where: {
                        userId,
                        isRead: false,
                        isArchived: false,
                    },
                });
                // Audit log for successful access
                yield audit_service_1.AuditService.logDataAccess('VIEW_NOTIFICATIONS', userId, 'NOTIFICATION', 'list', req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    totalNotifications: total,
                    unreadCount: unreadCount,
                    isRead: isRead,
                    isArchived: isArchived,
                    type: type,
                    priority: priority,
                    limit: Number(limit),
                    offset: Number(offset),
                    auditDescription: `Viewed ${total} notifications with ${unreadCount} unread`
                });
                return res.status(200).json({
                    success: true,
                    data: {
                        notifications,
                        pagination: {
                            total,
                            limit: Number(limit),
                            offset: Number(offset),
                            hasMore: Number(offset) + notifications.length < total,
                        },
                        unreadCount,
                    },
                });
            }
            catch (error) {
                console.error('Error fetching notifications:', error);
                // Audit log for failure
                try {
                    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                    yield audit_service_1.AuditService.logSecurityEvent('NOTIFICATIONS_FETCH_FAILED', client_1.AuditLevel.ERROR, `Failed to fetch notifications: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
                catch (auditError) {
                    console.error('Failed to log audit event:', auditError);
                }
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch notifications',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Get a single notification by ID
     */
    getNotificationById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const notification = yield prisma.notification.findFirst({
                    where: {
                        id,
                        userId, // Ensure user can only access their own notifications
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                });
                if (!notification) {
                    // Audit log for notification not found
                    yield audit_service_1.AuditService.logSecurityEvent('NOTIFICATION_NOT_FOUND', client_1.AuditLevel.WARNING, `Notification not found: ${id}`, userId, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                        notificationId: id,
                        requestedBy: userId
                    });
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Audit log for successful access
                yield audit_service_1.AuditService.logDataAccess('VIEW_NOTIFICATION', userId, 'NOTIFICATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    notificationId: id,
                    notificationType: notification.type,
                    notificationPriority: notification.priority,
                    isRead: notification.isRead,
                    isArchived: notification.isArchived,
                    auditDescription: `Viewed notification: ${notification.title}`
                });
                return res.status(200).json({
                    success: true,
                    data: notification,
                });
            }
            catch (error) {
                console.error('Error fetching notification:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch notification',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Get unread notification count
     */
    getUnreadCount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const count = yield prisma.notification.count({
                    where: {
                        userId,
                        isRead: false,
                        isArchived: false,
                    },
                });
                return res.status(200).json({
                    success: true,
                    data: { count },
                });
            }
            catch (error) {
                console.error('Error fetching unread count:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch unread count',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Mark notification as read
     */
    markAsRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                // Verify notification belongs to user
                const notification = yield prisma.notification.findFirst({
                    where: { id, userId },
                });
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Update notification
                const updated = yield prisma.notification.update({
                    where: { id },
                    data: {
                        isRead: true,
                        readAt: new Date(),
                    },
                });
                // Audit log for successful update
                yield audit_service_1.AuditService.logDataModification('UPDATE', userId, 'NOTIFICATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    notificationId: id,
                    oldIsRead: notification.isRead,
                    newIsRead: true,
                    readAt: new Date(),
                    notificationType: notification.type,
                    notificationTitle: notification.title,
                    auditDescription: `Notification marked as read: ${notification.title}`
                });
                // Emit real-time update
                if (ioInstance) {
                    const userRoom = `user:${userId}`;
                    const unreadCount = yield prisma.notification.count({
                        where: {
                            userId,
                            isRead: false,
                            isArchived: false,
                        },
                    });
                    ioInstance.to(userRoom).emit('notification:unread-count', { count: unreadCount });
                    ioInstance.to(userRoom).emit('notification:updated', updated);
                }
                return res.status(200).json({
                    success: true,
                    message: 'Notification marked as read',
                    data: updated,
                });
            }
            catch (error) {
                console.error('Error marking notification as read:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to mark notification as read',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Mark notification as unread
     */
    markAsUnread(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                // Verify notification belongs to user
                const notification = yield prisma.notification.findFirst({
                    where: { id, userId },
                });
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Update notification
                const updated = yield prisma.notification.update({
                    where: { id },
                    data: {
                        isRead: false,
                        readAt: null,
                    },
                });
                return res.status(200).json({
                    success: true,
                    message: 'Notification marked as unread',
                    data: updated,
                });
            }
            catch (error) {
                console.error('Error marking notification as unread:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to mark notification as unread',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Mark all notifications as read
     */
    markAllAsRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const result = yield prisma.notification.updateMany({
                    where: {
                        userId,
                        isRead: false,
                    },
                    data: {
                        isRead: true,
                        readAt: new Date(),
                    },
                });
                // Emit real-time update
                if (ioInstance) {
                    const userRoom = `user:${userId}`;
                    ioInstance.to(userRoom).emit('notification:unread-count', { count: 0 });
                    ioInstance.to(userRoom).emit('notification:refresh');
                }
                return res.status(200).json({
                    success: true,
                    message: `${result.count} notifications marked as read`,
                    data: { count: result.count },
                });
            }
            catch (error) {
                console.error('Error marking all notifications as read:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to mark all notifications as read',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Archive notification
     */
    archiveNotification(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                // Verify notification belongs to user
                const notification = yield prisma.notification.findFirst({
                    where: { id, userId },
                });
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Update notification
                const updated = yield prisma.notification.update({
                    where: { id },
                    data: {
                        isArchived: true,
                    },
                });
                return res.status(200).json({
                    success: true,
                    message: 'Notification archived',
                    data: updated,
                });
            }
            catch (error) {
                console.error('Error archiving notification:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to archive notification',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Unarchive notification
     */
    unarchiveNotification(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                // Verify notification belongs to user
                const notification = yield prisma.notification.findFirst({
                    where: { id, userId },
                });
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Update notification
                const updated = yield prisma.notification.update({
                    where: { id },
                    data: {
                        isArchived: false,
                    },
                });
                return res.status(200).json({
                    success: true,
                    message: 'Notification unarchived',
                    data: updated,
                });
            }
            catch (error) {
                console.error('Error unarchiving notification:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to unarchive notification',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Delete notification
     */
    deleteNotification(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                // Verify notification belongs to user
                const notification = yield prisma.notification.findFirst({
                    where: { id, userId },
                });
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found',
                    });
                }
                // Delete notification
                yield prisma.notification.delete({
                    where: { id },
                });
                // Audit log for successful deletion
                yield audit_service_1.AuditService.logDataModification('DELETE', userId, 'NOTIFICATION', id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    notificationId: id,
                    notificationType: notification.type,
                    notificationTitle: notification.title,
                    notificationPriority: notification.priority,
                    wasRead: notification.isRead,
                    wasArchived: notification.isArchived,
                    deletedAt: new Date(),
                    auditDescription: `Notification deleted: ${notification.title}`
                });
                // Emit real-time update
                if (ioInstance) {
                    const userRoom = `user:${userId}`;
                    const unreadCount = yield prisma.notification.count({
                        where: {
                            userId,
                            isRead: false,
                            isArchived: false,
                        },
                    });
                    ioInstance.to(userRoom).emit('notification:unread-count', { count: unreadCount });
                    ioInstance.to(userRoom).emit('notification:deleted', { id });
                }
                return res.status(200).json({
                    success: true,
                    message: 'Notification deleted',
                });
            }
            catch (error) {
                console.error('Error deleting notification:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to delete notification',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Delete all read notifications
     */
    deleteAllRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const result = yield prisma.notification.deleteMany({
                    where: {
                        userId,
                        isRead: true,
                    },
                });
                return res.status(200).json({
                    success: true,
                    message: `${result.count} notifications deleted`,
                    data: { count: result.count },
                });
            }
            catch (error) {
                console.error('Error deleting read notifications:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to delete read notifications',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Create a test notification (for testing purposes)
     */
    createTestNotification(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { title, message, type, priority } = req.body;
                const notification = yield notification_service_1.NotificationService.createNotification({
                    userId,
                    type: type || client_1.NotificationType.GENERAL,
                    title: title || 'Test Notification',
                    message: message || 'This is a test notification',
                    priority: priority || client_1.NotificationPriority.NORMAL,
                });
                // Audit log for successful creation
                yield audit_service_1.AuditService.logDataModification('CREATE', userId, 'NOTIFICATION', notification.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown', {
                    notificationId: notification.id,
                    notificationType: notification.type,
                    notificationTitle: notification.title,
                    notificationPriority: notification.priority,
                    isTestNotification: true,
                    auditDescription: `Test notification created: ${notification.title}`
                });
                return res.status(201).json({
                    success: true,
                    message: 'Test notification created',
                    data: notification,
                });
            }
            catch (error) {
                console.error('Error creating test notification:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create test notification',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
}
exports.NotificationsController = NotificationsController;
