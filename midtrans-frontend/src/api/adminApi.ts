import axios, { AxiosResponse } from "axios";
import { API_URL } from "./config";

// Use the same API URL as the main config to ensure consistency between login and API calls
// This prevents token/session mismatch issues
const API_BASE_URL = API_URL;

// TypeScript interfaces for API responses and data structures
export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "outlet_manager" | "deliveryman";
  outlet_id?: string;
  email?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_phone?: string;
  total_amount: number;
  payment_status:
    | "pending"
    | "settlement"
    | "capture"
    | "paid"
    | "deny"
    | "cancel"
    | "expire"
    | "failure";
  shipping_status: string;
  shipping_area: "dalam-kota" | "luar-kota";
  pickup_method?: string;
  created_at: string;
  updated_at?: string;
  admin_note?: string;
  outlet_id?: string;
  lokasi_pengiriman?: string;
  assigned_deliveryman_id?: string;
}

export interface ShippingImage {
  id: string;
  order_id: string;
  image_type: "siap_kirim" | "pengiriman" | "diterima";
  image_url: string;
  uploaded_at: string;
}

export interface Location {
  code: string;
  name: string;
  area?: string;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface OrderResponse {
  success: boolean;
  data: Order | null;
  error: string | null;
}

export interface OrdersResponse {
  success: boolean;
  data?: {
    orders: Order[];
    total?: number;
    offset?: number;
    limit?: number;
  };
  error: string | null;
}

export interface UsersResponse {
  success: boolean;
  data: User[] | null;
  error: string | null;
}

export interface ShippingImagesResponse {
  success: boolean;
  data: ShippingImage[] | null;
  error: string | null;
}

export interface LocationsResponse {
  success: boolean;
  data: Location[] | null;
  error: string | null;
}

// Request payload interfaces
export interface UpdateOrderStatusRequest {
  status: string;
  admin_note?: string;
}

export interface UpdateOrderDetailsRequest {
  status?: string;
  admin_note?: string;
  shipping_area?: "dalam-kota" | "luar-kota";
  pickup_method?: string;
}

export interface UpdateShippingStatusRequest {
  status: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  name: string;
  role: "admin" | "outlet_manager" | "deliveryman";
  outlet_id?: string;
  email?: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  name?: string;
  role?: "admin" | "outlet_manager" | "deliveryman";
  outlet_id?: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ResetPasswordRequest {
  password: string;
}

// Helper function to get admin token from sessionStorage (consistent with AuthContext)
const getAdminToken = (): string | null => {
  const token = sessionStorage.getItem("token");
  console.log(
    "[DEBUG] Retrieved token from sessionStorage:",
    token ? "Token exists" : "No token found"
  );
  return token;
};

// Admin API endpoints with full TypeScript support
export const adminApi = {
  // Get order details by ID
  getOrderDetails: async (orderId: string): Promise<OrderResponse> => {
    try {
      console.log(
        `🔍 Getting order details for ID: ${orderId} from ${API_BASE_URL}`
      );

      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/orders/${orderId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      // Handle different response formats
      let data: Order | null = null;
      if (response.data?.success && response.data?.data) {
        data = response.data.data;
      } else if (response.data?.data) {
        data = response.data.data;
      } else if (response.data?.order) {
        data = response.data.order;
      } else {
        data = response.data;
      }

      return { success: true, data, error: null };
    } catch (error: any) {
      console.error("Error getting order details:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil detail pesanan",
      };
    }
  },

  // Update status pengiriman pesanan
  updateOrderStatus: async (
    orderId: string,
    status: string,
    adminNote: string = ""
  ): Promise<ApiResponse> => {
    try {
      const payload: UpdateOrderStatusRequest = {
        status,
        admin_note: adminNote,
      };

      const response: AxiosResponse = await axios.put(
        `${API_BASE_URL}/api/orders/${orderId}/status`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error("Error updating order status:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat memperbarui status",
      };
    }
  },

  // Update detail pesanan termasuk status pengiriman, area pengiriman dan metode pengambilan
  updateOrderDetails: async (
    orderId: string,
    shippingData: UpdateOrderDetailsRequest
  ): Promise<ApiResponse> => {
    try {
      // Debug logs untuk membantu troubleshooting
      console.group("updateOrderDetails - Request Details");
      console.log("Order ID:", orderId);
      console.log("API URL:", `${API_BASE_URL}/api/orders/${orderId}`);
      console.log("Request Payload:", JSON.stringify(shippingData, null, 2));
      console.groupEnd();

      const response: AxiosResponse = await axios.patch(
        `${API_BASE_URL}/api/orders/${orderId}`,
        shippingData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log("updateOrderDetails - Response:", response.data);

      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.group("updateOrderDetails - Error Details");
      console.error("Error updating order details:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      console.error("Error message:", error.message);
      console.groupEnd();

      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat memperbarui detail pesanan",
      };
    }
  },

  // Mendapatkan daftar lengkap pesanan untuk admin
  getAdminOrders: async (
    offset: number = 0,
    limit: number = 50
  ): Promise<OrdersResponse> => {
    try {
      console.log("[DEBUG] Fetching admin orders...");
      console.log("[DEBUG] Using endpoint:", `${API_BASE_URL}/api/orders`);
      console.log("[DEBUG] Token:", getAdminToken() ? "Present" : "Missing");

      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/orders`,
        {
          params: {
            offset,
            limit,
            admin: true,
          },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log("[DEBUG] Raw API response:", response.data);

      // Handle different response structures from the API
      if (response.data?.success && Array.isArray(response.data?.orders)) {
        const orders: Order[] = response.data.orders;
        console.log("[DEBUG] Found orders array with length:", orders.length);
        return {
          success: true,
          data: {
            orders,
            total: response.data.total || orders.length,
            offset: response.data.offset || offset,
            limit: response.data.limit || limit,
          },
          error: null,
        };
      } else if (Array.isArray(response.data)) {
        const orders: Order[] = response.data;
        console.log(
          "[DEBUG] Response is direct array with length:",
          orders.length
        );
        return {
          success: true,
          data: {
            orders,
            total: orders.length,
            offset,
            limit,
          },
          error: null,
        };
      } else {
        console.error("[DEBUG] Unexpected response structure:", response.data);
        return {
          success: false,
          data: undefined,
          error: "Struktur response tidak dikenali",
        };
      }
    } catch (error: any) {
      console.error("[ERROR] Error fetching admin orders:", error);
      console.error("[ERROR] Error response:", error.response?.data);
      return {
        success: false,
        data: undefined,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil daftar pesanan admin",
      };
    }
  },

  // Hapus pesanan (delete order)
  deleteOrder: async (orderId: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await axios.delete(
        `${API_BASE_URL}/api/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error("Error deleting order:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat menghapus pesanan",
      };
    }
  },

  // Upload gambar status pengiriman
  uploadShippingImage: async (
    orderId: string,
    imageType: "ready_for_pickup" | "picked_up" | "delivered" | "shipment_proof",
    imageFile: File
  ): Promise<ApiResponse> => {
    try {
      console.log("📤 Mulai upload shipping image...");
      console.log("🧾 Order ID:", orderId);
      console.log("📸 Image Type:", imageType);
      console.log("📁 File:", imageFile.name);

      const formData = new FormData();
      formData.append("image", imageFile);
      const response: AxiosResponse<{ imageUrl: string }> = await axios.post(
        `${API_BASE_URL}/api/shipping/images/${orderId}/${imageType}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log("✅ Upload sukses:", response.data);

      return {
        success: true,
        data: {
          ...response.data,
          imageUrl: response.data.imageUrl,
        },
        error: null,
      };
    } catch (error: any) {
      console.error("❌ Upload gagal:", error);
      return {
        success: false,
        data: null,
        error:
          error?.response?.data?.error ||
          error?.message ||
          "Gagal upload gambar ke server.",
      };
    }
  },

  // Mendapatkan gambar status pengiriman
  getShippingImages: async (
    orderId: string
  ): Promise<ShippingImagesResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/orders/${orderId}/shipping-images`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return { success: true, data: response.data.images || [], error: null };
    } catch (error: any) {
      console.error("Error getting shipping images:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil gambar pengiriman",
      };
    }
  },

  // Menghapus gambar status pengiriman
  deleteShippingImage: async (
    orderId: string,
    imageType: "siap_kirim" | "pengiriman" | "diterima"
  ): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await axios.delete(
        `${API_BASE_URL}/api/orders/${orderId}/shipping-images/${imageType}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error("Error deleting shipping image:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat menghapus gambar pengiriman",
      };
    }
  },

  // Update status pengiriman pesanan
  updateOrderShippingStatus: async (
    orderId: string,
    status: string
  ): Promise<ApiResponse> => {
    try {
      console.log(
        `🚚 Updating shipping status for order ${orderId} to: ${status}`
      );

      const payload: UpdateShippingStatusRequest = {
        status,
      };
      const response: AxiosResponse = await axios.put(
        `${API_BASE_URL}/api/orders/${orderId}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log("✅ Shipping status update response:", response.data);
      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error("❌ Error updating shipping status:", error);

      let errorMessage = "Error saat memperbarui status pengiriman";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        data: null,
        error: errorMessage,
      };
    }
  },

  // Login admin menggunakan backend authentication
  login: async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const payload: LoginRequest = { username, password };

      const response: AxiosResponse = await axios.post(
        `${API_BASE_URL}/auth/login`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;

      if (response.status === 200 && data.token) {
        // Store token
        localStorage.setItem("token", data.token);

        return {
          success: true,
          token: data.token,
          user: data.user,
          message: "Login berhasil",
        };
      } else {
        return {
          success: false,
          message: data.message || "Login gagal",
        };
      }
    } catch (error: any) {
      console.error("Login error:", error);
      return {
        success: false,
        message:
          error.response?.data?.message || error.message || "Network error",
      };
    }
  },

  // Logout admin
  logout: (): void => {
    localStorage.removeItem("token");
  },

  // Verifica si el usuario está autenticado como admin
  isAuthenticated: (): boolean => {
    return !!getAdminToken();
  },

  // Mengambil daftar lokasi (kode area)
  getLocations: async (): Promise<LocationsResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/locations`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data.locations || [],
        error: null,
      };
    } catch (error: any) {
      console.error("Error getting locations:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil daftar lokasi",
      };
    }
  },
  // get outlet locations
  getLocationsOutlet: async (): Promise<LocationsResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/outlets`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data.locations || [],
        error: null,
      };
    } catch (error: any) {
      console.error("Error getting locations:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil daftar lokasi",
      };
    }
  },

