"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRoutes = void 0;
const express_1 = require("express");
const notifications_controller_1 = require("./notifications.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const router = (0, express_1.Router)();
const controller = new notifications_controller_1.NotificationsController();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private
 * @query   isRead: boolean, isArchived: boolean, type: NotificationType, priority: NotificationPriority, limit: number, offset: number
 */
router.get('/', (req, res) => controller.getNotifications(req, res));
/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', (req, res) => controller.getUnreadCount(req, res));
/**
 * @route   GET /api/notifications/:id
 * @desc    Get a single notification by ID
 * @access  Private
 */
router.get('/:id', (req, res) => controller.getNotificationById(req, res));
/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', (req, res) => controller.markAsRead(req, res));
/**
 * @route   PATCH /api/notifications/:id/unread
 * @desc    Mark notification as unread
 * @access  Private
 */
router.patch('/:id/unread', (req, res) => controller.markAsUnread(req, res));
/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/mark-all-read', (req, res) => controller.markAllAsRead(req, res));
/**
 * @route   PATCH /api/notifications/:id/archive
 * @desc    Archive notification
 * @access  Private
 */
router.patch('/:id/archive', (req, res) => controller.archiveNotification(req, res));
/**
 * @route   PATCH /api/notifications/:id/unarchive
 * @desc    Unarchive notification
 * @access  Private
 */
router.patch('/:id/unarchive', (req, res) => controller.unarchiveNotification(req, res));
/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', (req, res) => controller.deleteNotification(req, res));
/**
 * @route   DELETE /api/notifications/delete-all-read
 * @desc    Delete all read notifications
 * @access  Private
 */
router.delete('/delete-all-read', (req, res) => controller.deleteAllRead(req, res));
/**
 * @route   POST /api/notifications/test
 * @desc    Create a test notification (for development/testing)
 * @access  Private
 */
router.post('/test', (req, res) => controller.createTestNotification(req, res));
exports.notificationsRoutes = router;
