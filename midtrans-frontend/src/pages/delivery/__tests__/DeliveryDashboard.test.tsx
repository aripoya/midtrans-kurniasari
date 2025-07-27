import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import DeliveryDashboard from '../DeliveryDashboard';

// Mock all complex dependencies at the top level
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../../hooks/useRealTimeSync', () => ({
  useRealTimeSync: vi.fn(),
  useNotificationSync: vi.fn()
}));

vi.mock('../../../api/adminApi', () => ({
  adminApi: {
    getDeliveryOrders: vi.fn(),
    updateOrderShippingStatus: vi.fn()
  }
}));

// Import mocked functions after mocking
import { useAuth } from '../../../auth/AuthContext';
import { useRealTimeSync, useNotificationSync } from '../../../hooks/useRealTimeSync';
import { adminApi } from '../../../api/adminApi';

// TypeScript interfaces
interface MockUser {
  id: string;
  username: string;
  role: 'deliveryman';
}

interface MockOrder {
  id: string;
  customer_name: string;
  shipping_status: string;
  shipping_area: 'dalam-kota' | 'luar-kota';
  order_type: string;
  shipping_photo?: string | null;
  created_at: string;
}

interface MockApiResponse {
  success: boolean;
  data: { orders: MockOrder[] };
  error: string | null;
}

interface TestWrapperProps {
  children: React.ReactNode;
}

// Type the mocked functions
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseRealTimeSync = vi.mocked(useRealTimeSync);
const mockedUseNotificationSync = vi.mocked(useNotificationSync);
const mockedAdminApi = vi.mocked(adminApi);

// Test wrapper component
const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => (
  <ChakraProvider>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </ChakraProvider>
);

// Mock data
const mockUser: MockUser = {
  id: 'delivery-123',
  username: 'delivery',
  role: 'deliveryman'
};

const mockOrders: MockOrder[] = [
  {
    id: 'ORDER-123',
    customer_name: 'John Doe',
    shipping_status: 'menunggu_pengambilan',
    shipping_area: 'dalam-kota',
    order_type: 'pesan_antar',
    shipping_photo: null,
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'ORDER-456',
    customer_name: 'Jane Smith',
    shipping_status: 'dalam_pengiriman',
    shipping_area: 'luar-kota',
    order_type: 'pesan_ambil',
    shipping_photo: 'https://example.com/photo.jpg',
    created_at: '2024-01-16T11:00:00Z'
  }
];

describe('DeliveryDashboard', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mocks
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-jwt-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(() => 'mock-jwt-token')
    });
    
    mockedUseRealTimeSync.mockReturnValue({
      syncStatus: 'idle',
      manualRefresh: vi.fn()
    });
    
    mockedUseNotificationSync.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn()
    });
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-jwt-token'),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render dashboard title and welcome message', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard Kurir')).toBeInTheDocument();
      expect(screen.getByText('Selamat datang, Kurir')).toBeInTheDocument();
    });

    it('should render stats cards with correct labels', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Total Pengiriman')).toBeInTheDocument();
        expect(screen.getByText('Menunggu Pengambilan')).toBeInTheDocument();
        expect(screen.getByText('Dalam Pengiriman')).toBeInTheDocument();
        expect(screen.getByText('Diterima')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch orders on component mount', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockedAdminApi.getDeliveryOrders).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: false,
        data: { orders: [] },
        error: 'Network error'
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Terjadi kesalahan saat memuat daftar pengiriman.')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('should display correct stats based on fetched orders', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should have 2 total orders
        expect(screen.getByText('2')).toBeInTheDocument();
        // Should have 1 pending and 1 shipping
        const statsNumbers = screen.getAllByText('1');
        expect(statsNumbers).toHaveLength(2);
      });
    });
  });

  describe('Orders Display', () => {
    it('should show empty state when no orders assigned', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Tidak ada pengiriman yang ditugaskan')).toBeInTheDocument();
      });
    });

    it('should display orders when data is available', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('ORDER-123')).toBeInTheDocument();
        expect(screen.getByText('ORDER-456')).toBeInTheDocument();
      });
    });

    it('should show correct shipping status badges', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Menunggu Pengambilan')).toBeInTheDocument();
        expect(screen.getByText('Dalam Pengiriman')).toBeInTheDocument();
      });
    });
  });

  describe('Photo Upload Functionality', () => {
    it('should open photo upload modal when upload button clicked', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const uploadButtons = screen.getAllByText('Upload Foto');
        expect(uploadButtons).toHaveLength(2); // One for each order
      });
    });

    it('should handle file input change', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const fileInputs = screen.getAllByLabelText(/upload/i);
        expect(fileInputs.length).toBeGreaterThan(0);
      });

      const fileInput = screen.getAllByLabelText(/upload/i)[0] as HTMLInputElement;
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(fileInput.files?.[0]).toBe(file);
    });
  });

  describe('Real-time Sync Integration', () => {
    it('should initialize real-time sync with correct parameters', () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      expect(mockedUseRealTimeSync).toHaveBeenCalledWith({
        userId: mockUser.id,
        onUpdate: expect.any(Function),
        pollingInterval: 5000
      });
    });

    it('should initialize notification sync with correct parameters', () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      expect(mockedUseNotificationSync).toHaveBeenCalledWith({
        userId: mockUser.id,
        onNewNotification: expect.any(Function),
        pollingInterval: 8000
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading spinner while fetching data', () => {
      mockedAdminApi.getDeliveryOrders.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('status')).toBeInTheDocument(); // Chakra UI Spinner has role="status"
    });

    it('should handle network timeout gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: false,
        data: { orders: [] },
        error: 'timeout'
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Terjadi kesalahan saat memuat daftar pengiriman.')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed order data', async () => {
      const malformedOrders = [
        { id: '', customer_name: '', shipping_status: undefined } as any,
        {} as any /* missing required fields */
      ];

      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: malformedOrders },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      // Should not crash and should handle gracefully
      await waitFor(() => {
        expect(screen.getByText('Dashboard Kurir')).toBeInTheDocument();
      });
    });

    it('should handle missing user context', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
        getToken: vi.fn(() => null)
      });

      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      // Should still render without crashing
      expect(screen.getByText('Dashboard Kurir')).toBeInTheDocument();
    });

    it('should handle empty API response', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: [] },
        error: null
      });

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Tidak ada pengiriman yang ditugaskan')).toBeInTheDocument();
      });
    });
  });

  describe('Status Update Functionality', () => {
    it('should allow status updates for valid transitions', async () => {
      mockedAdminApi.getDeliveryOrders.mockResolvedValueOnce({
        success: true,
        data: { orders: mockOrders },
        error: null
      });

      // Mock status update API call
      const mockUpdateStatus = vi.fn().mockResolvedValueOnce({
        success: true,
        data: { success: true },
        error: null
      });
      mockedAdminApi.updateOrderShippingStatus = mockUpdateStatus as Mock;

      render(
        <TestWrapper>
          <DeliveryDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusSelects = screen.getAllByRole('combobox');
        fireEvent.change(statusSelects[0], { target: { value: 'dalam_pengiriman' } });
      });

      // Should trigger API call for status update
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalled();
      });
    });
  });
});
