import React from 'react';
import './App.css';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Contexts
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import PublicLayout from './components/PublicLayout';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CartProvider } from './contexts/CartContext';

// Page Components (.tsx)
import OrdersPage from './pages/OrdersPage';
import NewOrderPage from './pages/NewOrderPage';
import OrderDetailPage from './pages/OrderDetailPage.tsx';
import PublicOrderDetailPage from './pages/PublicOrderDetailPage';
import ProductsPage from './pages/ProductsPage';
import DebugPage from './pages/DebugPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import LuarKotaReportPage from './pages/admin/LuarKotaReportPage';
import DalamKotaReportPage from './pages/admin/DalamKotaReportPage';
import DalamKotaWeeklyReportPage from './pages/admin/DalamKotaWeeklyReportPage';
import DalamKotaWeeklyOrdersPage from './pages/admin/DalamKotaWeeklyOrdersPage';
import LuarKotaWeeklyReportPage from './pages/admin/LuarKotaWeeklyReportPage';
import LuarKotaWeeklyOrdersPage from './pages/admin/LuarKotaWeeklyOrdersPage';
import SafeMigrationPage from './pages/admin/SafeMigrationPage';
import OutletDashboard from './pages/outlet/OutletDashboard';
import OutletAdminView from './pages/outlet/OutletAdminView';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import DeliveryCalendar from './pages/delivery/DeliveryCalendar';
import DebugNotificationPage from './pages/DebugNotificationPage';
import TIKITrackingPage from './components/TIKITrackingPage';
import JNETrackingPage from './components/JNETrackingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';

// Route Protection
import RoleProtectedRoute from './auth/RoleProtectedRoute';

const App: React.FC = () => {
  return (
    <ChakraProvider>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <Routes>
                {/* Login Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin/login" element={<LoginPage />} />

                {/* Root redirection */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Public Routes - No Auth Required */}
                <Route path="/order/:id" element={<PublicLayout><PublicOrderDetailPage /></PublicLayout>} />
                <Route path="/orders/:id" element={<PublicLayout><PublicOrderDetailPage /></PublicLayout>} />
                <Route path="/orders" element={<PublicLayout><OrdersPage /></PublicLayout>} />
                <Route path="/payment/success/:id" element={<PublicLayout><PaymentSuccessPage /></PublicLayout>} />
                <Route path="/payment/success" element={<PublicLayout><PaymentSuccessPage /></PublicLayout>} />
                <Route path="/tiki-tracking" element={<PublicLayout><TIKITrackingPage /></PublicLayout>} />
                <Route path="/jne-tracking" element={<PublicLayout><JNETrackingPage /></PublicLayout>} />

                {/* Admin Routes */}
                <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin']}><AdminLayout /></RoleProtectedRoute>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="orders/new" element={<NewOrderPage />} />
                  <Route path="orders/:id" element={<AdminOrderDetailPage />} />
                  <Route path="users" element={<UserManagementPage />} />
                  <Route path="activity" element={<AdminActivityPage />} />
                  <Route path="dalam-kota-report" element={<DalamKotaReportPage />} />
                  <Route path="dalam-kota-report/weekly/:year/:month" element={<DalamKotaWeeklyReportPage />} />
                  <Route path="dalam-kota-report/weekly/:year/:month/orders" element={<DalamKotaWeeklyOrdersPage />} />
                  <Route path="luar-kota-report" element={<LuarKotaReportPage />} />
                  <Route path="luar-kota-report/weekly/:year/:month" element={<LuarKotaWeeklyReportPage />} />
                  <Route path="luar-kota-report/weekly/:year/:month/orders" element={<LuarKotaWeeklyOrdersPage />} />
                  <Route path="safe-migration" element={<SafeMigrationPage />} />
                </Route>

                {/* Outlet Manager Routes */}
                <Route path="/outlet/dashboard" element={<RoleProtectedRoute allowedRoles={['outlet_manager']}><Layout><OutletDashboard /></Layout></RoleProtectedRoute>} />
                <Route path="/outlet/admin" element={<RoleProtectedRoute allowedRoles={['outlet_manager']}><Layout><OutletAdminView /></Layout></RoleProtectedRoute>} />
                <Route path="/outlet/orders/:id" element={<RoleProtectedRoute allowedRoles={['outlet_manager']}><Layout><OrderDetailPage isOutletView={true} /></Layout></RoleProtectedRoute>} />

                {/* Deliveryman Routes */}
                <Route path="/delivery/dashboard" element={<RoleProtectedRoute allowedRoles={['deliveryman']}><Layout><DeliveryDashboard /></Layout></RoleProtectedRoute>} />
                <Route path="/delivery/calendar" element={<RoleProtectedRoute allowedRoles={['deliveryman']}><Layout><DeliveryCalendar /></Layout></RoleProtectedRoute>} />
                <Route path="/delivery/orders/:id" element={<RoleProtectedRoute allowedRoles={['deliveryman']}><Layout><OrderDetailPage isDeliveryView={true} /></Layout></RoleProtectedRoute>} />

                {/* Shared/Protected Routes */}
                <Route path="/orders/new" element={<RoleProtectedRoute allowedRoles={['admin', 'outlet_manager']}><Layout><NewOrderPage /></Layout></RoleProtectedRoute>} />
                <Route path="/products" element={<RoleProtectedRoute allowedRoles={['admin', 'outlet_manager']}><Layout><ProductsPage /></Layout></RoleProtectedRoute>} />

                {/* Debug Routes */}
                <Route path="/debug" element={<RoleProtectedRoute allowedRoles={['admin']}><Layout><DebugPage /></Layout></RoleProtectedRoute>} />
                <Route path="/debug-notifications" element={<RoleProtectedRoute allowedRoles={['admin']}><Layout><DebugNotificationPage /></Layout></RoleProtectedRoute>} />

              </Routes>
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ChakraProvider>
  );
};

export default App;
