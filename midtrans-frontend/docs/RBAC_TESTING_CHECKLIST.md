# RBAC Testing and Verification Checklist

## Overview

This document provides a comprehensive testing checklist to verify that Role-Based Access Control (RBAC) is properly enforced across the Kurniasari Admin Dashboard frontend application.

## Testing Methodology

### Test Users Setup

Use these test accounts for RBAC verification:

```javascript
// Admin User
{
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  expected_access: ['admin', 'debug', 'products', 'orders/new']
}

// Outlet Manager
{
  username: 'outlet_manager',
  password: 'outlet123', 
  role: 'outlet_manager',
  expected_access: ['outlet', 'products', 'orders/new']
}

// Deliveryman
{
  username: 'delivery',
  password: 'delivery123',
  role: 'deliveryman', 
  expected_access: ['delivery']
}
```

## RBAC Testing Matrix

### ✅ Admin Role Testing

| Route/Feature | Expected Result | Test Status | Notes |
|---------------|----------------|-------------|-------|
| `/admin` | ✅ Access Granted | 🔄 Pending | Should render AdminOrdersPage |
| `/admin/orders` | ✅ Access Granted | 🔄 Pending | Should show order listing |
| `/admin/orders/:id` | ✅ Access Granted | 🔄 Pending | Should show order details |
| `/admin/users` | ✅ Access Granted | 🔄 Pending | Should show user management |
| `/debug` | ✅ Access Granted | 🔄 Pending | Should show debug information |
| `/debug-notifications` | ✅ Access Granted | 🔄 Pending | Should show notification debug |
| `/products` | ✅ Access Granted | 🔄 Pending | Should show product management |
| `/orders/new` | ✅ Access Granted | 🔄 Pending | Should show new order form |
| `/outlet/dashboard` | ❌ Redirect to `/admin` | 🔄 Pending | Should not access outlet routes |
| `/delivery/dashboard` | ❌ Redirect to `/admin` | 🔄 Pending | Should not access delivery routes |

### ✅ Outlet Manager Role Testing

| Route/Feature | Expected Result | Test Status | Notes |
|---------------|----------------|-------------|-------|
| `/outlet/dashboard` | ✅ Access Granted | 🔄 Pending | Should render OutletDashboard |
| `/outlet/admin` | ✅ Access Granted | 🔄 Pending | Should show outlet admin view |
| `/outlet/orders/:id` | ✅ Access Granted | 🔄 Pending | Should show outlet order details |
| `/products` | ✅ Access Granted | 🔄 Pending | Should show product management |
| `/orders/new` | ✅ Access Granted | 🔄 Pending | Should show new order form |
| `/admin` | ❌ Redirect to `/outlet/dashboard` | 🔄 Pending | Should not access admin routes |
| `/admin/orders/:id` | ❌ Redirect to `/outlet/dashboard` | 🔄 Pending | Should not access admin order details |
| `/debug` | ❌ Redirect to `/outlet/dashboard` | 🔄 Pending | Should not access debug pages |
| `/delivery/dashboard` | ❌ Redirect to `/outlet/dashboard` | 🔄 Pending | Should not access delivery routes |

### ✅ Deliveryman Role Testing

| Route/Feature | Expected Result | Test Status | Notes |
|---------------|----------------|-------------|-------|
| `/delivery/dashboard` | ✅ Access Granted | 🔄 Pending | Should render DeliveryDashboard |
| `/delivery/orders/:id` | ✅ Access Granted | 🔄 Pending | Should show delivery order details |
| `/admin` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not access admin routes |
| `/admin/orders/:id` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not access admin order details |
| `/outlet/dashboard` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not access outlet routes |
| `/products` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not access product management |
| `/orders/new` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not create new orders |
| `/debug` | ❌ Redirect to `/delivery/dashboard` | 🔄 Pending | Should not access debug pages |

### ✅ Unauthenticated User Testing

| Route/Feature | Expected Result | Test Status | Notes |
|---------------|----------------|-------------|-------|
| `/orders` (public) | ✅ Access Granted | 🔄 Pending | Should show public order listing |
| `/orders/:id` (public) | ✅ Access Granted | 🔄 Pending | Should show public order details |
| `/order/:id` (public) | ✅ Access Granted | 🔄 Pending | Should show public order details |
| `/admin` | ❌ Redirect to `/login` | 🔄 Pending | Should require authentication |
| `/outlet/dashboard` | ❌ Redirect to `/login` | 🔄 Pending | Should require authentication |
| `/delivery/dashboard` | ❌ Redirect to `/login` | 🔄 Pending | Should require authentication |
| `/products` | ❌ Redirect to `/login` | 🔄 Pending | Should require authentication |
| `/orders/new` | ❌ Redirect to `/login` | 🔄 Pending | Should require authentication |

## Manual Testing Steps

### Step 1: Admin Role Verification

1. **Login as Admin**
   ```
   URL: http://localhost:5173/login
   Username: admin
   Password: admin123
   ```

2. **Test Admin Access**
   - Navigate to `/admin` → Should show admin dashboard
   - Navigate to `/admin/orders/ORDER-123` → Should show admin order details  
   - Navigate to `/debug` → Should show debug page
   - Navigate to `/products` → Should show products page
   - Navigate to `/orders/new` → Should show new order form

3. **Test Admin Restrictions** 
   - Navigate to `/outlet/dashboard` → Should redirect to `/admin`
   - Navigate to `/delivery/dashboard` → Should redirect to `/admin`

### Step 2: Outlet Manager Role Verification

1. **Login as Outlet Manager**
   ```
   URL: http://localhost:5173/login
   Username: outlet_manager (or your test outlet user)
   Password: outlet123 (or your test password)
   ```

