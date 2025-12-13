import axios, { AxiosResponse, AxiosError } from "axios";
import { API_URL } from "./config";


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
  customer_phone: string;
  customer_email?: string;
  total_amount: number;
  payment_status: string;
  shipping_status: string;
  admin_note?: string;
  created_at: string;
  payment_method?: string;
  shipping_area?: 'dalam-kota' | 'luar-kota';
  pickup_method?: 'deliveryman' | 'ojek-online' | 'self-pickup';
  lokasi_pengiriman?: string;
  lokasi_pengambilan?: string;
  pickup_location?: string;
  tipe_pesanan?: string;
  courier_service?: string;
  tracking_number?: string;
  updated_at?: string;
  items?: any[];
  assigned_deliveryman_id?: string;
  created_by_admin_id?: string;
  created_by_admin_name?: string;
  // Pickup detail fields
  picked_up_by?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  // Delivery scheduling fields
  delivery_date?: string | null;
  delivery_time?: string | null;
}

export interface ShippingImage {
  id: string;
  order_id: string;
  image_type: "siap_kirim" | "pengiriman" | "diterima";
  image_url: string;
  created_at: string;
}

export interface AdminActivity {
  id: number;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  activity_type: string;
  description: string;
  order_id?: string;
  ip_address: string;
  created_at: string;
}

export interface AdminSession {
  session_id: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  ip_address: string;
  login_at: string;
  last_activity: string;
}

export interface AdminStats {
  today: {
    total_activities: number;
    logins: number;
    orders_created: number;
    orders_updated: number;
  };
  active_sessions: number;
  recent_orders: AdminActivity[];
}

export interface Outlet {
  id: string;
  name: string;
  location?: string;
  is_active?: boolean;
  location_alias?: string;
  address?: string;
  status?: string;
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
  data: { [imageType: string]: { url: string; imageId: string | null; variants: any } } | null;
  error: string | null;
}

export interface OutletsResponse {
  success: boolean;
  outlets?: Outlet[];
  data?: Outlet[];
  error?: string | null;
}

// Safe migration interfaces
export interface SafeMigrationStatistics {
  unifiedOutlets?: number;
  ordersLinked?: number;
  usersLinked?: number;
  ordersUpdated?: number;
  usersUpdated?: number;
}

export interface SafeMigrationStatus {
  hasUnifiedStructure: boolean;
  statistics?: SafeMigrationStatistics;
  sampleOutlets?: any[];
  migrationMethod?: string;
}

