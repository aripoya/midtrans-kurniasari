// Enhanced order management handlers for production
export async function createOrder(request, env) {
  console.log('=============== CREATE ORDER HANDLER CALLED ===============');
  console.log('Request Method:', request.method);
  console.log('Request URL:', request.url);
  console.log('Request Headers:', JSON.stringify(Object.fromEntries([...request.headers.entries()]), null, 2));
    // Get corsHeaders from request context or use default if not available
    const corsHeaders = request.corsHeaders || {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Check if database is available
    const hasDatabase = !!env.DB;
    console.log('createOrder handler started with corsHeaders available:', !!corsHeaders);
    console.log('Database availability:', hasDatabase ? 'Available' : 'Not Available (Development Mode)');
    
    try {
        const orderData = await request.json();
        
        // Validate required fields - support both field naming conventions
        const customerName = orderData.customer_name;
        const customerEmail = orderData.email || orderData.customer_email;
        const customerPhone = orderData.phone || orderData.customer_phone || '';
        const items = orderData.items;
        
        if (!customerName || !customerEmail || !items || items.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields: customer_name, email, and items'
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // Calculate total amount
        const totalAmount = items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        // Generate unique order ID
        const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Get Midtrans configuration
        const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
        const serverKey = env.MIDTRANS_SERVER_KEY;
        const clientKey = env.MIDTRANS_CLIENT_KEY;
        
        // Debug logging untuk kredensial (hanya menampilkan 4 karakter pertama dan 4 terakhir untuk keamanan)
        console.log('Midtrans config - Production mode:', isProduction);
        console.log('Server key available:', !!serverKey, 
                    serverKey ? `Key prefix: ${serverKey.substring(0, 3)}...${serverKey.slice(-4)}` : 'none');
        console.log('Client key available:', !!clientKey, 
                    clientKey ? `Key prefix: ${clientKey.substring(0, 3)}...${clientKey.slice(-4)}` : 'none');
        
        if (!serverKey || !clientKey) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Midtrans credentials not configured'
            }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders 
                }
            });
        }

        // Prepare Midtrans payload
        const midtransPayload = {
            transaction_details: {
                order_id: orderId,
                gross_amount: totalAmount
            },
            customer_details: {
                first_name: customerName,
                email: customerEmail,
                phone: customerPhone
            },
            item_details: items.map(item => ({
                id: `ITEM-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            callbacks: {
                finish: `${request.headers.get('origin') || 'https://kurniasari-midtrans-frontend.pages.dev'}/orders/${orderId}`,
                error: `${request.headers.get('origin') || 'https://kurniasari-midtrans-frontend.pages.dev'}/orders/${orderId}?status=error`,
                pending: `${request.headers.get('origin') || 'https://kurniasari-midtrans-frontend.pages.dev'}/orders/${orderId}?status=pending`
            }
        };

        // Create Midtrans Snap transaction
        const midtransUrl = isProduction 
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
        
        console.log('Using Midtrans URL:', midtransUrl);

        // Show exact server key for debugging (last 4 chars hidden)
        console.log('Server key used:', serverKey.substring(0, serverKey.length - 4) + '****');
        
        // Format authorization header sesuai standard Midtrans
        // Server key harus diikuti dengan colon (:) lalu di-encode base64
        const midtransAuth = btoa(serverKey + ':');
        
        console.log('---------- MIDTRANS API REQUEST ----------');
        console.log('URL:', midtransUrl);
        console.log('Environment:', isProduction ? 'PRODUCTION' : 'SANDBOX');
        console.log('Auth Input:', `${serverKey}:`);
        console.log('Raw Auth Header:', `Basic ${midtransAuth}`);
        console.log('Payload:', JSON.stringify(midtransPayload, null, 2));
        console.log('-------------------------------------------');
        
        // Make request to Midtrans API
        const midtransResponse = await fetch(midtransUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${midtransAuth}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(midtransPayload)
        });

        // Parse JSON response
        let responseData;
        try {
            // Process Midtrans API response
            if (!midtransResponse.ok) {
                let errorText = '';
                try {
                    const errorJson = await midtransResponse.json();
                    errorText = JSON.stringify(errorJson);
                    console.log('✘ [ERROR] Midtrans API error:', errorText);
                } catch (e) {
                    errorText = await midtransResponse.text();
                    console.log('✘ [ERROR] Midtrans API error (non-JSON):', errorText);
                }
                
                console.log(`\n✘ [ERROR] Midtrans API status: ${midtransResponse.status}\n`);
                
                // DEV MODE ONLY: If Midtrans API returns 401 Unauthorized in development mode, create dummy response for testing
                // In production mode, we'll let the error pass through to troubleshoot
                if (midtransResponse.status === 401 && !isProduction) {
                    console.log('🔄 [DEVELOPMENT MODE] Creating dummy Midtrans response for testing UI flow...');
                    
                    // Generate a dummy Snap token and redirect URL
                    const dummySnapToken = 'dummy-snap-' + new Date().getTime();
                    const dummyRedirectUrl = 'https://simulator.sandbox.midtrans.com/snap/v3/redirection/' + dummySnapToken;
                    
                    // Log the dummy response
                    console.log('💡 [DUMMY RESPONSE] Snap Token:', dummySnapToken);
                    console.log('💡 [DUMMY RESPONSE] Redirect URL:', dummyRedirectUrl);
                    
                    // Generate dummy Midtrans response for UI testing
                    const midtransData = {
                        token: dummySnapToken,
                        redirect_url: dummyRedirectUrl
                    };
                    
                    console.log('✅ [DEVELOPMENT MODE] Dummy response created successfully!');
                    
                    // Insert dummy order to DB if available
                    if (env.DB) {
                        try {
                            await env.DB.prepare(`
                                INSERT INTO orders (order_id, customer_name, status, amount, created_at, midtrans_data) 
                                VALUES (?, ?, ?, ?, ?, ?)
                            `).bind(
                                orderId,
                                customerName,
                                'pending',
                                totalAmount,
                                new Date().toISOString(),
                                JSON.stringify(midtransData)
                            ).run();
                            console.log('✅ Order data saved to database with status: pending');
                        } catch (dbError) {
                            console.log('⚠️ Failed to save order to DB:', dbError);
                        }
                    } else {
                        console.log('ℹ️ Skipping database insert in development mode');
                    }
                    
                    // Return successful response with dummy data
                    return new Response(JSON.stringify({
                        status: 'success',
                        message: 'Dev mode: Dummy order created successfully',
                        order_id: orderId,
                        payment_token: dummySnapToken,
                        payment_link: dummyRedirectUrl
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                
                // If not 401 or not in dev mode, return the actual error response
                return new Response(JSON.stringify({ 
                    error: `Error from Midtrans API: ${midtransResponse.status}`, 
                    details: errorText 
                }), {
                    status: midtransResponse.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            // Process successful response
            responseData = await midtransResponse.json();
            console.log('---------- MIDTRANS API RESPONSE ----------');
            console.log('Status Code:', midtransResponse.status);
            console.log('Response Data:', JSON.stringify(responseData, null, 2));
            console.log('-------------------------------------------');

            // Save order and order items to the database
            if (env.DB) {
                try {
                    const stmts = [];

                    // 1. Prepare statement for the orders table
                    const orderInsertStmt = env.DB.prepare(`
                        INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, total_amount, status, midtrans_token, midtrans_redirect_url, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        orderId,
                        customerName,
                        customerEmail,
                        customerPhone,
                        totalAmount,
                        'pending',
                        responseData.token,
                        responseData.redirect_url,
                        new Date().toISOString(),
                        new Date().toISOString()
                    );
                    stmts.push(orderInsertStmt);

                    // 2. Prepare statements for the order_items table
                    const orderItemsStmts = items.map(item => {
                        return env.DB.prepare(`
                            INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
                            VALUES (?, ?, ?, ?, ?)
                        `).bind(
                            orderId,
                            item.id,
                            item.name,
                            item.quantity,
                            item.price
                        );
                    });
                    stmts.push(...orderItemsStmts);

                    // Execute the batch transaction
                    await env.DB.batch(stmts);
                    console.log(`✅ Order ${orderId} and ${items.length} items saved to database successfully.`);

                } catch (dbError) {
                    console.error(`✘ [FATAL] Failed to save order ${orderId} to database.`, dbError);
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Order processed by payment gateway, but failed to save to our system. Please contact support.',
                        details: dbError.message,
                        order_id: orderId,
                        payment_token: responseData.token,
                        payment_link: responseData.redirect_url
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }
            } else {
                console.log('ℹ️ Skipping database insert because DB environment is not available.');
            }

            // Return successful response to the client
            return new Response(JSON.stringify({
                success: true,
                message: 'Order created and payment link generated successfully.',
                order_id: orderId,
                payment_token: responseData.token,
                payment_link: responseData.redirect_url
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        } catch (error) {
            console.error('Error parsing Midtrans API response:', error);
            try {
                const responseText = await midtransResponse.text();
                console.log('Raw response text:', responseText);
                
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Failed to parse Midtrans API response',
                    details: error.message,
                    raw_response: responseText
                }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            } catch (textError) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Failed to parse Midtrans API response',
                    details: error.message
                }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
        }

        // responseData already contains the parsed JSON response
        const midtransResult = responseData;

        // Save order to database if available (might not be available in local dev)  
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
                    customerName,
                    customerEmail,
                    customerPhone,
                    totalAmount,
                    'pending',
                    midtransResult.token || '',
                    midtransResult.redirect_url || '',
                    new Date().toISOString()
                ).run();

                // Insert order items
                for (const item of items) {
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
                console.log('Order saved to database successfully:', orderId);
            } catch (dbError) {
                console.error('Database Error:', dbError);
                // Continue even if database fails, as payment is created
                console.log('Continuing despite database error, as payment is created');
            }
        } else {
            console.log('Database not available - skipping database operations (development mode)');
            console.log('Order will not be persisted but payment link will be returned');
        }

        // Return standardized response with consistent CORS headers
        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            total_amount: totalAmount,
            payment_link: midtransResult.redirect_url,
            snap_token: midtransResult.token,
            message: 'Order created successfully!'
        }), {
            status: 201, // Changed to 201 Created for POST that creates a new resource
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders // Use corsHeaders consistently
            }
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        // Log the stack trace for better debugging
        console.error('Stack trace:', error.stack);
        
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Unknown error'
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders // corsHeaders available from top of function
            }
        });
    }
}

