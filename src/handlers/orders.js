// Enhanced order management handlers for production
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

        // Calculate total amount
        const totalAmount = orderData.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        // Generate unique order ID
        const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Get Midtrans configuration
        const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
        const serverKey = env.MIDTRANS_SERVER_KEY;
        const clientKey = env.MIDTRANS_CLIENT_KEY;
        
        if (!serverKey || !clientKey) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Midtrans credentials not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Prepare Midtrans transaction data
        const transactionData = {
            transaction_details: {
                order_id: orderId,
                gross_amount: totalAmount
            },
            customer_details: {
                first_name: orderData.customer_name,
                email: orderData.customer_email,
                phone: orderData.customer_phone || ''
            },
            item_details: orderData.items.map(item => ({
                id: item.name.toLowerCase().replace(/\s+/g, '_'),
                price: item.price,
                quantity: item.quantity,
                name: item.name
            })),
            callbacks: {
                finish: `${env.APP_URL || 'https://lxdpofbi.manus.space'}/payment/finish`,
                error: `${env.APP_URL || 'https://lxdpofbi.manus.space'}/payment/error`,
                pending: `${env.APP_URL || 'https://lxdpofbi.manus.space'}/payment/pending`
            }
        };

        // Create Midtrans transaction
        const midtransUrl = isProduction 
            ? 'https://api.midtrans.com/v2/charge'
            : 'https://api.sandbox.midtrans.com/v2/charge';

        const midtransAuth = btoa(serverKey + ':');
        
        const midtransResponse = await fetch(midtransUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${midtransAuth}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });

        const midtransResult = await midtransResponse.json();

        if (!midtransResponse.ok) {
            console.error('Midtrans API Error:', midtransResult);
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to create payment transaction',
                details: midtransResult
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Save order to database
        if (env.DB) {
            try {
                // Insert order
                const orderInsert = await env.DB.prepare(`
                    INSERT INTO orders (
                        id, customer_name, customer_email, customer_phone, 
                        total_amount, payment_status, payment_token, 
                        payment_link, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    orderId,
                    orderData.customer_name,
                    orderData.customer_email,
                    orderData.customer_phone || '',
                    totalAmount,
                    'pending',
                    midtransResult.token,
                    midtransResult.redirect_url,
                    new Date().toISOString()
                ).run();

                // Insert order items
                for (const item of orderData.items) {
                    await env.DB.prepare(`
                        INSERT INTO order_items (
                            order_id, product_name, product_price, quantity, subtotal
                        ) VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        orderId,
                        item.name,
                        item.price,
                        item.quantity,
                        item.price * item.quantity
                    ).run();
                }
            } catch (dbError) {
                console.error('Database Error:', dbError);
                // Continue even if database fails, as payment is created
            }
        }

        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            total_amount: totalAmount,
            payment_link: midtransResult.redirect_url,
            snap_token: midtransResult.token,
            message: 'Order created successfully!'
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function getOrders(request, env) {
    try {
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get orders with pagination
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        const ordersResult = await env.DB.prepare(`
            SELECT * FROM orders 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        // Get items for each order
        const ordersWithItems = await Promise.all(
            ordersResult.results.map(async (order) => {
                const itemsResult = await env.DB.prepare(`
                    SELECT * FROM order_items WHERE order_id = ?
                `).bind(order.id).all();

                return {
                    ...order,
                    items: itemsResult.results
                };
            })
        );

        return new Response(JSON.stringify({
            success: true,
            orders: ordersWithItems,
            pagination: {
                limit,
                offset,
                total: ordersResult.results.length
            }
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Get Orders Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch orders'
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

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order ID is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get order
        const orderResult = await env.DB.prepare(`
            SELECT * FROM orders WHERE id = ?
        `).bind(orderId).first();

        if (!orderResult) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get order items
        const itemsResult = await env.DB.prepare(`
            SELECT * FROM order_items WHERE order_id = ?
        `).bind(orderId).all();

        return new Response(JSON.stringify({
            success: true,
            order: {
                ...orderResult,
                items: itemsResult.results
            }
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Get Order Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch order'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

