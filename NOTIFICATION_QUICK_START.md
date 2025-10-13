# Notification System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Run Migration (1 minute)
```bash
cd qhealth-backend_v2
npx prisma generate
npx prisma migrate dev --name add_notification_system
```

### Step 2: Restart Server (1 minute)
```bash
npm run dev
# or
pnpm dev
```

### Step 3: Test It Works (1 minute)
```bash
# Login first to get your token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'

# Save the token from response, then test notifications
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "message": "It works!"}'

# Get your notifications
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

✅ **Done!** Notification system is now running.

---

## 📝 Quick Integration Guide

### Example 1: Notify on Appointment Creation

**File:** `src/modules/appointments/appointments.controller.ts`

```typescript
// Import at the top
import { NotificationService } from '../notifications/notification.service';

// In your createAppointmentRequest method, after creating the appointment:
const appointment = await prisma.appointmentRequest.create({
  data: { /* your data */ }
});

// Add these 3 lines:
NotificationService.notifyAppointmentCreated(
  appointment.id, appointment.doctorId, appointment.patientId,
  appointment.requestedDate, appointment.requestedTime
).catch(err => console.error('Notification error:', err));
```

### Example 2: Notify on Prescription Issued

**File:** `src/modules/prescriptions/prescriptions.controller.ts`

```typescript
import { NotificationService } from '../notifications/notification.service';

const prescription = await prisma.prescription.create({
  data: { /* your data */ }
});

// Add this:
NotificationService.notifyPrescriptionIssued(
  prescription.id, prescription.patientId, 
  prescription.doctorId, prescription.medicationName
).catch(err => console.error('Notification error:', err));
```

### Example 3: Notify on Lab Results Available

**File:** `src/modules/lab-requests/lab-requests.controller.ts`

```typescript
import { NotificationService } from '../notifications/notification.service';

const labRequest = await prisma.labRequest.update({
  where: { id },
  data: { status: 'COMPLETED' }
});

