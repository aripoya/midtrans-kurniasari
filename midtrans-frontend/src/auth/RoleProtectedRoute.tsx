import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// TypeScript interfaces
interface RoleProtectedRouteProps {
  allowedRoles: string[];
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Route protection component that checks for specific user roles
 * 
 * @param props - Component props
 * @param props.allowedRoles - Array of role names allowed to access this route
 * @param props.children - Child components to render if user has access
 * @param props.redirectTo - Where to redirect if user doesn't have access
 * @returns Protected route or redirect
 */
const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  allowedRoles, 
  children, 
  redirectTo
}) => {
  const { isLoggedIn, user, isLoading } = useAuth();

  // Determine the correct login path based on allowed roles
  const getLoginPath = () => {
    if (redirectTo) return redirectTo; // Allow explicit override
    if (allowedRoles.includes('admin')) return '/admin/login';
    if (allowedRoles.includes('outlet_manager')) return '/outlet/login';
    if (allowedRoles.includes('deliveryman')) return '/delivery/login';
    return '/login'; // Default fallback
  };

  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  // Redirect to the appropriate login page if not logged in
  if (!isLoggedIn || !user) {
    const loginPath = getLoginPath();
    return <Navigate to={loginPath} replace />;
  }

  // Check if user has one of the allowed roles
  const hasAllowedRole = allowedRoles.includes(user.role);
  
  // If user is logged in but doesn't have an allowed role, redirect them to their own dashboard
  if (!hasAllowedRole) {
    let appropriateRedirect: string;
    
    switch (user.role) {
      case 'admin':
        appropriateRedirect = '/admin';
        break;
      case 'outlet_manager':
        appropriateRedirect = '/outlet/dashboard';
        break;
      case 'deliveryman':
        appropriateRedirect = '/delivery/dashboard';
        break;
      default:
        // If role is unknown, send to generic login
        appropriateRedirect = '/login';
    }
    
    return <Navigate to={appropriateRedirect} replace />;
  }

  // User is authenticated and has an allowed role, render the children
  return <>{children}</>;
};

export default RoleProtectedRoute;
