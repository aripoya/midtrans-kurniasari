import './App.css'
import { ChakraProvider, Box } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './components/PublicLayout'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import NewOrderPage from './pages/NewOrderPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProductsPage from './pages/ProductsPage'
import DebugPage from './pages/DebugPage'
import LoginPage from './pages/LoginPage'
import AdminOrdersPage from './pages/admin/AdminOrdersPage'
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'

function App() {
  return (
    <ChakraProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<LoginPage />} />
            
            {/* Public Order Detail Page - No Authentication Required */}
            {/* PENTING: Rute spesifik harus didefinisikan sebelum rute umum */}
            <Route
              path="/orders/:id"
              element={
                <PublicLayout>
                  <OrderDetailPage />
                </PublicLayout>
              }
            />
            
            {/* Public Routes - No Authentication Required */}
            <Route
              path="/orders"
              element={
                <PublicLayout>
                  <OrdersPage />
                </PublicLayout>
              }
            />
            <Route
              path="/orders/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewOrderPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders/:id"
              element={
                <ProtectedRoute>
                  <AdminOrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProductsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/debug"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DebugPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }>
              <Route index element={<AdminOrdersPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="orders/new" element={<NewOrderPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </Router>
    </ChakraProvider>
  )
}

export default App
