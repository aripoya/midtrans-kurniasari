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

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<NewOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </Layout>
      </Router>
    </ChakraProvider>
  )
}

export default App
