import React, { createContext, useState, useContext } from 'react';

// Membuat context untuk keranjang belanja
const CartContext = createContext();

// Hook untuk menggunakan CartContext
export const useCart = () => useContext(CartContext);

// Provider component
export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);

  // Menambahkan produk ke keranjang
  const addToCart = (product) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        // Jika produk sudah ada, tambahkan kuantitas
        return prevItems.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Jika produk belum ada, tambahkan ke keranjang
        return [...prevItems, { ...product, quantity: 1 }];
      }
    });
    updateCartCount();
  };

  // Mengurangi kuantitas produk di keranjang
  const decreaseQuantity = (productId) => {
    setCartItems(prevItems => {
      const updatedItems = prevItems.map(item => 
        item.id === productId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      ).filter(item => item.quantity > 0);
      
      return updatedItems;
    });
    updateCartCount();
  };

  // Menghapus produk dari keranjang
  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
    updateCartCount();
  };

  // Mengupdate jumlah total item di keranjang
  const updateCartCount = () => {
    setCartCount(cartItems.reduce((total, item) => total + item.quantity, 0));
  };

  // Menghitung total harga keranjang
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Membersihkan keranjang
  const clearCart = () => {
    setCartItems([]);
    setCartCount(0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      cartCount,
      addToCart,
      decreaseQuantity,
      removeFromCart,
      getCartTotal,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
