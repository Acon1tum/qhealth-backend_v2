import { Request, Response } from 'express';
import { PrismaClient, NotificationType, NotificationPriority } from '@prisma/client';
import { NotificationService } from './notification.service';

const prisma = new PrismaClient();

// Helper function to get Socket.IO instance
let ioInstance: any = null;
export function setIOInstance(io: any) {
  ioInstance = io;
}

export class NotificationsController {
  /**
   * Get all notifications for the authenticated user
   */
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { 
        isRead, 
        isArchived, 
        type, 
        priority,
        limit = 50,
        offset = 0 
      } = req.query;

      // Build filter object
      const where: any = { userId };

      if (isRead !== undefined) {
        where.isRead = isRead === 'true';
      }

      if (isArchived !== undefined) {
        where.isArchived = isArchived === 'true';
      }

      if (type) {
        where.type = type as NotificationType;
      }

      if (priority) {
        where.priority = priority as NotificationPriority;
      }

      // Get notifications with pagination
      const [notifications, total] = await Promise.all([
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
      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
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
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const notification = await prisma.notification.findFirst({
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
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error('Error fetching notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const count = await prisma.notification.count({
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
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Update notification
      const updated = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Emit real-time update
      if (ioInstance) {
        const userRoom = `user:${userId}`;
        const unreadCount = await prisma.notification.count({
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
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Update notification
      const updated = await prisma.notification.update({
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
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as unread',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const result = await prisma.notification.updateMany({
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
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Update notification
      const updated = await prisma.notification.update({
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
    } catch (error) {
      console.error('Error archiving notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to archive notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unarchive notification
   */
  async unarchiveNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Update notification
      const updated = await prisma.notification.update({
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
    } catch (error) {
      console.error('Error unarchiving notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unarchive notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Delete notification
      await prisma.notification.delete({
        where: { id },
      });

      // Emit real-time update
      if (ioInstance) {
        const userRoom = `user:${userId}`;
        const unreadCount = await prisma.notification.count({
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
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const result = await prisma.notification.deleteMany({
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
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete read notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create a test notification (for testing purposes)
   */
  async createTestNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { title, message, type, priority } = req.body;

      const notification = await NotificationService.createNotification({
        userId,
        type: type || NotificationType.GENERAL,
        title: title || 'Test Notification',
        message: message || 'This is a test notification',
        priority: priority || NotificationPriority.NORMAL,
      });

      return res.status(201).json({
        success: true,
        message: 'Test notification created',
        data: notification,
      });
    } catch (error) {
      console.error('Error creating test notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create test notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

