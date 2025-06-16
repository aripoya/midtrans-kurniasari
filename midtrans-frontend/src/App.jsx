import './App.css'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

// Simple home page component 
function HomePage() {
  return (
    <div>
      <h1>Kurniasari Order Management</h1>
      <p>Halaman Beranda Sederhana</p>
    </div>
  )
}

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </Layout>
      </Router>
    </ChakraProvider>
  )
}

export default App