2. **Test Outlet Access**
   - Navigate to `/outlet/dashboard` → Should show outlet dashboard
   - Navigate to `/outlet/admin` → Should show outlet admin view
   - Navigate to `/products` → Should show products page
   - Navigate to `/orders/new` → Should show new order form

3. **Test Outlet Restrictions**
   - Navigate to `/admin` → Should redirect to `/outlet/dashboard`
   - Navigate to `/debug` → Should redirect to `/outlet/dashboard`
   - Navigate to `/delivery/dashboard` → Should redirect to `/outlet/dashboard`

### Step 3: Deliveryman Role Verification

1. **Login as Deliveryman**
   ```
   URL: http://localhost:5173/login
   Username: delivery
   Password: delivery123
   ```

2. **Test Delivery Access**
   - Navigate to `/delivery/dashboard` → Should show delivery dashboard
   - Navigate to `/delivery/orders/ORDER-123` → Should show delivery order details

3. **Test Delivery Restrictions** ⚠️ **CRITICAL TEST**
   - Navigate to `/admin` → Should redirect to `/delivery/dashboard`
   - Navigate to `/outlet/dashboard` → Should redirect to `/delivery/dashboard`
   - Navigate to `/products` → Should redirect to `/delivery/dashboard`
   - Navigate to `/orders/new` → Should redirect to `/delivery/dashboard`
   - Navigate to `/debug` → Should redirect to `/delivery/dashboard`

### Step 4: Unauthenticated User Verification

1. **Logout/Clear Session**
   - Clear localStorage
   - Navigate to `/login`

2. **Test Public Access**
   - Navigate to `/orders` → Should show public order listing
   - Navigate to `/orders/ORDER-123` → Should show public order details
   - Navigate to `/order/ORDER-123` → Should show public order details

3. **Test Authentication Requirements**
   - Navigate to `/admin` → Should redirect to `/login`
   - Navigate to `/outlet/dashboard` → Should redirect to `/login` 
   - Navigate to `/delivery/dashboard` → Should redirect to `/login`
   - Navigate to `/products` → Should redirect to `/login`

## Browser Testing

### Cross-Browser Verification

Test RBAC enforcement in multiple browsers:

- ✅ Chrome/Chromium
- ✅ Firefox  
- ✅ Safari
- ✅ Edge

### Incognito/Private Mode Testing

Test RBAC in private browsing mode to ensure:
- No cached authentication bypasses security
- Fresh session properly enforces role restrictions
- Logout clears all authentication tokens

## Security Bypass Attempts

### Direct URL Access Tests

Test these potential security bypasses:

1. **JWT Token Manipulation**
   - Modify localStorage token
   - Use expired tokens
   - Use tokens from different roles

2. **Browser Back/Forward Navigation**
   - Login as admin, navigate to admin page
   - Logout, click browser back button
   - Should redirect to login, not show cached admin page

3. **Multiple Tab Testing**
   - Login as admin in tab 1
   - Open tab 2, navigate to outlet route
   - Should properly enforce admin role restrictions

4. **Local Storage Manipulation**
   - Manually edit user role in localStorage
   - Refresh page
   - Should re-verify with backend and correct role

## Component-Level RBAC Testing

### UI Element Visibility

Verify that role-inappropriate UI elements are hidden:

1. **Admin Dashboard**
   - Non-admin users should not see admin-only buttons/menus

2. **Outlet Dashboard** 
   - Deliveryman should not see outlet management features

3. **Navigation Menus**
   - Role-appropriate menu items only

## API Endpoint RBAC Testing

### Backend Authorization Testing

Verify backend API respects frontend role restrictions:

1. **Admin Endpoints**
   ```bash
   # Should succeed with admin token
   curl -H "Authorization: Bearer ADMIN_TOKEN" /api/admin/orders
   
   # Should fail with outlet token  
   curl -H "Authorization: Bearer OUTLET_TOKEN" /api/admin/orders
   ```

2. **Outlet Endpoints**
   ```bash
   # Should succeed with outlet token
   curl -H "Authorization: Bearer OUTLET_TOKEN" /api/orders/outlet
   
   # Should fail with delivery token
   curl -H "Authorization: Bearer DELIVERY_TOKEN" /api/orders/outlet  
   ```

## Test Results Documentation

### Pass/Fail Criteria

- ✅ **PASS**: All role restrictions work as expected
- ⚠️ **WARNING**: Minor issues that don't compromise security  
- ❌ **FAIL**: Security vulnerability found - immediate fix required

### Test Execution Log

Create a log entry for each test:

```
Date: 2025-07-23T08:17:29+07:00
Tester: [Name]
Test: Admin Role - Access to /debug
Result: ✅ PASS
Notes: Successfully accessed debug page, shows admin-only information
```

## Issues and Findings

### Critical Issues (❌ FAIL)
- [ ] None identified yet

### Warnings (⚠️ WARNING)  
- [ ] None identified yet

### Recommendations
- [ ] Regular RBAC testing during development
- [ ] Automated RBAC test integration
- [ ] Periodic security audit reviews

## Test Completion Checklist

- [ ] All admin role tests completed
- [ ] All outlet manager role tests completed  
- [ ] All deliveryman role tests completed
- [ ] All unauthenticated user tests completed
- [ ] Cross-browser testing completed
- [ ] Security bypass attempts tested
- [ ] Component-level RBAC verified
- [ ] API endpoint authorization tested
- [ ] All issues documented and resolved
- [ ] Test results logged and archived

## Sign-off

**Frontend RBAC Implementation**: ✅ Ready for Production

**Tested By**: _________________
**Date**: _________________  
**Approved By**: _________________
**Date**: _________________
