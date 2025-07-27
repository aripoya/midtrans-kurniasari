import { API_BASE_URL } from '../config';

// TypeScript interfaces for user management service
export interface UserData {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
}

export interface UpdateUserRequest {
  username?: string;
  name?: string;
  role?: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface GetUsersResponse {
  success: boolean;
  users: UserData[];
  total?: number;
  error?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user?: UserData;
  message?: string;
  error?: string;
}

export interface UpdateUserResponse {
  success: boolean;
  user?: UserData;
  message?: string;
  error?: string;
}

export interface DeleteUserResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UserManagementError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

/**
 * Service for managing users with comprehensive TypeScript support
 * Provides CRUD operations for user management with type safety
 */
class UserManagementService {
  /**
   * Get authentication token from sessionStorage
   * @returns JWT token or null if not found
   */
  private getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  /**
   * Validate authentication token
   * @throws Error if no valid token is found
   */
  private validateAuth(): string {
    const token = this.getToken();
    if (!token) {
      throw new Error('Unauthorized: No authentication token found');
    }
    return token;
  }

  /**
   * Handle fetch response with error checking
   * @param response - Fetch response object
   * @returns Promise with parsed JSON data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        // If we can't parse the error response, use the status text
      }
      
      const error = new Error(errorMessage) as UserManagementError;
      error.response = {
        status: response.status,
        data: null
      };
      throw error;
    }

    return await response.json();
  }

  /**
   * Get all users from the server
   * @returns Promise with users data
   */
  async getUsers(): Promise<GetUsersResponse> {
    try {
      const token = this.validateAuth();

      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return await this.handleResponse<GetUsersResponse>(response);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      const managementError = new Error(error.message || 'Failed to fetch users') as UserManagementError;
      managementError.response = error.response;
      throw managementError;
    }
  }

  /**
   * Create a new user
   * @param userData - User creation data
   * @returns Promise with created user data
   */
  async createUser(userData: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      // Validate required fields
      if (!userData.username || !userData.password || !userData.name || !userData.role) {
        throw new Error('Username, password, name, and role are required');
      }

      const token = this.validateAuth();

      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      return await this.handleResponse<CreateUserResponse>(response);
    } catch (error: any) {
      console.error('Error creating user:', error);
      const managementError = new Error(error.message || 'Failed to create user') as UserManagementError;
      managementError.response = error.response;
      throw managementError;
    }
  }

  /**
   * Update an existing user
   * @param userId - User ID to update
   * @param userData - Updated user data
   * @returns Promise with updated user data
   */
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<UpdateUserResponse> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!userData || Object.keys(userData).length === 0) {
        throw new Error('Update data is required');
      }

      const token = this.validateAuth();

      const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      return await this.handleResponse<UpdateUserResponse>(response);
    } catch (error: any) {
      console.error('Error updating user:', error);
      const managementError = new Error(error.message || 'Failed to update user') as UserManagementError;
      managementError.response = error.response;
      throw managementError;
    }
  }

  /**
   * Delete a user
   * @param userId - User ID to delete
   * @returns Promise with deletion result
   */
  async deleteUser(userId: string): Promise<DeleteUserResponse> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const token = this.validateAuth();

      const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return await this.handleResponse<DeleteUserResponse>(response);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const managementError = new Error(error.message || 'Failed to delete user') as UserManagementError;
      managementError.response = error.response;
      throw managementError;
    }
  }

  /**
   * Reset user password
   * @param userId - User ID whose password to reset
   * @param newPassword - New password to set
   * @returns Promise with reset result
   */
  async resetPassword(userId: string, newPassword: string): Promise<ResetPasswordResponse> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!newPassword || newPassword.length < 6) {
        throw new Error('New password is required and must be at least 6 characters');
      }

      const token = this.validateAuth();

      const resetData: ResetPasswordRequest = { password: newPassword };

      const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resetData),
      });

      return await this.handleResponse<ResetPasswordResponse>(response);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      const managementError = new Error(error.message || 'Failed to reset password') as UserManagementError;
      managementError.response = error.response;
      throw managementError;
    }
  }

  /**
   * Type guard to check if response indicates success
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

  /**
   * Validate user role
   * @param role - Role to validate
   * @returns True if role is valid
   */
  isValidRole(role: string): role is UserData['role'] {
    return ['admin', 'outlet_manager', 'deliveryman'].includes(role);
  }

  /**
   * Check if user has admin privileges
   * @param user - User data to check
   * @returns True if user is admin
   */
  isAdmin(user: UserData): boolean {
    return user.role === 'admin';
  }

  /**
   * Check if user is outlet manager
   * @param user - User data to check
   * @returns True if user is outlet manager
   */
  isOutletManager(user: UserData): boolean {
    return user.role === 'outlet_manager';
  }

  /**
   * Check if user is deliveryman
   * @param user - User data to check
   * @returns True if user is deliveryman
   */
  isDeliveryman(user: UserData): boolean {
    return user.role === 'deliveryman';
  }

  /**
   * Get user display name
   * @param user - User data
   * @returns Display name for the user
   */
  getUserDisplayName(user: UserData): string {
    return user.name || user.username || 'Unknown User';
  }

  /**
   * Get role display name
   * @param role - User role
   * @returns Human-readable role name
   */
  getRoleDisplayName(role: UserData['role']): string {
    const roleNames: Record<UserData['role'], string> = {
      admin: 'Administrator',
      outlet_manager: 'Outlet Manager',
      deliveryman: 'Delivery Man'
    };
    return roleNames[role] || role;
  }

  /**
   * Filter users by role
   * @param users - Array of users
   * @param role - Role to filter by
   * @returns Filtered array of users
   */
  filterUsersByRole(users: UserData[], role: UserData['role']): UserData[] {
    return users.filter(user => user.role === role);
  }

  /**
   * Sort users by name
   * @param users - Array of users to sort
   * @returns Sorted array of users
   */
  sortUsersByName(users: UserData[]): UserData[] {
    return [...users].sort((a, b) => {
      const nameA = this.getUserDisplayName(a).toLowerCase();
      const nameB = this.getUserDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
}

// Create and export singleton instance
const userManagementService = new UserManagementService();
export default userManagementService;
