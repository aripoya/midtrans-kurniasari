// TEST SCRIPT: Relational Database Solution untuk Outlet Bonbin
// Jalankan di browser console setelah login ke outlet dashboard

async function testRelationalEndpoint() {
    console.log('🚀 Testing Relational Database Solution untuk Outlet Bonbin...');
    
    // Get token from sessionStorage (sesuai dengan fix sessionStorage dari sebelumnya)
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('❌ No token found in sessionStorage. Please login first!');
        return;
    }
    
    console.log('✅ Token found, testing endpoint...');
    
    try {
        // Test endpoint relational yang sudah deploy
        const response = await fetch('https://order-management-app-production.wahwooh.workers.dev/api/orders/outlet-relational', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response headers:', [...response.headers.entries()]);
        
        const data = await response.json();
        console.log('📊 Response data:', data);
        
        if (data.success) {
            console.log('🎉 SUCCESS! Relational endpoint working!');
            console.log('📋 Orders found:', data.data?.length || 0);
            console.log('🏪 Meta info:', data.meta);
            
            // Log specific order info untuk debugging
            if (data.data && data.data.length > 0) {
                console.log('📦 Sample order:', data.data[0]);
                
                // Cek apakah pesanan ORDER-1752037059362-FLO3E muncul
                const targetOrder = data.data.find(order => order.id === 'ORDER-1752037059362-FLO3E');
                if (targetOrder) {
                    console.log('🎯 FOUND TARGET ORDER! ORDER-1752037059362-FLO3E is visible!');
                    console.log('📦 Target order details:', targetOrder);
                } else {
                    console.log('⚠️  Target order ORDER-1752037059362-FLO3E not found in results');
                }
            }
        } else {
            console.error('❌ Endpoint error:', data.message || data.error);
        }
        
    } catch (error) {
        console.error('❌ Network error:', error);
    }
}

// Auto-run the test
testRelationalEndpoint();

console.log(`
🎯 INSTRUKSI TESTING:
1. Buka: https://order-management-app-production.wahwooh.workers.dev/outlet/login
2. Login dengan credentials Outlet Bonbin
3. Buka Developer Tools (F12) -> Console  
4. Copy-paste script ini dan jalankan
5. Lihat hasil testing relational database solution

🎉 EXPECTED RESULT:
- SUCCESS! Relational endpoint working!
- Orders found: [jumlah pesanan]
- FOUND TARGET ORDER! ORDER-1752037059362-FLO3E is visible!
`);