export async function getOrders(request, env) {
    try {
        // Get corsHeaders from request context or use default if not available
        const corsHeaders = request.corsHeaders || {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        
        // Check if database is available
        const hasDatabase = !!env.DB;
        console.log('getOrders handler called with database availability:', hasDatabase ? 'Available' : 'Not Available (Development Mode)');
        
        if (!env.DB) {
            // Return empty orders array for development mode when database is not available
            console.log('Database not available, returning empty orders array');
            return new Response(JSON.stringify({
                success: true,
                orders: [],
                pagination: {
                    limit: 50,
                    offset: 0,
                    total: 0
                }
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
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
        // Get corsHeaders from request context or use default if not available
        const corsHeaders = request.corsHeaders || {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        
        const url = new URL(request.url);
        const orderId = url.pathname.split('/').pop();

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order ID is required'
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // Check if database is available
        const hasDatabase = !!env.DB;
        console.log('getOrderById handler called for order', orderId, 'with database availability:', 
            hasDatabase ? 'Available' : 'Not Available (Development Mode)');
        
        if (!env.DB) {
            console.log('Database not available, returning dummy order data for development mode');
            
            // Extract order ID from URL for more realistic dummy data
            // If it contains a timestamp, use that to make creation time realistic
            const orderIdParts = orderId.split('-');
            const hasTimestamp = orderIdParts.length > 1 && !isNaN(parseInt(orderIdParts[1]));
            const orderTimestamp = hasTimestamp ? parseInt(orderIdParts[1]) : Date.now();
            
            // Generate realistic dummy data based on orderId
            const isDummyOrder = orderId.includes('dummy') || orderId.includes('ORDER-');
            let dummyStatus = 'pending';
            const randomValue = parseInt(orderId.slice(-5), 36) % 4; // Use last chars for consistent randomness
            
            // Pseudo-randomly pick a status based on orderId
            if (isDummyOrder) {
                if (randomValue === 1) dummyStatus = 'settlement';
                else if (randomValue === 2) dummyStatus = 'cancel';
                else if (randomValue === 3) dummyStatus = 'expire';
            }
            
            // Generate dummy items based on orderId
            const itemCount = 1 + (parseInt(orderId.slice(-1), 36) % 3); // 1-3 items
            const dummyItems = [];
            let totalAmount = 0;
            
            // Product catalog for dummy items
            const products = [
                { name: 'Bakpia Kurniasari Kacang Hijau', price: 45000 },
                { name: 'Bakpia Kurniasari Keju', price: 50000 },
                { name: 'Bakpia Kurniasari Coklat', price: 48000 },
                { name: 'Bakpia Mini Kacang Hijau', price: 35000 },
                { name: 'Bakpia Mix Varian', price: 52000 }
            ];
            
            for (let i = 0; i < itemCount; i++) {
                const productIndex = (parseInt(orderId.slice(-(i+2), -(i+1)), 36) % products.length);
                const quantity = 1 + (parseInt(orderId.slice(-(i+3), -(i+2)), 36) % 3); // 1-3 quantity
                const product = products[productIndex];
                
                const item = {
                    id: `ITEM-${orderId.slice(-5)}-${i}`,
                    name: product.name,
                    price: product.price,
                    quantity: quantity
                };
                
                totalAmount += item.price * item.quantity;
                dummyItems.push(item);
            }
            
            // Generate dummy payment information
            const dummySnapToken = isDummyOrder && orderId.includes('dummy-snap') 
                ? orderId.split('dummy-snap-')[1]
                : `dummy-snap-${orderTimestamp}`;
                
            const dummyRedirectUrl = `https://simulator.sandbox.midtrans.com/snap/v3/redirection/${dummySnapToken}`;
            
            // Create dummy Midtrans data
            const midtransData = {
                token: dummySnapToken,
                redirect_url: dummyRedirectUrl
            };
            
            // Create dummy transaction info
            let transactionInfo = {};
            if (dummyStatus !== 'pending') {
                const paymentTime = new Date(orderTimestamp + 1000*60*10); // 10 minutes after order
                transactionInfo = {
                    transaction_id: `MTID-${orderTimestamp.toString().slice(-10)}`,
                    payment_type: randomValue === 1 ? 'credit_card' : 
                                 randomValue === 2 ? 'bank_transfer' : 'gopay',
                    payment_time: paymentTime.toISOString()
                };
            }
            
            console.log(`\n\u2705 [DEV MODE] Generated dummy order ${orderId} with status ${dummyStatus}`);
            
            return new Response(JSON.stringify({
                success: true,
                order: {
                    id: orderId,
                    status: dummyStatus,
                    customer_name: `Customer ${orderId.slice(-5)}`,
                    email: `customer${orderId.slice(-5)}@example.com`,
                    phone: `08${Math.floor(Math.random() * 1000000000)}`,
                    total_amount: totalAmount,
                    created_at: new Date(orderTimestamp).toISOString(),
                    payment_url: dummyStatus === 'pending' ? dummyRedirectUrl : null,
                    items: dummyItems,
                    midtrans_data: midtransData,
                    ...transactionInfo,
                    payment_method: transactionInfo.payment_type || null
                }
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
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

