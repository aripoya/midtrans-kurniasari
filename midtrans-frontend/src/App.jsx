import './App.css'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import NewOrderPage from './pages/NewOrderPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProductsPage from './pages/ProductsPage'
import DebugPage from './pages/DebugPage'
import LoginPage from './pages/LoginPage'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'

function App() {
  return (
    <ChakraProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<LoginPage />} />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OrdersPage />
                  </Layout>
                </ProtectedRoute>
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
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OrderDetailPage />
                  </Layout>
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
          </Routes>
        </AuthProvider>
      </Router>
    </ChakraProvider>
  )
}

export default App
