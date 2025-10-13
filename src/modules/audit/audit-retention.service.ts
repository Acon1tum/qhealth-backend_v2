import { PrismaClient, AuditCategory } from '@prisma/client';

const prisma = new PrismaClient();

export interface RetentionPolicy {
  category: AuditCategory;
  retentionDays: number;
  description: string;
}

export class AuditRetentionService {
  /**
   * Default retention policies based on compliance requirements
   */
  static readonly RETENTION_POLICIES: RetentionPolicy[] = [
    {
      category: AuditCategory.SECURITY,
      retentionDays: 2555, // 7 years (compliance requirement)
      description: 'Security events - HIPAA compliance requires 7 years'
    },
    {
      category: AuditCategory.AUTHENTICATION,
      retentionDays: 730, // 2 years
      description: 'Authentication events - track access patterns'
    },
    {
      category: AuditCategory.DATA_MODIFICATION,
      retentionDays: 1825, // 5 years
      description: 'Data modification events - critical for audit trails'
    },
    {
      category: AuditCategory.DATA_ACCESS,
      retentionDays: 365, // 1 year (most common, least critical)
      description: 'Data access events - routine monitoring'
    },
    {
      category: AuditCategory.SYSTEM,
      retentionDays: 180, // 6 months
      description: 'System events - operational monitoring'
    },
    {
      category: AuditCategory.USER_ACTIVITY,
      retentionDays: 365, // 1 year
      description: 'User activity events - behavioral analysis'
    }
  ];

  /**
   * Clean up expired audit logs based on retention policies
   */
  static async cleanupExpiredLogs(): Promise<{
    deletedLogs: number;
    deletedSecurityEvents: number;
    categoriesProcessed: string[];
  }> {
    const results = {
      deletedLogs: 0,
      deletedSecurityEvents: 0,
      categoriesProcessed: [] as string[]
    };

    try {
      console.log('🧹 Starting audit log cleanup...');

      for (const policy of this.RETENTION_POLICIES) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        console.log(`📅 Processing ${policy.category}: keeping ${policy.retentionDays} days (before ${cutoffDate.toISOString()})`);

        // Delete expired audit logs for this category
        const deletedAuditLogs = await prisma.auditLog.deleteMany({
          where: {
            category: policy.category,
            timestamp: {
              lt: cutoffDate
            }
          }
        });

        results.deletedLogs += deletedAuditLogs.count;
        results.categoriesProcessed.push(policy.category);

        console.log(`   ✅ Deleted ${deletedAuditLogs.count} ${policy.category} audit logs`);
      }

      // Clean up old security events (keep for 2 years)
      const securityEventsCutoff = new Date();
      securityEventsCutoff.setDate(securityEventsCutoff.getDate() - 730); // 2 years

      const deletedSecurityEvents = await prisma.securityEvent.deleteMany({
        where: {
          timestamp: {
            lt: securityEventsCutoff
          }
        }
      });

      results.deletedSecurityEvents = deletedSecurityEvents.count;
      console.log(`   ✅ Deleted ${deletedSecurityEvents.count} old security events`);

      console.log(`🎉 Cleanup completed: ${results.deletedLogs} audit logs, ${results.deletedSecurityEvents} security events deleted`);

      return results;
    } catch (error) {
      console.error('❌ Error during audit log cleanup:', error);
      throw error;
    }
  }

  /**
   * Archive old logs to a separate archive table (future implementation)
   */
  static async archiveOldLogs(archiveBeforeDays: number = 365): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveBeforeDays);

    console.log(`📦 Archiving logs older than ${archiveBeforeDays} days (before ${cutoffDate.toISOString()})`);

    // This would implement archiving logic
    // For now, we'll just log what would be archived
    const logsToArchive = await prisma.auditLog.count({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    console.log(`📊 Found ${logsToArchive} logs eligible for archiving`);
    
    // TODO: Implement actual archiving logic
    // 1. Create archive tables
    // 2. Move data to archive tables
    // 3. Compress archived data
    // 4. Delete from main tables
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<{
    totalLogs: number;
    totalSecurityEvents: number;
    storageByCategory: { [key: string]: number };
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    estimatedSizeMB: number;
  }> {
    const totalLogs = await prisma.auditLog.count();
    const totalSecurityEvents = await prisma.securityEvent.count();

    // Get category distribution
    const categoryStats = await prisma.auditLog.groupBy({
      by: ['category'],
      _count: {
        id: true
      }
    });

    const storageByCategory: { [key: string]: number } = {};
    categoryStats.forEach(stat => {
      storageByCategory[stat.category] = stat._count.id;
    });

    // Get date range
    const dateRange = await prisma.auditLog.aggregate({
      _min: {
        timestamp: true
      },
      _max: {
        timestamp: true
      }
    });

    // Estimate storage size (assuming ~533 bytes per log)
    const estimatedSizeMB = (totalLogs * 533) / (1024 * 1024);

    return {
      totalLogs,
      totalSecurityEvents,
      storageByCategory,
      oldestLogDate: dateRange._min.timestamp,
      newestLogDate: dateRange._max.timestamp,
      estimatedSizeMB
    };
  }

  /**
   * Get retention policy recommendations
   */
  static getRetentionRecommendations(): {
    currentPolicies: RetentionPolicy[];
    recommendations: string[];
  } {
    return {
      currentPolicies: this.RETENTION_POLICIES,
      recommendations: [
        'Implement automated daily cleanup job',
        'Set up database partitioning by date for better performance',
        'Consider archiving very old data to cold storage',
        'Monitor storage growth and adjust retention policies as needed',
        'Implement compression for details JSON fields',
        'Create separate indexes for frequently queried date ranges'
      ]
    };
  }
}
