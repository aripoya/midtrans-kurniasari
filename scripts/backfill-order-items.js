// Script to backfill order items for orders that don't have items yet
const API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

async function backfillOrderItems() {
  // You need to get admin token from your browser localStorage/sessionStorage
  const token = process.env.ADMIN_TOKEN;
  
  if (!token) {
    console.error('Please set ADMIN_TOKEN environment variable');
    console.log('Get token from browser: localStorage.getItem("token") or sessionStorage.getItem("token")');
    process.exit(1);
  }

  try {
    // Get all orders
    console.log('Fetching orders...');
    const response = await fetch(`${API_URL}/api/orders?limit=1000`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    const orders = data.orders || [];
    
    console.log(`Found ${orders.length} orders`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      // Check if order already has items
      if (order.items && order.items.length > 0) {
        skippedCount++;
        continue;
      }

      console.log(`Backfilling order ${order.id}...`);
      
      try {
        const backfillResponse = await fetch(`${API_URL}/api/admin/orders/${order.id}/backfill-items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            force: true
          })
        });

        const result = await backfillResponse.json();
        
        if (result.success) {
          successCount++;
          console.log(`✓ ${order.id}: ${result.inserted} items inserted`);
        } else {
          errorCount++;
          console.log(`✗ ${order.id}: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ ${order.id}: ${error.message}`);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=== Summary ===');
    console.log(`Total orders: ${orders.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

backfillOrderItems();