  // Get delivery orders for deliveryman
  getDeliveryOrders: async (): Promise<OrdersResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/orders/delivery`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error("Error getting delivery orders:", error);
      return {
        success: false,
        data: undefined,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil pesanan pengiriman",
      };
    }
  },

  // User management API endpoints

  // Get all users
  getUsers: async (): Promise<UsersResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_BASE_URL}/api/admin/users`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data.users || [],
        error: null,
      };
    } catch (error: any) {
      console.error("Error getting users:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil daftar user",
      };
    }
  },

  // Create new user
  createUser: async (
    userData: CreateUserRequest
  ): Promise<ApiResponse<User>> => {
    try {
      const response: AxiosResponse = await axios.post(
        `${API_BASE_URL}/api/admin/users`,
        userData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        error: null,
      };
    } catch (error: any) {
      console.error("Error creating user:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat membuat user baru",
      };
    }
  },

  // Update existing user
  updateUser: async (
    userId: string,
    userData: UpdateUserRequest
  ): Promise<ApiResponse<User>> => {
    try {
      const response: AxiosResponse = await axios.put(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        userData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        error: null,
      };
    } catch (error: any) {
      console.error("Error updating user:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengupdate user",
      };
    }
  },

  // Delete user
  deleteUser: async (userId: string): Promise<ApiResponse> => {
    try {
      console.log(`[DEBUG] Attempting to delete user with ID: ${userId}`);

      const encodedUserId = encodeURIComponent(userId);
      console.log(`[DEBUG] Encoded userId: ${encodedUserId}`);

      const url = `${API_BASE_URL}/api/admin/users/${encodedUserId}`;
      console.log(`[DEBUG] DELETE URL: ${url}`);

      const response: AxiosResponse = await axios.delete(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      console.log(`[DEBUG] Delete user response:`, response.data);

      return {
        success: true,
        data: response.data,
        error: null,
      };
    } catch (error: any) {
      console.error("[ERROR] Error deleting user:", error);
      console.error("[ERROR] Error response:", error.response?.data);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat menghapus user",
      };
    }
  },

  // Reset user password
  resetPassword: async (
    userId: string,
    newPassword: string
  ): Promise<ApiResponse> => {
    try {
      const payload: ResetPasswordRequest = { password: newPassword };

      const response: AxiosResponse = await axios.post(
        `${API_BASE_URL}/api/admin/users/${userId}/reset-password`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        error: null,
      };
    } catch (error: any) {
      console.error("Error resetting password:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat reset password user",
      };
    }
  },
};

export default adminApi;
