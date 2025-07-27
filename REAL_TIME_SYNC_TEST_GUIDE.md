# 🚀 Real-Time Synchronization Testing Guide

## Overview
This guide covers comprehensive testing of the real-time synchronization system implemented across all user roles (Admin, Outlet, Deliveryman, Public).

## 🔧 System Architecture

### Backend Endpoints
- `/api/sync/last-update` - Global update timestamp
- `/api/sync/status/:role` - Role-specific status check  
- `/api/notifications` - User notifications
- All order CRUD operations trigger sync updates

### Frontend Hooks
- `useRealTimeSync` - Main sync hook with polling
- `useNotificationSync` - Notification-specific sync

## 🧪 Testing Scenarios

### Scenario 1: Multi-User Order Updates
**Objective:** Test real-time sync when admin updates order status

**Steps:**
1. **Setup:** Open 3 browser windows/tabs:
   - Tab 1: Admin dashboard (if available) or direct API
   - Tab 2: Outlet dashboard (login as outlet)
   - Tab 3: Public order detail page

2. **Test Action:** Admin changes order status from "pending" to "dalam_pengiriman"

3. **Expected Results:**
   - Tab 2 (Outlet): Should auto-refresh within 15 seconds showing new status
   - Tab 3 (Public): Should auto-refresh within 20 seconds showing new status
   - Console logs should show "SYNC: New updates detected"

### Scenario 2: Photo Upload Synchronization
**Objective:** Test sync when outlet uploads shipping photos

**Steps:**
1. **Setup:** Open 2 browser windows:
   - Tab 1: Outlet dashboard
   - Tab 2: Public order detail page for same order

2. **Test Action:** Outlet uploads photo via "Status Foto"

3. **Expected Results:**
   - Tab 2 (Public): Should show uploaded photo within 20 seconds
   - New photo should be visible in ShippingImageDisplay component

### Scenario 3: Deliveryman Assignment Sync
**Objective:** Test sync when admin assigns deliveryman to order

**Steps:**
1. **Setup:** Open 2 browser windows:
   - Tab 1: Admin interface (or direct API call)
   - Tab 2: Deliveryman dashboard

2. **Test Action:** Admin assigns new order to deliveryman

3. **Expected Results:**
   - Tab 2 (Deliveryman): Should show new assigned order within 12 seconds
   - Stats should update automatically
   - Toast notification should appear

### Scenario 4: Notification System
**Objective:** Test real-time notifications

**Steps:**
1. **Setup:** Login as outlet user
2. **Test Action:** Admin creates order for that outlet
3. **Expected Results:**
   - Toast notification should appear within 10 seconds
   - Notification should be marked as unread
   - Clicking notification should mark as read

## 🔍 Debug Testing

### Console Monitoring
Open browser DevTools Console and look for:
```
SYNC: Getting last update timestamp
OUTLET SYNC: New updates detected: {...}
DELIVERY SYNC: New updates detected: {...}
PUBLIC ORDER SYNC: New updates detected: {...}
```

### Network Monitoring
Check Network tab for:
- Regular polling requests to `/api/sync/last-update`
- Successful responses with timestamp data
- No excessive error responses

### Backend Endpoint Testing
Test endpoints directly:

```bash
# Test sync endpoint
curl https://order-management-app-production.wahwooh.workers.dev/api/sync/last-update

# Test role-specific status (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://order-management-app-production.wahwooh.workers.dev/api/sync/status/outlet
```

## 📊 Performance Monitoring

### Polling Intervals
- **Outlet Dashboard:** 15 seconds
- **Delivery Dashboard:** 12 seconds  
- **Public Pages:** 20 seconds
- **Notifications:** 8-10 seconds

### Expected Behavior
- No memory leaks from polling
- Graceful error handling on network issues
- Automatic retry on failed requests
- Clean interval cleanup on component unmount

## 🐛 Troubleshooting

### Common Issues

1. **Sync Not Working:**
   - Check browser console for errors
   - Verify backend endpoints are deployed
   - Confirm polling is enabled in hook

2. **High CPU Usage:**
   - Check if polling intervals are too frequent
   - Monitor for excessive re-renders

3. **Notifications Not Appearing:**
   - Verify user authentication
   - Check notification permissions
   - Confirm notification API endpoints

### Debug Commands

```javascript
// In browser console, force manual refresh
window.dispatchEvent(new CustomEvent('forceSync'));

// Check current sync status
console.log('Sync Status:', syncStatus);

// Manual notification check
notifications.refresh();
```

## ✅ Success Criteria

### Functional Requirements
- [ ] Orders sync across all dashboards within 30 seconds
- [ ] Photo uploads appear in real-time
- [ ] Status changes propagate to all views
- [ ] Notifications work reliably
- [ ] No data loss during sync

### Performance Requirements  
- [ ] Page load time < 3 seconds
- [ ] Sync update latency < 30 seconds
- [ ] Memory usage stable over 1 hour
- [ ] No polling errors > 5% failure rate

### User Experience
- [ ] Smooth UI updates without flashing
- [ ] Informative toast notifications
- [ ] Visual indicators for sync status
- [ ] Graceful offline handling

## 🚀 Production Deployment Checklist

- [x] Backend sync endpoints deployed
- [x] Frontend hooks implemented  
- [x] Dashboard integration complete
- [x] Error handling implemented
- [ ] Performance testing completed
- [ ] Multi-user testing completed
- [ ] Load testing under realistic conditions

## 📋 Manual Testing Checklist

- [ ] Admin → Outlet sync
- [ ] Admin → Deliveryman sync  
- [ ] Admin → Public sync
- [ ] Outlet → Public sync
- [ ] Deliveryman → Public sync
- [ ] Photo upload sync
- [ ] Status update sync
- [ ] Notification delivery
- [ ] Error recovery
- [ ] Offline/online transitions

## 📝 Test Results Template

```
Date: ___________
Tester: ___________
Environment: Production/Staging

Test Scenario: ________________
Result: PASS/FAIL
Notes: ________________________
Issues Found: __________________
```

---

**Next Steps:**
1. Run through all test scenarios
2. Document any issues found
3. Performance optimization if needed
4. User acceptance testing
5. Production monitoring setup
