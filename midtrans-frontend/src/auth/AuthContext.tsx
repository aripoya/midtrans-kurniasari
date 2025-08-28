import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, API_ENDPOINTS } from '../api/config';

// TypeScript interfaces
interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
}

interface LoginResponse {
  success: boolean;
  user?: User;
  message?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  hasRole: (role: string) => boolean;
  belongsToOutlet: (outletId: string) => boolean;
  getDashboardRoute: () => string;
}

interface AuthProviderProps {
  children: ReactNode;
}


// Create authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // DEBUG: Track sessionStorage operations
  React.useEffect(() => {
    const originalClear = sessionStorage.clear.bind(sessionStorage);
    const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);
    
    sessionStorage.clear = function() {
      console.error('🚨 [DEBUG] sessionStorage.clear() called from:');
      console.trace();
      return originalClear();
    };
    
    sessionStorage.removeItem = function(key: string) {
      if (key === 'token' || key === 'user') {
        console.warn(`🚨 [DEBUG] sessionStorage.removeItem(${key}) called from:`);
        console.trace();
      }
      return originalRemoveItem(key);
    };
    
    return () => {
      sessionStorage.clear = originalClear;
      sessionStorage.removeItem = originalRemoveItem;
    };
  }, []);

  // Helper function to check if token is expired (basic JWT decode)
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch (error) {
      console.warn('Unable to decode token, treating as expired:', error);
      return true;
    }
  };

  // Check if user is logged in on app load
  useEffect(() => {
    const checkLoggedIn = async (): Promise<void> => {
      const token = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          // Verify token is still valid by calling profile endpoint
          const response = await fetch(`${API_URL}${API_ENDPOINTS.auth.profile}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            // Token is valid
            const userData: User = JSON.parse(storedUser);
            setUser(userData);
            setIsLoggedIn(true);
            console.log(' Token validation successful for user:', userData.username);
          }
        } catch (error) {
          console.error(' Error verifying authentication:', error);
        }
      }
      
      setIsLoading(false);
    };

    checkLoggedIn();
  }, []);

  // Login function using API
  const login = async (username: string, password: string): Promise<LoginResponse> => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}${API_ENDPOINTS.auth.login}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      console.log('[DEBUG] Login API Response:', data);

      if (response.ok && data.token && data.user) {
        // Store token and user data in sessionStorage (tab-isolated)
        sessionStorage.setItem('token', data.token);
        
        const userData: User = {
          id: data.user.id,
          username: data.user.username,
          name: data.user.name,
          role: data.user.role,
          outlet_id: data.user.outlet_id
        };
        
        setUser(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
        setIsLoggedIn(true);
        console.log('[DEBUG] Token and user stored successfully in sessionStorage.');
        
        return { success: true, user: userData };
      } else {
        setError(data.message || 'Login failed');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    }
  };

  // Logout function
  const logout = (): void => {
    const prevRole = user?.role;
    setUser(null);
    setIsLoggedIn(false);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (prevRole === 'admin') {
      navigate('/admin/login');
    } else {
      navigate('/login');
    }
  };

  // Helper function to check if user has specific role
  const hasRole = (role: string): boolean => {
    return user !== null && user.role === role;
  };

  // Helper function to check if user belongs to specific outlet
  const belongsToOutlet = (outletId: string): boolean => {
    return user !== null && user.outlet_id === outletId;
  };

  // Get dashboard route based on user role
  const getDashboardRoute = (): string => {
    if (!user) return '/login';
    
    switch (user.role) {
      case 'admin':
        return '/admin';
      case 'outlet_manager':
        return '/outlet/dashboard';
      case 'deliveryman':
        return '/delivery/dashboard';
      default:
        return '/login';
    }
  };
  
  // Values provided by the context
  const value: AuthContextType = {
    isLoggedIn,
    user,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    belongsToOutlet,
    getDashboardRoute
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook untuk menggunakan AuthContext
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
