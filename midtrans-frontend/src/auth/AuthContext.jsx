import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Buat context untuk autentikasi
const AuthContext = createContext();

// Credentials yang valid (hard-coded untuk saat ini)
// Dalam aplikasi production, ini seharusnya diverifikasi melalui API
const VALID_CREDENTIALS = {
  username: 'admin',
  password: 'kurniasari123'
};

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Memeriksa status login saat aplikasi dimuat
  useEffect(() => {
    const checkLoggedIn = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      }
      setIsLoading(false);
    };

    checkLoggedIn();
  }, []);

  // Fungsi untuk login
  const login = (username, password) => {
    // Verifikasi credentials
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
      const userData = { username };
      setUser(userData);
      setIsLoggedIn(true);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  // Fungsi untuk logout
  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Value yang akan disediakan oleh context
  const value = {
    isLoggedIn,
    user,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook untuk menggunakan AuthContext
export function useAuth() {
  return useContext(AuthContext);
}
