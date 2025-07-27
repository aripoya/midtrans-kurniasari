import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Center, Spinner } from '@chakra-ui/react';

// TypeScript interface
interface ProtectedRouteProps {
  children: ReactNode;
}

// Komponen untuk melindungi route agar hanya bisa diakses setelah login
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  // Tampilkan loading spinner saat memeriksa status autentikasi
  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" thickness="4px" speed="0.65s" color="teal.500" />
      </Center>
    );
  }

  // Redirect ke halaman login jika belum login,
  // dan simpan lokasi yang ingin dituju untuk redirect kembali setelah login
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika sudah login, tampilkan konten yang dilindungi
  return <>{children}</>;
};

export default ProtectedRoute;
