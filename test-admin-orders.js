// Quick test script to check admin orders API
const API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

async function testAdminOrders() {
  try {
    console.log('Testing admin orders endpoint...');
    
    // Get token from sessionStorage (you'll need to run this in browser console)
    const token = sessionStorage.getItem('adminToken');
    console.log('Token present:', !!token);
    
    if (!token) {
      console.error('No admin token found in sessionStorage');
      return;
    }
    
    const response = await fetch(`${API_URL}/api/orders/admin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.success && data.orders) {
      console.log(`✅ Success: Found ${data.orders.length} orders`);
      console.log('First order:', data.orders[0]);
    } else {
      console.log('❌ No orders found or error:', data);
    }
    
  } catch (error) {
    console.error('❌ Error testing admin orders:', error);
  }
}

// Run the test
testAdminOrders();
