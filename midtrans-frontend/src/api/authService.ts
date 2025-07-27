import { API_URL } from './config';

// TypeScript interfaces for authentication service
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

export interface UserProfileResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface Outlet {
  id: string;
  name: string;
  address?: string;
  location?: string;
  alamat?: string;
  phone?: string;
  email?: string;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OutletsResponse {
  success: boolean;
  outlets: Outlet[];
  error?: string;
}

export interface CreateOutletRequest {
  name: string;
  address?: string;
  location?: string;
  alamat?: string;
  phone?: string;
  email?: string;
  manager_id?: string;
}

export interface CreateOutletResponse {
  success: boolean;
  outlet?: Outlet;
  message?: string;
  error?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  payment_status: string;
  shipping_status: string;
  shipping_area: string;
  created_at: string;
}

export interface OutletOrdersResponse {
  success: boolean;
  orders: Order[];
  total?: number;
  error?: string;
}

export interface AuthServiceError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

/**
 * Authentication service for API calls related to users, authentication and outlets
 */
class AuthService {
  /**
   * Login a user
   * @param username - Username for authentication
   * @param password - Password for authentication  
   * @returns Promise with login response
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      const loginData: LoginRequest = { username, password };

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });
      
      const data: LoginResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Login failed') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Register a new user
   * @param userData - User registration data
   * @returns Promise with registration response
   */
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      if (!userData.username || !userData.password || !userData.name || !userData.role) {
        throw new Error('Username, password, name, and role are required');
      }

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify(userData)
      });
      
      const data: RegisterResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Registration error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Registration failed') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Get user profile for authenticated user
   * @returns Promise with user profile response
   */
  async getUserProfile(): Promise<UserProfileResponse> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token required');
      }

      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data: UserProfileResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Get profile error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Failed to get user profile') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Get all outlets (admin only)
   * @returns Promise with outlets response
   */
  async getOutlets(): Promise<OutletsResponse> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token required');
      }

      const response = await fetch(`${API_URL}/outlets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data: OutletsResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Get outlets error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Failed to get outlets') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Create a new outlet (admin only)
   * @param outletData - Outlet creation data
   * @returns Promise with outlet creation response
   */
  async createOutlet(outletData: CreateOutletRequest): Promise<CreateOutletResponse> {
    try {
      if (!outletData.name) {
        throw new Error('Outlet name is required');
      }

      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token required');
      }

      const response = await fetch(`${API_URL}/outlets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(outletData)
      });
      
      const data: CreateOutletResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Create outlet error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Failed to create outlet') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Get orders for current outlet
   * @returns Promise with outlet orders response
   */
  async getOutletOrders(): Promise<OutletOrdersResponse> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token required');
      }

      const response = await fetch(`${API_URL}/api/orders/outlet`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data: OutletOrdersResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('Get outlet orders error:', error);
      const authError: AuthServiceError = new Error(error.message || 'Failed to get outlet orders') as AuthServiceError;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Get token from session storage
   * @returns JWT token or null if not found
   */
  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  /**
   * Set token in session storage
   * @param token - JWT token to store
   */
  setToken(token: string): void {
    sessionStorage.setItem('token', token);
  }

  /**
   * Remove token from local storage
   */
  removeToken(): void {
    localStorage.removeItem('token');
  }

  /**
   * Get user data from local storage
   * @returns User data object or null if not found
   */
  getUserData(): User | null {
    const userData = localStorage.getItem('user');
    try {
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return null;
    }
  }

  /**
   * Set user data in local storage
   * @param userData - User data to store
   */
  setUserData(userData: User): void {
    localStorage.setItem('user', JSON.stringify(userData));
  }

  /**
   * Remove user data from local storage
   */
  removeUserData(): void {
    localStorage.removeItem('user');
  }

  /**
   * Check if user is authenticated (has valid token)
   * @returns True if user has token
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token;
  }

  /**
   * Logout user by removing token and user data
   */
  logout(): void {
    this.removeToken();
    this.removeUserData();
  }

  /**
   * Type guard to check if user has specific role
   * @param role - Role to check for
   * @returns True if user has the specified role
   */
  hasRole(role: User['role']): boolean {
    const user = this.getUserData();
    return user?.role === role;
  }

  /**
   * Check if user is admin
   * @returns True if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Check if user is outlet manager
   * @returns True if user is outlet manager
   */
  isOutletManager(): boolean {
    return this.hasRole('outlet_manager');
  }

  /**
   * Check if user is deliveryman
   * @returns True if user is deliveryman
   */
  isDeliveryman(): boolean {
    return this.hasRole('deliveryman');
  }

  /**
   * Get current user's outlet ID
   * @returns Outlet ID or null if not set
   */
  getOutletId(): string | null {
    const user = this.getUserData();
    return user?.outlet_id || null;
  }

  /**
   * Type guard to check if response is successful
   * @param response - API response to check
   * @returns True if response indicates success
   */
  isSuccessResponse<T extends { success: boolean }>(response: T): response is T & { success: true } {
    return response.success === true;
  }

  /**
   * Extract error message from API response
   * @param response - API response to extract error from
   * @returns Error message string
   */
  getErrorMessage(response: { error?: string; message?: string }): string {
    return response.error || response.message || 'An unknown error occurred';
  }
}

export default new AuthService();
