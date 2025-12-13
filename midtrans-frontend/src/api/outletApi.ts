import axios, { AxiosError, AxiosResponse } from 'axios';
import { API_URL } from './config';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface OutletMonthlyTrendRow {
  month: string;
  count: number;
  revenue: number;
  revenue_formatted: string;
}

export interface OutletWeeklyRow {
  week: string;
  week_start: string;
  week_end: string;
  count: number;
  revenue: number;
  revenue_formatted: string;
}

export interface OutletOrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  total_amount: number;
  total_amount_formatted?: string;
  payment_status: string;
  shipping_status: string;
  pickup_method?: string;
  courier_service?: string;
  lokasi_pengambilan?: string;
  lokasi_pengiriman?: string;
  created_at: string;
  updated_at?: string;
}

const getToken = (): string | null => {
  const local = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  return local || session;
};

export const outletApi = {
  getMonthlyTrend: async (): Promise<ApiResponse<{ monthly_trend: OutletMonthlyTrendRow[] }>> => {
    try {
      const token = getToken();
      if (!token) {
        return { success: false, data: null, error: 'No token available' };
      }

      const response: AxiosResponse = await axios.get(`${API_URL}/api/outlet/report?type=monthly`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success) {
        return { success: true, data: response.data.data, error: null };
      }

      return { success: false, data: null, error: response.data?.error || 'Failed to load monthly trend' };
    } catch (error: any) {
      const err = error as AxiosError<any>;
      return {
        success: false,
        data: null,
        error: err.response?.data?.error || err.message || 'Failed to load monthly trend',
      };
    }
  },

  getWeeklyBreakdown: async (year: number, month: number): Promise<ApiResponse<OutletWeeklyRow[]>> => {
    try {
      const token = getToken();
      if (!token) {
        return { success: false, data: null, error: 'No token available' };
      }

      const response: AxiosResponse = await axios.get(
        `${API_URL}/api/outlet/report?type=weekly&year=${year}&month=${month}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        return { success: true, data: response.data.data, error: null };
      }

      return { success: false, data: null, error: response.data?.error || 'Failed to load weekly breakdown' };
    } catch (error: any) {
      const err = error as AxiosError<any>;
      return {
        success: false,
        data: null,
        error: err.response?.data?.error || err.message || 'Failed to load weekly breakdown',
      };
    }
  },

  getOrders: async (options: {
    offset?: number;
    limit?: number;
    payment_status?: string;
    shipping_status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  } = {}): Promise<ApiResponse<any>> => {
    try {
      const token = getToken();
      if (!token) {
        return { success: false, data: null, error: 'No token available' };
      }

      const params = new URLSearchParams({ type: 'orders' });
      if (options.offset !== undefined) params.append('offset', String(options.offset));
      if (options.limit !== undefined) params.append('limit', String(options.limit));
      if (options.payment_status) params.append('payment_status', options.payment_status);
      if (options.shipping_status) params.append('shipping_status', options.shipping_status);
      if (options.date_from) params.append('date_from', options.date_from);
      if (options.date_to) params.append('date_to', options.date_to);
      if (options.search) params.append('search', options.search);

      const response: AxiosResponse = await axios.get(`${API_URL}/api/outlet/report?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success) {
        return { success: true, data: response.data, error: null };
      }

      return { success: false, data: null, error: response.data?.error || 'Failed to load orders' };
    } catch (error: any) {
      const err = error as AxiosError<any>;
      return {
        success: false,
        data: null,
        error: err.response?.data?.error || err.message || 'Failed to load orders',
      };
    }
  },
};
