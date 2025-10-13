# Notification System Documentation

## Overview
The notification system provides a comprehensive way to track and notify users about important events in the QHealth application.

## Features
- ✅ Real-time notification creation
- ✅ Multiple notification types (appointments, prescriptions, lab results, etc.)
- ✅ Priority levels (LOW, NORMAL, HIGH, URGENT)
- ✅ Read/unread tracking
- ✅ Archive functionality
- ✅ Bulk operations
- ✅ Pagination support
- ✅ Filtering by type, priority, read status

## Database Migration

Before using the notification system, run the Prisma migration:

```bash
# Generate Prisma client with new Notification model
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_notifications

# Or for production
npx prisma migrate deploy
```

## API Endpoints

### Get All Notifications
```
GET /api/notifications?isRead=false&limit=50&offset=0
Authorization: Bearer <token>
```

### Get Unread Count
```
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

### Get Single Notification
```
GET /api/notifications/:id
Authorization: Bearer <token>
```

### Mark as Read
```
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```
PATCH /api/notifications/mark-all-read
Authorization: Bearer <token>
```

### Archive Notification
```
PATCH /api/notifications/:id/archive
Authorization: Bearer <token>
```

### Delete Notification
```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

### Delete All Read Notifications
```
DELETE /api/notifications/delete-all-read
Authorization: Bearer <token>
```

### Create Test Notification
```
POST /api/notifications/test
Authorization: Bearer <token>
Body: {
  "title": "Test Notification",
  "message": "This is a test message",
  "type": "GENERAL",
  "priority": "NORMAL"
}
```

## Using the Notification Service

### Import the Service
```typescript
import { NotificationService } from '../notifications/notification.service';
```

### Example: Notify on Appointment Creation
```typescript
// In appointments.controller.ts
const appointment = await prisma.appointmentRequest.create({
  data: { ... }
});

// Create notifications for both doctor and patient
await NotificationService.notifyAppointmentCreated(
  appointment.id,
  appointment.doctorId,
  appointment.patientId,
  appointment.requestedDate,
  appointment.requestedTime
);
```

### Example: Notify on Prescription Issued
```typescript
// In prescriptions.controller.ts
const prescription = await prisma.prescription.create({
  data: { ... }
});

await NotificationService.notifyPrescriptionIssued(
  prescription.id,
  prescription.patientId,
  prescription.doctorId,
  prescription.medicationName
);
```

### Example: Notify on Lab Results Available
```typescript
// In lab-requests.controller.ts
const labRequest = await prisma.labRequest.update({
  where: { id },
  data: { status: 'COMPLETED' }
});

await NotificationService.notifyLabResultsAvailable(
  labRequest.id,
  labRequest.patientId,
  labRequest.doctorId
);
```

### Example: Custom Notification
```typescript
await NotificationService.createNotification({
  userId: userId,
  type: NotificationType.GENERAL,
  title: 'Important Update',
  message: 'Your profile has been updated successfully',
  relatedId: userId,
  relatedType: 'PROFILE',
  actionUrl: '/my-profile',
  priority: NotificationPriority.NORMAL,
  metadata: { updatedFields: ['email', 'phone'] }
});
```

## Notification Types

Available notification types:
- `APPOINTMENT_CREATED` - New appointment request
- `APPOINTMENT_CONFIRMED` - Appointment confirmed
- `APPOINTMENT_CANCELLED` - Appointment cancelled
- `APPOINTMENT_REJECTED` - Appointment rejected
- `APPOINTMENT_RESCHEDULED` - Appointment rescheduled
- `APPOINTMENT_REMINDER` - Upcoming appointment reminder
- `CONSULTATION_STARTED` - Consultation started
- `CONSULTATION_ENDED` - Consultation ended
- `PRESCRIPTION_ISSUED` - New prescription
- `PRESCRIPTION_EXPIRING` - Prescription expiring soon
- `DIAGNOSIS_ADDED` - New diagnosis added
- `LAB_REQUEST_CREATED` - New lab request
- `LAB_RESULTS_AVAILABLE` - Lab results ready
- `MEDICAL_RECORD_SHARED` - Medical record shared
- `HEALTH_SCAN_COMPLETED` - Health scan completed
- `HEALTH_SCAN_SHARED` - Health scan shared
- `RESCHEDULE_REQUEST` - Reschedule request received
- `RESCHEDULE_APPROVED` - Reschedule approved
- `RESCHEDULE_REJECTED` - Reschedule rejected
- `SYSTEM_ANNOUNCEMENT` - System announcement
- `SECURITY_ALERT` - Security alert
- `PROFILE_UPDATE` - Profile updated
- `DOCUMENT_VERIFIED` - Document verified
- `DOCUMENT_REJECTED` - Document rejected
- `GENERAL` - General notification

## Priority Levels

- `LOW` - Low priority, can be checked later
- `NORMAL` - Normal priority (default)
- `HIGH` - High priority, requires attention soon
- `URGENT` - Urgent, requires immediate attention

## Integration Checklist

To integrate notifications into your module:

1. ✅ Import the NotificationService
2. ✅ Call appropriate notification methods after actions
3. ✅ Handle errors gracefully (notifications shouldn't break main flow)
4. ✅ Include relevant metadata for debugging
5. ✅ Set appropriate priority levels
6. ✅ Include actionUrl for frontend navigation

## Best Practices

1. **Don't block main operations**: Always handle notification creation in a try-catch or use async/await properly
2. **Include metadata**: Store useful data in the metadata field for debugging
3. **Set actionUrl**: Always include a URL where users can take action
4. **Use appropriate priorities**: 
   - URGENT: Medical emergencies, time-sensitive appointments
   - HIGH: Appointment confirmations, lab results
   - NORMAL: General updates, shared records
   - LOW: Reminders, system updates
5. **Clean up old notifications**: Implement a cron job to delete old notifications

## Future Enhancements

- [ ] Real-time push notifications via Socket.IO
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Scheduled notifications (cron jobs)
- [ ] Notification preferences per user
- [ ] Notification templates
- [ ] Notification grouping
- [ ] Rich media notifications (images, actions)

## Troubleshooting

### Notifications not appearing
1. Check if Prisma migration was run
2. Verify user authentication token is valid
3. Check notification creation logs in console
4. Verify userId exists in database

### Performance issues
1. Add proper indexes (already included in schema)
2. Implement pagination
3. Archive old notifications regularly
4. Consider caching unread counts

## Support

For issues or questions, contact the development team or create an issue in the repository.


