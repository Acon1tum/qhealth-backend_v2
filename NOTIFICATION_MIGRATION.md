# Notification System Migration Guide

## Overview
This guide will help you set up and migrate the database to include the new notification system.

## Prerequisites
- PostgreSQL database running
- Node.js and npm/pnpm installed
- Prisma CLI installed

## Step-by-Step Migration

### 1. Generate Prisma Client
First, regenerate the Prisma client to include the new Notification model:

```bash
npx prisma generate
```

This will update the Prisma client with the new `Notification`, `NotificationType`, and `NotificationPriority` types.

### 2. Create Migration
Create a new migration for the notification system:

```bash
npx prisma migrate dev --name add_notification_system
```

This command will:
- Create a new migration file in `prisma/migrations/`
- Apply the migration to your development database
- Update the Prisma client

### 3. Verify Migration
Check that the migration was successful:

```bash
npx prisma migrate status
```

You should see the new `add_notification_system` migration as applied.

### 4. View Database Schema
You can view the database schema to confirm the `Notification` table was created:

```bash
npx prisma studio
```

This will open Prisma Studio in your browser where you can see the new `Notification` table.

## Production Deployment

For production environments:

### 1. Apply Migration
```bash
npx prisma migrate deploy
```

### 2. Verify
```bash
npx prisma migrate status
```

## Migration Contents

The migration will create:

### Notification Table
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key to User)
- `type` (Enum: NotificationType)
- `title` (String)
- `message` (String)
- `relatedId` (String, Nullable)
- `relatedType` (String, Nullable)
- `actionUrl` (String, Nullable)
- `isRead` (Boolean, Default: false)
- `isArchived` (Boolean, Default: false)
- `priority` (Enum: NotificationPriority, Default: NORMAL)
- `metadata` (JSON, Nullable)
- `readAt` (DateTime, Nullable)
- `createdAt` (DateTime, Default: now())
- `updatedAt` (DateTime, Auto-updated)
- `expiresAt` (DateTime, Nullable)

### Indexes Created
- `userId` - For fast user notification queries
- `isRead` - For filtering read/unread notifications
- `isArchived` - For filtering archived notifications
- `type` - For filtering by notification type
- `priority` - For filtering by priority
- `createdAt` - For sorting by date
- `userId, isRead` (Composite) - For optimized unread queries

### Enums Created
1. **NotificationType** (24 types):
   - APPOINTMENT_CREATED
   - APPOINTMENT_CONFIRMED
   - APPOINTMENT_CANCELLED
   - APPOINTMENT_REJECTED
   - APPOINTMENT_RESCHEDULED
   - APPOINTMENT_REMINDER
   - CONSULTATION_STARTED
   - CONSULTATION_ENDED
   - PRESCRIPTION_ISSUED
   - PRESCRIPTION_EXPIRING
   - DIAGNOSIS_ADDED
   - LAB_REQUEST_CREATED
   - LAB_RESULTS_AVAILABLE
   - MEDICAL_RECORD_SHARED
   - HEALTH_SCAN_COMPLETED
   - HEALTH_SCAN_SHARED
   - RESCHEDULE_REQUEST
   - RESCHEDULE_APPROVED
   - RESCHEDULE_REJECTED
   - SYSTEM_ANNOUNCEMENT
   - SECURITY_ALERT
   - PROFILE_UPDATE
   - DOCUMENT_VERIFIED
   - DOCUMENT_REJECTED
   - GENERAL

2. **NotificationPriority**:
   - LOW
   - NORMAL
   - HIGH
   - URGENT

## Rollback (If Needed)

If you need to rollback the migration:

### Development
```bash
npx prisma migrate reset
```
⚠️ **Warning**: This will delete all data in your database!

### Production
Manual rollback is required. Contact your database administrator.

## Post-Migration Steps

### 1. Restart Your Server
After migration, restart your Node.js server:

```bash
npm run dev
# or
pnpm dev
```

### 2. Test Notification Endpoints
Test the notification system using the test endpoint:

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "Testing the notification system",
    "type": "GENERAL",
    "priority": "NORMAL"
  }'
```

### 3. Verify Notification Retrieval
```bash
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Integration into Existing Modules

After migration, integrate notifications into your existing controllers. See:
- `src/modules/notifications/integration-example.ts` - Integration examples
- `src/modules/notifications/NOTIFICATIONS_README.md` - Full documentation

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution**: The table might already exist. Drop it manually or run:
```bash
npx prisma migrate reset
```

### Issue: Prisma client not updated
**Solution**: Regenerate the client:
```bash
npx prisma generate
```

### Issue: TypeScript errors about NotificationType
**Solution**: Restart your TypeScript server or IDE.

### Issue: Database connection error
**Solution**: Check your `DATABASE_URL` in `.env` file.

## Database Backup Recommendation

Before running migrations in production:

```bash
# PostgreSQL backup
pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql

# Restore if needed
psql -U username -d database_name < backup_20251010.sql
```

## Performance Considerations

The notification system includes optimized indexes, but consider:

1. **Regular Cleanup**: Implement a cron job to delete old notifications
2. **Archiving**: Archive old notifications instead of deleting
3. **Pagination**: Always use pagination for notification lists
4. **Caching**: Consider caching unread counts for better performance

## Support

For issues or questions:
1. Check Prisma logs: `npx prisma migrate status --verbose`
2. Review migration files in `prisma/migrations/`
3. Contact the development team

## Next Steps

1. ✅ Run migration
2. ✅ Test endpoints
3. ✅ Integrate into controllers
4. ✅ Set up frontend integration
5. ✅ Implement real-time updates (Socket.IO)
6. ✅ Set up cron jobs for reminders
7. ✅ Configure notification cleanup job

---

**Migration created on:** October 10, 2025  
**Version:** 1.0.0  
**Compatible with:** QHealth Backend v2.0+

