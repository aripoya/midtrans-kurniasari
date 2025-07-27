import React, { createContext, useState, useContext, ReactNode } from 'react';

// TypeScript interfaces
interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (product: Product) => void;
  decreaseQuantity: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  getCartTotal: () => number;
  clearCart: () => void;
}

interface CartProviderProps {
  children: ReactNode;
}

// Membuat context untuk keranjang belanja
const CartContext = createContext<CartContextType | undefined>(undefined);

// Hook untuk menggunakan CartContext
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Provider component
export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartCount, setCartCount] = useState<number>(0);

  // Menambahkan produk ke keranjang
  const addToCart = (product: Product): void => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        // Jika produk sudah ada, tambahkan kuantitas
        const updatedItems = prevItems.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        updateCartCountForItems(updatedItems);
        return updatedItems;
      } else {
        // Jika produk belum ada, tambahkan ke keranjang
        const updatedItems = [...prevItems, { ...product, quantity: 1 }];
        updateCartCountForItems(updatedItems);
        return updatedItems;
      }
    });
  };

  // Mengurangi kuantitas produk di keranjang
  const decreaseQuantity = (productId: string): void => {
    setCartItems(prevItems => {
      const updatedItems = prevItems.map(item => 
        item.id === productId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      ).filter(item => item.quantity > 0);
      
      updateCartCountForItems(updatedItems);
      return updatedItems;
    });
  };

  // Menghapus produk dari keranjang
  const removeFromCart = (productId: string): void => {
    setCartItems(prevItems => {
      const updatedItems = prevItems.filter(item => item.id !== productId);
      updateCartCountForItems(updatedItems);
      return updatedItems;
    });
  };

  // Mengupdate jumlah total item di keranjang berdasarkan items yang diberikan
  const updateCartCountForItems = (items: CartItem[]): void => {
    setCartCount(items.reduce((total, item) => total + item.quantity, 0));
  };

  // Menghitung total harga keranjang
  const getCartTotal = (): number => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Membersihkan keranjang
  const clearCart = (): void => {
    setCartItems([]);
    setCartCount(0);
  };

  const value: CartContextType = {
    cartItems,
    cartCount,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    getCartTotal,
    clearCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
