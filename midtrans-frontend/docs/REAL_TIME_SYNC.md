# Real-Time Synchronization System

## Overview

The Kurniasari Admin Dashboard implements a comprehensive real-time synchronization system that ensures all users (Admin, Outlet, Deliveryman, and Public consumers) see up-to-date order information and status changes immediately across all connected devices.

## Architecture

### Frontend Implementation

#### Core Hook: `useRealTimeSync`
Located at: `src/hooks/useRealTimeSync.ts`

The system uses a custom React hook that provides:
- **Polling-based synchronization** with configurable intervals
- **Role-based sync frequency** (Admin: 8s, Outlet: 10s, Delivery: 15s, Public: 20s)
- **Automatic error handling and retry logic**
- **Connection status monitoring**

```typescript
interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  error: string | null;
}

const { syncStatus, manualRefresh } = useRealTimeSync({
  role: 'admin' | 'outlet' | 'delivery' | 'public',
  onUpdate: (updateInfo) => { /* refresh data */ },
  pollingInterval: 8000,
  enabled: true
});
```

#### Notification System: `useNotificationSync`
Complementary hook for real-time notifications:
- **User-specific notifications**
- **Unread count tracking**
- **Toast notifications for new updates**

### Backend Endpoints

#### Sync Status Endpoint
- **URL**: `/api/sync/last-update`
- **Method**: GET
- **Auth**: Not required (public)
- **Response**: `{ success: boolean, lastUpdate: number, timestamp: string }`

#### Role-Specific Sync Status
- **URL**: `/api/sync/status/:role`
- **Method**: GET  
- **Auth**: Required (JWT token)
- **Response**: Role-specific update information

## Dashboard Integration

### 1. AdminOrdersPage
- **Location**: `src/pages/admin/AdminOrdersPage.tsx`
- **Sync Frequency**: 8 seconds (most frequent for admin oversight)
- **UI Feedback**: Status badge with connection indicator and last sync time
- **Features**: 
  - Real-time order list updates
  - Notification count badge
  - Visual sync status (✅ Live, ❌ Disconnected, ❌ Sync Error)

### 2. OutletDashboard
- **Location**: `src/pages/outlet/OutletDashboard.tsx`
- **Sync Frequency**: 10 seconds
- **Features**:
  - Real-time order assignments from admin
  - Status change synchronization
  - Photo upload status updates

### 3. DeliveryDashboard  
- **Location**: `src/pages/delivery/DeliveryDashboard.tsx`
- **Sync Frequency**: 15 seconds
- **Features**:
  - Assigned order updates
  - Status change notifications
  - Photo upload synchronization

### 4. Public Order Detail Page
- **Location**: `src/pages/OrderDetailPage.tsx`
- **Sync Frequency**: 20 seconds (least frequent for public users)
- **Features**:
  - Order status updates
  - Photo status changes
  - Delivery progress tracking

## UI Feedback Components

### Sync Status Indicator
Each dashboard displays real-time sync status:

```typescript
<Badge 
  colorScheme={!syncStatus.connected ? 'red' : syncStatus.error ? 'red' : 'green'}
  variant="subtle"
>
  {!syncStatus.connected ? '❌ Disconnected' : syncStatus.error ? '❌ Sync Error' : '✅ Live'}
</Badge>
```

### Last Sync Timestamp
Shows when data was last synchronized:

```typescript
{syncStatus.lastSync && (
  <Text fontSize="xs" color="gray.500">
    Last: {new Date(syncStatus.lastSync).toLocaleTimeString()}
  </Text>
)}
```

### Notification Count Badge
Displays unread notifications:

```typescript
{unreadCount > 0 && (
  <Badge colorScheme="red" variant="solid" borderRadius="full">
    {unreadCount} new
  </Badge>
)}
```

## Implementation Benefits

### 1. **Real-Time Collaboration**
- Multiple users can work simultaneously without data conflicts
- Immediate visibility of changes across all connected devices
- Reduced need for manual page refreshes

### 2. **Role-Based Optimization**
- Admin: Fastest updates (8s) for oversight responsibilities
- Outlet: Moderate updates (10s) for operational efficiency  
- Delivery: Balanced updates (15s) for field work
- Public: Conservative updates (20s) to reduce server load

### 3. **Error Resilience**
- Automatic retry on connection failures
- Visual feedback for connection issues
- Graceful degradation when sync is unavailable

### 4. **Performance Optimization**
- Efficient polling intervals prevent server overload
- Conditional updates only when data changes
- Minimal bandwidth usage with targeted endpoints

## Troubleshooting

### Common Issues

1. **Sync Status Shows "Disconnected"**
   - Check network connectivity
   - Verify backend server availability
   - Confirm JWT token validity

2. **High Frequency Updates**
   - Review polling intervals in hook configuration
   - Monitor server performance metrics
   - Consider adjusting role-specific frequencies

3. **Missing Notifications**
   - Verify `useNotificationSync` integration
   - Check user ID mapping
   - Confirm backend notification endpoints

### Debug Tips

1. **Console Logging**
   ```typescript
   console.log('ADMIN SYNC: New updates detected:', updateInfo);
   ```

2. **Network Monitoring**
   - Check browser Network tab for API calls
   - Monitor response times and status codes
   - Verify authentication headers

3. **State Debugging**
   - Use React Developer Tools
   - Monitor hook state changes
   - Check component re-render frequency

## Migration Notes

### TypeScript Integration
All real-time sync components are fully typed:
- Strong typing for sync status objects
- Type-safe hook interfaces
- Comprehensive error type definitions

### Backward Compatibility
- System gracefully degrades without real-time sync
- Manual refresh buttons remain functional
- No breaking changes to existing functionality

## Future Enhancements

### Potential Improvements
1. **WebSocket Integration**: Replace polling with real-time WebSocket connections
2. **Offline Support**: Queue updates when offline, sync when reconnected  
3. **Push Notifications**: Browser/mobile push notifications for critical updates
4. **Selective Sync**: Only sync specific data types based on user activity
5. **Metrics Dashboard**: Admin panel for monitoring sync performance

### Performance Monitoring
- Track sync success rates
- Monitor API response times
- Measure user engagement with real-time features
- Analyze server load from polling requests

---

## Summary

The real-time synchronization system provides a robust, scalable foundation for collaborative order management across all user roles. The polling-based approach ensures compatibility across all browsers while providing immediate updates for critical business operations.

The system is designed for maintainability, performance, and user experience, with comprehensive error handling and visual feedback to ensure users always know the current sync status.
