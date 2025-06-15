// Order management handlers for demo mode (without D1 database)
export async function createOrder(request, env) {
    try {
        const orderData = await request.json();
        
        // Validate required fields
        if (!orderData.customer_name || !orderData.customer_email || !orderData.items || orderData.items.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields: customer_name, customer_email, and items'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Generate unique order ID
        const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Calculate total amount
        const totalAmount = orderData.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );
        
        // For demo purposes without D1 database, we'll simulate the response
        // In production, this would create Midtrans transaction and save to database
        
        const demoPaymentLink = `https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-${orderId}`;
        const demoSnapToken = `demo-token-${orderId}`;
        
        // Simulate successful response
        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            total_amount: totalAmount,
            payment_link: demoPaymentLink,
            snap_token: demoSnapToken,
            message: 'Order created successfully with demo payment link (for testing without Midtrans keys)'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function getOrders(request, env) {
    try {
        // For demo purposes, return sample orders
        const sampleOrders = [
            {
                id: 'ORDER-1703123456-ABC12',
                customer_name: 'John Doe',
                customer_email: 'john@example.com',
                customer_phone: '+6281234567890',
                total_amount: 150000,
                payment_status: 'paid',
                payment_link: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-1',
                created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
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
                created_at: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
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
        
        return new Response(JSON.stringify({
            success: true,
            orders: sampleOrders,
            pagination: {
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Get orders error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function getOrderById(request, env) {
    try {
        const url = new URL(request.url);
        const orderId = url.pathname.split('/').pop();
        
        // For demo purposes, return a sample order
        const sampleOrder = {
            id: orderId,
            customer_name: 'Demo Customer',
            customer_email: 'demo@example.com',
            customer_phone: '+6281234567890',
            total_amount: 100000,
            payment_status: 'pending',
            payment_link: `https://app.sandbox.midtrans.com/snap/v2/vtweb/demo-${orderId}`,
            created_at: new Date().toISOString(),
            items: [
                {
                    product_name: 'Demo Product',
                    product_price: 100000,
                    quantity: 1,
                    subtotal: 100000
                }
            ]
        };
        
        return new Response(JSON.stringify({
            success: true,
            order: sampleOrder
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Get order by ID error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function updateOrderStatus(request, env) {
    try {
        const url = new URL(request.url);
        const orderId = url.pathname.split('/')[3]; // /api/orders/:id/status
        const { status } = await request.json();
        
        // Validate status
        const validStatuses = ['pending', 'paid', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // For demo purposes, always return success
        return new Response(JSON.stringify({
            success: true,
            message: 'Order status updated successfully (demo mode)'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Update order status error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

