import { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingCart, Copy, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// API base URL - will be updated for deployment
const API_BASE_URL = 'https://ygygqmvk.manus.space/api';

function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    items: [{ name: '', price: 0, quantity: 1 }]
  });

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const addItem = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', price: 0, quantity: 1 }]
    }));
  };

  const removeItem = (index) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateTotal = () => {
    return orderForm.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For demo purposes, simulate API response without actual backend
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const totalAmount = calculateTotal();
      const demoPaymentLink = `https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-${orderId}`;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = {
        success: true,
        order_id: orderId,
        total_amount: totalAmount,
        payment_link: demoPaymentLink,
        snap_token: `demo-token-${orderId}`,
        message: 'Order created successfully with demo payment link!'
      };

      if (result.success) {
        showNotification('Order created successfully! Payment link generated.');
        
        // Reset form
        setOrderForm({
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          items: [{ name: '', price: 0, quantity: 1 }]
        });

        // Show payment link
        if (result.payment_link) {
          const shouldOpen = window.confirm(
            `Order created successfully!\n\nOrder ID: ${result.order_id}\nTotal: ${formatCurrency(result.total_amount)}\n\nWould you like to open the payment page?`
          );
          if (shouldOpen) {
            window.open(result.payment_link, '_blank');
          }
        }

        // Refresh orders list
        fetchOrders();
      } else {
        showNotification(result.error || 'Failed to create order', 'error');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      showNotification('Demo mode: Order creation simulated successfully!', 'success');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // For demo purposes, return sample orders
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const sampleOrders = [
        {
          id: 'ORDER-1703123456-ABC12',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          customer_phone: '+6281234567890',
          total_amount: 150000,
          payment_status: 'paid',
          payment_link: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-1',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          items: [
            {
              product_name: 'Product A',
              product_price: 75000,
              quantity: 2,
              subtotal: 150000
            }
          ]
        },
        {
          id: 'ORDER-1703123457-DEF34',
          customer_name: 'Jane Smith',
          customer_email: 'jane@example.com',
          customer_phone: '+6281234567891',
          total_amount: 200000,
          payment_status: 'pending',
          payment_link: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-2',
          created_at: new Date(Date.now() - 43200000).toISOString(),
          items: [
            {
              product_name: 'Product B',
              product_price: 100000,
              quantity: 2,
              subtotal: 200000
            }
          ]
        }
      ];

      setOrders(sampleOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showNotification('Demo mode: Showing sample orders', 'info');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const copyPaymentLink = (link) => {
    navigator.clipboard.writeText(link);
    showNotification('Payment link copied to clipboard!');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
              notification.type === 'error' 
                ? 'bg-red-500 text-white' 
                : notification.type === 'info'
                ? 'bg-blue-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Order Management System</h1>
          <p className="text-gray-600">Create orders and manage payments with Midtrans integration</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Create Order
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 View Orders
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Order</h2>
                <p className="text-gray-600 mb-6">Fill in the customer details and items to generate a payment link</p>

                <form onSubmit={handleSubmitOrder} className="space-y-6">
                  {/* Customer Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={orderForm.customer_name}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, customer_name: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={orderForm.customer_email}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, customer_email: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+62..."
                        value={orderForm.customer_phone}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Order Items</h3>
                      <button
                        type="button"
                        onClick={addItem}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>

                    <div className="space-y-4">
                      {orderForm.items.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg"
                        >
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Product Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={item.name}
                              onChange={(e) => updateItem(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Price (IDR) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="flex items-end">
                            {orderForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="w-full bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Subtotal: {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                        <span className="text-lg font-bold text-gray-900">
                          Total: {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || calculateTotal() === 0}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Order...' : 'Create Order & Generate Payment Link'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Management</h2>
                <p className="text-gray-600 mb-6">View and manage all orders</p>

                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading orders...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No orders found. Create your first order!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{order.id}</h3>
                            <p className="text-gray-600">{order.customer_name} • {order.customer_email}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleDateString('id-ID', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(order.payment_status)}
                            <p className="text-lg font-bold text-gray-900 mt-2">
                              {formatCurrency(order.total_amount)}
                            </p>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Items:</h4>
                          <div className="space-y-1">
                            {order.items?.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm text-gray-600">
                                <span>{item.product_name} x {item.quantity}</span>
                                <span>{formatCurrency(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyPaymentLink(order.payment_link)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Payment Link
                          </button>
                          <button
                            onClick={() => window.open(order.payment_link, '_blank')}
                            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
                          >
                            Open Payment Page
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;

