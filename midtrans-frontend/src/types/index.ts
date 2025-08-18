// ==================== USER & AUTHENTICATION TYPES ====================

export type UserRole = 'admin' | 'outlet_manager' | 'deliveryman';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  outlet_id?: string; // Required for outlet_manager and deliveryman
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
}

// ==================== ORDER TYPES ====================

export type ShippingStatus = 
  | 'pending' 
  | 'dikemas' 
  | 'siap kirim' 
  | 'dalam_pengiriman' 
  | 'diterima';

export type ShippingArea = 'dalam-kota' | 'luar-kota';

export type OrderType = 'Pesan Antar' | 'Pesan Ambil';

export type PickupMethod = 'deliveryman' | 'customer';

export interface Order {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  total_amount: number;
  payment_status: string;
  payment_link?: string;
  snap_token?: string;
  created_at: string;
  updated_at: string;
  tracking_number?: string;
  courier_service?: string;
  
  // Location & shipping
  lokasi_pengiriman: string;
  lokasi_pengambilan?: string;
  shipping_area: ShippingArea;
  shipping_status: ShippingStatus;
  
  // Order details
  tipe_pesanan: OrderType;
  pickup_method?: PickupMethod;
  order_status: string;
  
  // Assignments
  outlet_id?: string;
  assigned_deliveryman_id?: string;
  courier_name?: string;
  admin_note?: string;
  
  // Photos
  readyForPickup_photo_url?: string;
  pickedUp_photo_url?: string;
  delivered_photo_url?: string;
  
  // Metadata
  payment_response?: string;
  outlet_name?: string; // Joined from outlets table
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
}

export interface OrderStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export interface OutletOrdersResponse extends OrdersResponse {
  stats: OrderStats;
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  stats: OrderStats;
}

// ==================== PHOTO UPLOAD TYPES ====================

export interface PhotoUploadRequest {
  orderId: string;
  photoType: 'readyForPickup' | 'pickedUp' | 'delivered';
  file: File;
}

export interface PhotoUploadResponse {
  success: boolean;
  imageUrl: string;
  cloudflareImageId?: string;
  message?: string;
}

// ==================== OUTLET TYPES ====================

export interface Outlet {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

// ==================== SYNC TYPES ====================

export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

// ==================== FORM TYPES ====================

export interface OrderUpdateRequest {
  shipping_status?: ShippingStatus;
  shipping_area?: ShippingArea;
  tracking_number?: string;
}