export interface MigrateSafeDbOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface SafeMigrationStartResult {
  success: boolean;
  statistics?: SafeMigrationStatistics;
  tablesCreated?: string[];
  skippedRecreate?: boolean;
  options?: MigrateSafeDbOptions;
  message?: string;
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
  pickup_method?: 'deliveryman' | 'ojek-online' | 'self-pickup';
  courier_service?: string;
  tracking_number?: string;
  lokasi_pengambilan?: string;
  lokasi_pengiriman?: string; // Customer address for delivery destination
  tipe_pesanan?: string;
  // Pickup details for Pesan Ambil
  picked_up_by?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  // Delivery scheduling for Pesan Antar
  delivery_date?: string | null;
  delivery_time?: string | null;
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

export interface SyncPaymentStatusResponse {
  payment_status?: string;
  transaction_status?: string;
  midtrans_response?: any;
}

// Helper function to get admin token
// Prefer localStorage (used by login), fallback to sessionStorage for compatibility
const getAdminToken = (): string | null => {
  const local = typeof localStorage !== 'undefined' ? localStorage.getItem("token") : null;
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("token") : null;
  const token = local || session;
  console.log(
    "[DEBUG] Retrieved token:",
    token ? "Token exists" : "No token found",
    `source=${local ? 'localStorage' : session ? 'sessionStorage' : 'none'}`
  );
  return token;
};

// Admin API endpoints with full TypeScript support
export const adminApi = {
  // Get order details by ID
  getOrderDetails: async (orderId: string): Promise<OrderResponse> => {
    try {
      console.log(
        `🔍 Getting order details for ID: ${orderId} from ${API_URL}`
      );

      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/orders/${orderId}`,
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

  syncPaymentStatusFromMidtrans: async (orderId: string): Promise<ApiResponse<SyncPaymentStatusResponse>> => {
    try {
      const token = getAdminToken();
      if (!token) {
        return {
          success: false,
          data: null,
          error: "Sesi login berakhir. Silakan login ulang.",
        };
      }

      const response: AxiosResponse = await axios.post(
        `${API_URL}/api/admin/orders/${orderId}/sync-payment-status`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data: any = response.data;
      if (data?.success === false) {
        return { success: false, data: null, error: data?.error || 'Gagal sinkron status pembayaran' };
      }

      return {
        success: true,
        data: {
          payment_status: data?.payment_status,
          transaction_status: data?.transaction_status,
          midtrans_response: data?.midtrans_response,
        },
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat sinkron status pembayaran",
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
        `${API_URL}/api/orders/${orderId}/status`,
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

  // Update detail pesanan termasuk status pesanan, area pengiriman dan metode pengambilan
  updateOrderDetails: async (
    orderId: string,
    shippingData: UpdateOrderDetailsRequest
  ): Promise<ApiResponse> => {
    try {
      // Ensure we have a valid token before attempting the request
      const token = getAdminToken();
      if (!token) {
        console.warn("updateOrderDetails: No token found. Please login again.");
        return {
          success: false,
          data: null,
          error: "Sesi login berakhir. Silakan login ulang.",
        };
      }
      // Debug logs untuk membantu troubleshooting
      console.group("updateOrderDetails - Request Details");
      console.log("Order ID:", orderId);
      console.log("API URL:", `${API_URL}/api/orders/${orderId}`);
      console.log("Request Payload:", JSON.stringify(shippingData, null, 2));
      console.groupEnd();

      // Attempt PATCH first
      try {
        const response: AxiosResponse = await axios.patch(
          `${API_URL}/api/orders/${orderId}`,
          shippingData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("updateOrderDetails (PATCH) - Response:", response.data);
        return { success: true, data: response.data, error: null };
      } catch (patchErr: any) {
        const status = patchErr?.response?.status;
        console.warn("updateOrderDetails (PATCH) failed with status:", status, patchErr?.response?.data || patchErr?.message);
        // Fallback to PUT for environments where PATCH might be blocked or misrouted
        if (status === 401 || status === 404 || status === 405) {
          console.info("updateOrderDetails: Trying PUT fallback...");
          const putResp: AxiosResponse = await axios.put(
            `${API_URL}/api/orders/${orderId}`,
            shippingData,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          console.log("updateOrderDetails (PUT) - Response:", putResp.data);
          return { success: true, data: putResp.data, error: null };
        }
        // If not a known fallback case, rethrow to outer catch
        throw patchErr;
      }
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
          (error.response?.status === 401 ? "Sesi login berakhir. Silakan login ulang." : null) ||
          error.message ||
          "Error saat memperbarui detail pesanan",
      };
    }
  },

  // Mendapatkan daftar lengkap pesanan untuk admin
  getAdminOrders: async (
    offset: number = 0,
    limit: number = 50,
    search: string = ''
  ): Promise<OrdersResponse> => {
    try {
      console.log("[DEBUG] Fetching admin orders...");
      console.log("[DEBUG] Using endpoint:", `${API_URL}/api/orders/admin`);
      console.log("[DEBUG] Token:", getAdminToken() ? "Present" : "Missing");
      console.log("[DEBUG] Search term:", search);

      const params: any = {
        offset,
        limit,
      };
      
      if (search.trim()) {
        params.search = search.trim();
      }

      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/orders/admin`,
        {
          params,
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
        const pagination = response.data.pagination || {};
        console.log("[DEBUG] Found orders array with length:", orders.length);
        console.log("[DEBUG] Pagination data:", pagination);
        return {
          success: true,
          data: {
            orders,
            total: pagination.total || response.data.total || orders.length,
            offset: pagination.offset || response.data.offset || offset,
            limit: pagination.limit || response.data.limit || limit,
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
        `${API_URL}/api/orders/${orderId}`,
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

  // Upload gambar status pesanan
  uploadShippingImage: async (
    orderId: string,
    imageType: "ready_for_pickup" | "picked_up" | "delivered" | "shipment_proof" | "packaged_product",
    imageFile: File
  ): Promise<ApiResponse> => {
    try {
      console.log("📤 Mulai upload shipping image...");
      console.log("🧾 Order ID:", orderId);
      console.log("📸 Image Type:", imageType);
      console.log("📁 File:", imageFile.name);

      // Backend hanya menerima imageType: siap_kirim, pengiriman, diterima, shipment_proof
      // Lakukan mapping dari nilai di frontend ke nilai backend yang valid
      const backendImageTypeMap: Record<string, string> = {
        ready_for_pickup: "siap_kirim",
        picked_up: "pengiriman",
        delivered: "diterima",
        shipment_proof: "shipment_proof",
        packaged_product: "siap_kirim",
      };

      const mappedImageType = backendImageTypeMap[imageType] || imageType;

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("imageType", mappedImageType);
      const response: AxiosResponse<any> = await axios.post(
        `${API_URL}/api/orders/${orderId}/shipping-images`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log("✅ Upload sukses:", response.data);

      // Backend returns { success: true, data: { imageUrl, imageId, ... } }
      const responseData = response.data;
      console.log("✅ Response data success:", responseData.success);
      console.log("✅ Response data type:", typeof responseData.success);
      
      const imageUrl = responseData.data?.imageUrl || responseData.imageUrl;
      
      // Check if backend actually returned success=true (be more lenient)
      if (responseData.success === true || responseData.success === "true") {
        console.log("✅ Upload confirmed successful, returning success response");
        return {
          success: true,
          data: {
            imageUrl: imageUrl,
            ...responseData.data,
          },
          error: null,
        };
      } else {
        console.log("❌ Backend success flag was:", responseData.success);
        throw new Error(responseData.error || `Backend reported upload failure. Success flag: ${responseData.success}`);
      }
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

  // Mendapatkan gambar status pesanan
  getShippingImages: async (
    orderId: string
  ): Promise<ShippingImagesResponse> => {
    try {
      console.log(`🔍 [adminApi.getShippingImages] Fetching images for order: ${orderId}`);
      
      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/orders/${orderId}/shipping-images`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      console.log(`📥 [adminApi.getShippingImages] Backend response:`, response.data);

      // Handle the backend response structure: { success: true, data: formattedImages }
      // Backend returns an object with image types as keys
      let images = {};
      if (response.data?.data && typeof response.data.data === 'object') {
        images = response.data.data;
        const imageCount = Object.keys(images).length;
        console.log(`✅ [adminApi.getShippingImages] Found ${imageCount} images from backend`);
        console.log(`Image types:`, Object.keys(images));
      } else {
        console.log(`⚠️ [adminApi.getShippingImages] No images found or unrecognized format`);
        console.log(`Backend response:`, response.data);
      }

      return { success: true, data: images, error: null };
    } catch (error: any) {
      console.error("❌ [adminApi.getShippingImages] Error getting shipping images:", error);
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

  // Menghapus gambar status pesanan
  deleteShippingImage: async (
    orderId: string,
    imageType: "siap_kirim" | "pengiriman" | "diterima"
  ): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await axios.delete(
        `${API_URL}/api/orders/${orderId}/shipping-images/${imageType}`,
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

  // Update status pesanan pesanan
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
        `${API_URL}/api/orders/${orderId}`,
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

      let errorMessage = "Error saat memperbarui status pesanan";
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
        `${API_URL}/auth/login`,
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


  // Get delivery orders for deliveryman
  getDeliveryOrders: async (): Promise<OrdersResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/orders/delivery?_t=${Date.now()}`,
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

  // Delivery overview: grouped by deliveryman + unassigned
  getDeliveryOverview: async (status?: string): Promise<ApiResponse<any>> => {
    try {
      const params: any = {};
      if (status) params.status = status;
      // cache-busting to ensure fresh data in dashboards
      params.t = Date.now();
      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/delivery/overview`,
        {
          params,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error('Error getting delivery overview:', error);
      return {
        success: false,
        data: null,
        error: error.response?.data?.error || error.message || 'Error saat mengambil delivery overview',
      };
    }
  },

  // Unassign delivery from the current deliveryman (courier self-service)
  unassignDelivery: async (
    orderId: string,
    reason?: string
  ): Promise<ApiResponse> => {
    try {
      const payload = reason ? { reason } : {};
      const response: AxiosResponse = await axios.post(
        `${API_URL}/api/orders/${orderId}/unassign-delivery`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      return { success: true, data: response.data, error: null };
    } catch (error: any) {
      console.error('Error unassigning delivery:', error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          'Error saat melepas penugasan kurir',
      };
    }
  },

  // User management API endpoints

  // Get all users
  getUsers: async (): Promise<UsersResponse> => {
    try {
      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/admin/users`,
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
        `${API_URL}/api/admin/users`,
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
        `${API_URL}/api/admin/users/${userId}`,
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

      const url = `${API_URL}/api/admin/users/${encodedUserId}`;
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
  resetPassword(
    userId: string,
    newPassword: string
  ): Promise<ApiResponse> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .post(
        `${API_URL}/api/admin/users/${userId}/reset-password`,
        { password: newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then((response: AxiosResponse<ApiResponse>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error resetting user password:", error);
        return {
          success: false,
          data: null,
          error:
            error.response?.data?.error ||
            error.message ||
            "Error saat reset password user",
        };
      });
  },

  // Get all unified outlets for admin
  getUnifiedOutlets(): Promise<OutletsResponse> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: [],
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/outlets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<OutletsResponse>) => {
        return response.data;
      })
      .catch(async (error) => {
        const status = error?.response?.status;
        console.warn("[adminApi.getUnifiedOutlets] Primary endpoint failed:", status || error?.message);
        // Fallback to public/compat endpoint when 404 (not found) or 401 (unauthorized/middleware mismatch)
        if (status === 404 || status === 401) {
          try {
            console.info("[adminApi.getUnifiedOutlets] Trying fallback /api/outlets ...");
            const fallbackResp: AxiosResponse<any> = await axios.get(
              `${API_URL}/api/outlets`,
              {
                headers: {
                  // Authorization header is optional for the public fallback; include if available
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  "Content-Type": "application/json",
                },
              }
            );
            // Normalize response to OutletsResponse shape
            const data = Array.isArray(fallbackResp.data?.data)
              ? fallbackResp.data.data
              : Array.isArray(fallbackResp.data)
              ? fallbackResp.data
              : [];
            return { success: true, data, error: null } as OutletsResponse;
          } catch (fbErr: any) {
            console.error("[adminApi.getUnifiedOutlets] Fallback /api/outlets failed:", fbErr);
            return {
              success: false,
              data: [],
              error:
                fbErr?.response?.data?.error || fbErr?.message || "Error getting outlets (fallback)",
            } as OutletsResponse;
          }
        }
        return {
          success: false,
          data: [],
          error:
            error.response?.data?.error || error.message || "Error getting unified outlets",
        } as OutletsResponse;
      });
  },

  // Get all outlets for admin
  getOutlets(): Promise<OutletsResponse> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        outlets: [],
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/outlets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<OutletsResponse>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error getting outlets:", error);
        return {
          success: false,
          outlets: [],
          error: error.response?.data?.error || error.message || "Error getting outlets",
        };
      });
  },

  // Admin Activity Methods
  getAdminActivity(filters: {
    admin_id?: string;
    activity_type?: string;
    date_from?: string;
    date_to?: string;
    limit?: string;
  } = {}): Promise<ApiResponse<AdminActivity[]>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });

    return axios
      .get(`${API_URL}/api/admin/activity?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<ApiResponse<AdminActivity[]>>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error getting admin activity:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting admin activity",
        };
      });
  },

  getActiveSessions(): Promise<ApiResponse<AdminSession[]>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<ApiResponse<AdminSession[]>>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error getting active sessions:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting active sessions",
        };
      });
  },

  getAdminStats(): Promise<ApiResponse<AdminStats>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<ApiResponse<AdminStats>>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error getting admin stats:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting admin stats",
        };
      });
  },

  getRevenueStats(period: 'monthly' | 'weekly' = 'monthly'): Promise<ApiResponse<any[]>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/revenue-stats?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response: AxiosResponse<ApiResponse<any[]>>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error getting revenue stats:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting revenue stats",
        };
      });
  },

  getLuarKotaStats(): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/luar-kota-report?type=stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting luar kota stats:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting luar kota stats",
        };
      });
  },

  getLuarKotaOrders(options: {
    offset?: number;
    limit?: number;
    payment_status?: string;
    shipping_status?: string;
    courier_service?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  } = {}): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    // Build query parameters
    const params = new URLSearchParams({ type: 'orders' });
    if (options.offset !== undefined) params.append('offset', String(options.offset));
    if (options.limit !== undefined) params.append('limit', String(options.limit));
    if (options.payment_status) params.append('payment_status', options.payment_status);
    if (options.shipping_status) params.append('shipping_status', options.shipping_status);
    if (options.courier_service) params.append('courier_service', options.courier_service);
    if (options.date_from) params.append('date_from', options.date_from);
    if (options.date_to) params.append('date_to', options.date_to);
    if (options.search) params.append('search', options.search);

    return axios
      .get(`${API_URL}/api/admin/luar-kota-report?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting luar kota orders:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting luar kota orders",
        };
      });
  },

  getLuarKotaWeeklyBreakdown(year: number, month: number): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/luar-kota-report?type=weekly&year=${year}&month=${month}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting weekly breakdown:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting weekly breakdown",
        };
      });
  },

  getDalamKotaStats(): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/dalam-kota-report?type=stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting dalam kota stats:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting dalam kota stats",
        };
      });
  },

  getDalamKotaOrders(options: {
    offset?: number;
    limit?: number;
    payment_status?: string;
    shipping_status?: string;
    pickup_method?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  } = {}): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    // Build query parameters
    const params = new URLSearchParams({ type: 'orders' });
    if (options.offset !== undefined) params.append('offset', String(options.offset));
    if (options.limit !== undefined) params.append('limit', String(options.limit));
    if (options.payment_status) params.append('payment_status', options.payment_status);
    if (options.shipping_status) params.append('shipping_status', options.shipping_status);
    if (options.pickup_method) params.append('pickup_method', options.pickup_method);
    if (options.date_from) params.append('date_from', options.date_from);
    if (options.date_to) params.append('date_to', options.date_to);
    if (options.search) params.append('search', options.search);

    return axios
      .get(`${API_URL}/api/admin/dalam-kota-report?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting dalam kota orders:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting dalam kota orders",
        };
      });
  },

  getDalamKotaWeeklyBreakdown(year: number, month: number): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .get(`${API_URL}/api/admin/dalam-kota-report?type=weekly&year=${year}&month=${month}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ApiResponse<any>>) => {
        console.error("Error getting weekly breakdown:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error getting weekly breakdown",
        };
      });
  },

  logoutAdmin(sessionId?: string, adminId?: string): Promise<ApiResponse<any>> {
    const token = getAdminToken();
    if (!token) {
      return Promise.resolve({
        success: false,
        data: null,
        error: "No admin token available",
      });
    }

    return axios
      .post(`${API_URL}/api/admin/logout`, 
        { sessionId, adminId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then((response: AxiosResponse<ApiResponse<any>>) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error during admin logout:", error);
        return {
          success: false,
          data: null,
          error: error.response?.data?.error || error.message || "Error during logout",
        };
      });
  },
  // Safe migration endpoints
  startSafeMigration: async (
    options: MigrateSafeDbOptions = {}
  ): Promise<ApiResponse<SafeMigrationStartResult>> => {
    try {
      console.log("[SAFE-MIGRATION] Triggering migration with options:", options);
      const response: AxiosResponse = await axios.post(
        `${API_URL}/api/admin/migrate-safe-db`,
        options,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      const data: SafeMigrationStartResult = response.data;
      return { success: true, data, error: null };
    } catch (error: any) {
      console.error("[SAFE-MIGRATION] Error starting migration:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat memulai safe migration",
      };
    }
  },
 
  getSafeMigrationStatus: async (): Promise<ApiResponse<SafeMigrationStatus>> => {
    try {
      console.log("[SAFE-MIGRATION] Fetching migration status...");
      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/admin/safe-migration-status`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      let data: SafeMigrationStatus | null = null;
      if (response.data?.success && response.data?.data) {
        data = response.data.data as SafeMigrationStatus;
      } else if (response.data) {
        data = response.data as SafeMigrationStatus;
      }
      return { success: true, data, error: null };
    } catch (error: any) {
      console.error("[SAFE-MIGRATION] Error fetching status:", error);
      return {
        success: false,
        data: null,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error saat mengambil status safe migration",
      };
    }
  },
};

export default adminApi;
