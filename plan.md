# User Management for Outlet-Specific Order & Admin Access

## 1. Project Overview
Create a user management system that allows each outlet to have its own login, order page, and limited admin access while preserving all existing functionality.

## 2. System Requirements

### Authentication
- Create outlet-specific user accounts with secure login
- Support different permission levels (admin, outlet manager, deliveryman)
- Implement JWT token-based authentication
- Store encrypted passwords in database

### Outlet Order Pages
- Each outlet should only see its own orders
- Maintain all existing order functionality but scoped to outlet
- Orders must be associated with specific outlets

### Limited Admin Access
- Outlet managers can access a subset of admin features
- Restrict access to only their own outlet's data
- Keep core admin functionality intact for main administrators

### Deliveryman Access
- Deliverymen can upload photos for order status
- Deliverymen can change shipping status to "Dalam Pengiriman" or "Diterima"
- Deliverymen can only access orders assigned to them

### UI/UX
- Create outlet-specific login page
- Create outlet dashboard
- Ensure clear visual distinction between public, outlet, and admin interfaces

## 3. Database Schema

### Users Table
```
users {
  id: string (primary key)
  outlet_id: string (foreign key)
  username: string
  password_hash: string
  name: string
  role: string (enum: admin, outlet_manager, deliveryman)
  email: string
  phone: string
  created_at: timestamp
  updated_at: timestamp
  last_login: timestamp
}
```

### Outlets Table
```
outlets {
  id: string (primary key)
  name: string
  location: string
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

### Permissions Table (Optional)
```
permissions {
  id: string (primary key)
  role: string (admin, outlet_manager, deliveryman)
  resource: string (orders, products, etc.)
  action: string (read, write, update, delete)
}
```

### Order Modifications
```
orders {
  ...existing fields...
  outlet_id: string (foreign key) - New field
  assigned_deliveryman_id: string (foreign key) - New field
}
```

### Order Update Logs (Audit Trail)
```
order_update_logs {
  id: string (primary key)
  order_id: string (foreign key)
  user_id: string (foreign key)
  update_type: string (status, shipping, payment, etc.)
  old_value: string
  new_value: string
  timestamp: timestamp
  user_role: string
  notes: string (optional)
}
```

## 4. Implementation Plan

### Phase 1: Database & Authentication
- Create database tables for users and outlets
- Add outlet_id and assigned_deliveryman_id fields to orders table
- Implement authentication API endpoints (login, logout, password reset)
- Create middleware for checking permissions

### Phase 2: Outlet Order Pages
- Create outlet-specific order listing page
- Implement filtered order views (only show outlet's orders)
- Create outlet order detail page with limited actions
- Implement order creation flow for outlets

### Phase 3: Limited Admin Access
- Create outlet admin dashboard
- Implement access control for admin features
- Create reports and analytics for outlet-specific data
- Add outlet management page for main administrators
- Implement audit logging for all order status updates with user tracking

### Phase 4: Testing & Integration
- Unit and integration tests for new features
- Security testing for authentication and authorization
- Performance testing
- User acceptance testing with outlet managers

## 5. Technical Considerations

### Security
- Implement proper JWT validation and expiration
- Store passwords using bcrypt or similar
- Use HTTPS for all communications
- Implement rate limiting for login attempts
- Maintain comprehensive audit logs for all status changes
- Ensure non-repudiation through user action tracking

### Performance
- Optimize database queries with proper indexes
- Use caching where appropriate
- Minimize API calls through efficient data fetching

### Code Structure
- Create separate route handlers for outlet-specific pages
- Use middleware for permission checks
- Keep authentication logic modular

## 6. Route Structure
```
/login - Main login page (redirect based on role)
/admin/* - Admin routes (requires admin privileges)
/outlet/login - Outlet-specific login
/outlet/dashboard - Outlet homepage
/outlet/orders/* - Outlet order management
/outlet/account/* - Outlet account management
/delivery/login - Deliveryman login
/delivery/orders/* - Assigned orders for delivery
```

## 7. Next Steps
1. Set up database tables for users and outlets
2. Implement basic authentication system
3. Create outlet login page
4. Add outlet identification to orders
5. Develop outlet-specific order view
6. Implement deliveryman authentication and order assignment
7. Create deliveryman mobile-friendly interface
