// Quick test script to manually sync payment status for an order
const ORDER_ID = 'ORDER-1763176315253-G3TP3';
const API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// You need to login first and get the JWT token
const JWT_TOKEN = process.env.ADMIN_JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

async function syncPaymentStatus() {
    try {
        console.log(`Syncing payment status for order: ${ORDER_ID}`);
        
        const response = await fetch(`${API_URL}/api/admin/orders/${ORDER_ID}/sync-payment-status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('Sync result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log(`✅ Payment status synced successfully!`);
            console.log(`   Payment Status: ${result.payment_status}`);
            console.log(`   Transaction Status: ${result.transaction_status}`);
        } else {
            console.log(`❌ Failed to sync payment status: ${result.error}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

syncPaymentStatus();
