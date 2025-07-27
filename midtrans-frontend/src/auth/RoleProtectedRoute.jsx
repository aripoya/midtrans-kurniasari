import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Route protection component that checks for specific user roles
 * 
 * @param {Object} props - Component props
 * @param {Array} props.allowedRoles - Array of role names allowed to access this route
 * @param {React.ReactNode} props.children - Child components to render if user has access
 * @param {string} [props.redirectTo] - Where to redirect if user doesn't have access
 * @returns {React.ReactElement} Protected route or redirect
 */
function RoleProtectedRoute({ allowedRoles, children, redirectTo = '/login' }) {
  const { isLoggedIn, user, isLoading } = useAuth();

  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  // Redirect to login if not logged in
  if (!isLoggedIn || !user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has one of the allowed roles
  const hasAllowedRole = allowedRoles.includes(user.role);
  
  // If user doesn't have an allowed role, redirect them to their appropriate dashboard
  if (!hasAllowedRole) {
    let appropriateRedirect;
    
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
        appropriateRedirect = '/login';
    }
    
    return <Navigate to={appropriateRedirect} replace />;
  }

  // User is authenticated and has an allowed role
  return children;
}

export default RoleProtectedRoute;