// Add this:
NotificationService.notifyLabResultsAvailable(
  labRequest.id, labRequest.patientId, labRequest.doctorId
).catch(err => console.error('Notification error:', err));
```

---

## 🎯 Frontend Integration (Quick Start)

### 1. Get Unread Count (for badge)
```typescript
// In your header component or service
async getUnreadCount() {
  const response = await fetch('/api/notifications/unread-count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data.count; // Display this in a badge
}
```

### 2. Get Notifications
```typescript
async getNotifications(limit = 50, offset = 0) {
  const response = await fetch(
    `/api/notifications?limit=${limit}&offset=${offset}&isArchived=false`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  return data.data.notifications;
}
```

### 3. Mark as Read
```typescript
async markAsRead(notificationId: string) {
  await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

### 4. Display Notifications
```html
<!-- In your Angular component -->
<div *ngFor="let notification of notifications" 
     [class.unread]="!notification.isRead"
     (click)="handleNotificationClick(notification)">
  <div class="notification-header">
    <h4>{{ notification.title }}</h4>
    <span class="time">{{ notification.createdAt | date:'short' }}</span>
  </div>
  <p>{{ notification.message }}</p>
  <span *ngIf="notification.priority === 'URGENT'" class="badge urgent">Urgent</span>
</div>
```

---

## 📋 Common Use Cases

### Use Case 1: Appointment Flow
```typescript
// When patient creates appointment → Notify doctor
await NotificationService.notifyAppointmentCreated(id, doctorId, patientId, date, time);

// When doctor confirms → Notify patient
await NotificationService.notifyAppointmentConfirmed(id, patientId, doctorId, date, time);

// When appointment is 24 hours away → Send reminder (via cron job)
await NotificationService.sendAppointmentReminder(id, patientId, date, time, 24);
```

### Use Case 2: Lab Results Flow
```typescript
// When doctor requests lab test → Notify patient
await NotificationService.notifyLabRequestCreated(labId, patientId, doctorId);

// When lab completes test → Notify both
await NotificationService.notifyLabResultsAvailable(labId, patientId, doctorId);
```

### Use Case 3: Medical Records Flow
```typescript
// When diagnosis is added → Notify patient
await NotificationService.notifyDiagnosisAdded(diagId, patientId, doctorId, diagName);

// When prescription is issued → Notify patient
await NotificationService.notifyPrescriptionIssued(rxId, patientId, doctorId, medName);
```

---

## 🔥 Pro Tips

### 1. Don't Block Main Operations
```typescript
// ❌ BAD - Blocks if notification fails
await NotificationService.notifyXXX(...);
return res.json({ success: true });

// ✅ GOOD - Doesn't block
NotificationService.notifyXXX(...).catch(err => console.error(err));
return res.json({ success: true });
```

### 2. Use Appropriate Priority
```typescript
// URGENT - Medical emergencies, critical appointments
priority: NotificationPriority.URGENT

// HIGH - Appointment confirmations, lab results, new diagnoses
priority: NotificationPriority.HIGH

// NORMAL - General updates, prescriptions, shared records (default)
priority: NotificationPriority.NORMAL

// LOW - Reminders, system announcements
priority: NotificationPriority.LOW
```

### 3. Include Action URLs
```typescript
// Always include where users should go
actionUrl: `/patient/appointments/${appointmentId}`
actionUrl: `/doctor/lab-requests/${labRequestId}`
actionUrl: `/patient/prescriptions/${prescriptionId}`
```

### 4. Add Useful Metadata
```typescript
metadata: {
  appointmentId,
  appointmentDate,
  appointmentTime,
  doctorName: 'Dr. Smith',
  specialization: 'Cardiologist'
}
```

---

## 🐛 Quick Troubleshooting

### Problem: "Table 'Notification' does not exist"
**Solution:** Run migration
```bash
npx prisma migrate dev --name add_notification_system
```

### Problem: "Cannot find module '../notifications/notification.service'"
**Solution:** Check file path
```typescript
// If you're in modules/appointments/:
import { NotificationService } from '../notifications/notification.service';

// If you're in modules/appointments/subfolder/:
import { NotificationService } from '../../notifications/notification.service';
```

### Problem: Notifications not appearing in API response
**Solution:** Check user ID matches
```typescript
// Make sure userId is correct
const userId = (req as any).user.id;
console.log('Creating notification for user:', userId);
```

### Problem: TypeScript errors about NotificationType
**Solution:** Regenerate Prisma client
```bash
npx prisma generate
# Then restart your IDE/TypeScript server
```

---

## 📱 Mobile App Integration

Same API endpoints, just use your HTTP client:

```typescript
// React Native / Mobile
const getNotifications = async () => {
  const response = await fetch('http://your-api.com/api/notifications', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

---

## 🎓 Learn More

- **Full Documentation:** `src/modules/notifications/NOTIFICATIONS_README.md`
- **Integration Examples:** `src/modules/notifications/integration-example.ts`
- **Migration Guide:** `NOTIFICATION_MIGRATION.md`
- **Complete Summary:** `NOTIFICATION_SYSTEM_SUMMARY.md`

---

## ✅ Quick Checklist

Before going to production:

- [ ] Ran database migration
- [ ] Tested `/api/notifications/test` endpoint
- [ ] Can see notifications in response
- [ ] Integrated into appointments module
- [ ] Integrated into prescriptions module
- [ ] Integrated into lab requests module
- [ ] Frontend can fetch notifications
- [ ] Frontend can display unread count
- [ ] Frontend can mark as read
- [ ] Set up notification cleanup job (optional)

---

## 🚀 You're Ready!

That's it! You now have a fully functional notification system.

**Need help?** Check the full documentation or ask the team.

**Found a bug?** Check troubleshooting section first.

**Want to add custom notifications?** See `integration-example.ts` for patterns.

---

**Last Updated:** October 10, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅


