// Trigger redeploy to update secrets (v1)
import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById, updateOrderStatus, updateOrderDetails, refreshOrderStatus, getAdminOrders, deleteOrder } from './handlers/orders.js';
import { markOrderAsReceived } from './handlers/received.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from './handlers/products.js';
import { handleRequest as handleShippingRequest } from './handlers/shipping.js';
import { getLocations } from './handlers/locations.js';


console.log('Initializing router');
const router = Router();
console.log('Router initialized successfully');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://tagihan.kurniasari.co.id',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
};

// Handle CORS preflight requests
router.options('*', (request) => {
    console.log('Handling OPTIONS request for path:', request.url);
    return new Response(null, {
        status: 200,
        headers: corsHeaders
    });
});

// Health check endpoint with route information
router.get('/', (request) => {
    console.log('Handling root endpoint request');
    const routes = [
        'GET    /api/products',
        'POST   /api/orders',
        'GET    /api/orders',
        'GET    /api/orders/:id',
        'DELETE /api/orders/:id',
        'POST   /api/webhook/midtrans',
        'GET    /api/transaction/:orderId/status',
        'GET    /api/debug/midtrans',
        'GET    /api/config',
        'GET    /api/debug/database',
        'GET    /api/admin/orders',
        'GET    /api/locations'
    ];
    
    return new Response(JSON.stringify({
        status: 'OK',
        message: 'Order Management API is running',
        timestamp: new Date().toISOString(),
        routes: routes
    }, null, 2), {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
});

// Order management endpoints
router.post('/api/orders', (request, env) => {
    request.corsHeaders = corsHeaders;
    return createOrder(request, env);
});
router.get('/api/orders', (request, env) => {
    request.corsHeaders = corsHeaders;
    return getOrders(request, env);
});
router.get('/api/orders/:id', (request, env) => {
    console.log('Get Order by ID:', request.params.id);
    return getOrderById(request, env);
});
router.delete('/api/orders/:id', (request, env) => {
    console.log('Delete Order by ID:', request.params.id);
    return deleteOrder(request, env);
});
router.patch('/api/orders/:id/status', (request, env) => {
    request.corsHeaders = corsHeaders;
    return updateOrderStatus(request, env);
});

// Endpoint untuk update detail pesanan (area pengiriman & metode pengambilan)
router.patch('/api/orders/:id/details', (request, env) => {
    request.corsHeaders = corsHeaders;
    return updateOrderDetails(request, env);
});

// Customer-facing status update endpoints
router.post('/api/orders/:id/received', (request, env) => {
    request.corsHeaders = corsHeaders;
    return markOrderAsReceived(request, env);
});

// Backward compatibility for existing clients
router.post('/api/orders/:id/mark-received', (request, env) => {
    request.corsHeaders = corsHeaders;
    return markOrderAsReceived(request, env);
});
router.post('/api/orders/:id/refresh-status', (request, env) => {
    request.corsHeaders = corsHeaders;
    return refreshOrderStatus(request, env);
});

router.post('/api/orders/:id/mark-received', (request, env) => {
    request.corsHeaders = corsHeaders;
    return markOrderAsReceived(request, env);
});

// Admin endpoints
router.get('/api/admin/orders', (request, env) => {
    request.corsHeaders = corsHeaders;
    return getAdminOrders(request, env);
});

// Locations endpoints
router.get('/api/locations', (request, env) => {
    request.corsHeaders = corsHeaders;
    return getLocations(request, env);
});

// Product management endpoints
router.get('/api/products', (request, env) => {
    request.corsHeaders = corsHeaders;
    return getProducts(request, env);
});
router.post('/api/products', (request, env) => {
    request.corsHeaders = corsHeaders;
    return createProduct(request, env);
});
router.put('/api/products/:id', (request, env) => {
    request.corsHeaders = corsHeaders;
    return updateProduct(request, env);
});
router.delete('/api/products/:id', (request, env) => {
    request.corsHeaders = corsHeaders;
    return deleteProduct(request, env);
});

// Shipping endpoints for image uploads and management
router.all('/api/shipping/*', (request, env) => {
    request.corsHeaders = corsHeaders;
    return handleShippingRequest(request, env);
});

// Configuration endpoint (for debugging)
// Debug endpoint to check Midtrans configuration
router.get('/api/debug/midtrans', (request, env) => {
    console.log('Handling /debug/midtrans endpoint request');
    try {
        const serverKey = env.MIDTRANS_SERVER_KEY;
        const clientKey = env.MIDTRANS_CLIENT_KEY;
        const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
        
        // Create a test auth header
        const testAuth = btoa(`${serverKey}:`);
        
        const config = {
            serverKey: serverKey ? `${serverKey.substring(0, 10)}...${serverKey.substring(serverKey.length - 5)}` : 'Not set',
            clientKey: clientKey ? `${clientKey.substring(0, 10)}...${clientKey.substring(clientKey.length - 5)}` : 'Not set',
            isProduction,
            authHeader: testAuth ? `${testAuth.substring(0, 10)}...` : 'Not generated',
            envVars: {
                MIDTRANS_SERVER_KEY: serverKey ? 'Set' : 'Not set',
                MIDTRANS_CLIENT_KEY: clientKey ? 'Set' : 'Not set',
                MIDTRANS_IS_PRODUCTION: isProduction ? 'true' : 'false'
            },
            timestamp: new Date().toISOString()
        };
        
        console.log('Midtrans Debug Info:', JSON.stringify(config, null, 2));
        
        return new Response(JSON.stringify(config, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        console.error('Error in /debug/midtrans:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get Midtrans config',
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
});

router.get('/api/config', (request, env) => {
    console.log('Handling /api/config endpoint request');
    try {
        // Log each individual env variable and binding
        console.log('Environment variables available:', {
            MIDTRANS_IS_PRODUCTION: env.MIDTRANS_IS_PRODUCTION,
            APP_NAME: env.APP_NAME,
            has_MIDTRANS_SERVER_KEY: !!env.MIDTRANS_SERVER_KEY,
            has_MIDTRANS_CLIENT_KEY: !!env.MIDTRANS_CLIENT_KEY,
            has_DB: !!env.DB,
            MIDTRANS_MERCHANT_ID: env.MIDTRANS_MERCHANT_ID,
            // Tampilkan 4 karakter pertama dan terakhir untuk keamanan
            SERVER_KEY_PREFIX: env.MIDTRANS_SERVER_KEY ? env.MIDTRANS_SERVER_KEY.substring(0, 4) : null,
            SERVER_KEY_SUFFIX: env.MIDTRANS_SERVER_KEY ? env.MIDTRANS_SERVER_KEY.slice(-4) : null,
            CLIENT_KEY_PREFIX: env.MIDTRANS_CLIENT_KEY ? env.MIDTRANS_CLIENT_KEY.substring(0, 4) : null,
            CLIENT_KEY_SUFFIX: env.MIDTRANS_CLIENT_KEY ? env.MIDTRANS_CLIENT_KEY.slice(-4) : null
        });
        
        return new Response(JSON.stringify({
            environment: env.MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'development',
            app_name: env.APP_NAME || 'Order Management System',
            has_midtrans_config: !!(env.MIDTRANS_SERVER_KEY && env.MIDTRANS_CLIENT_KEY),
            has_database: !!env.DB,
            merchant_id: env.MIDTRANS_MERCHANT_ID || 'Not configured',
            server_key_partial: env.MIDTRANS_SERVER_KEY ? `${env.MIDTRANS_SERVER_KEY.substring(0, 4)}...${env.MIDTRANS_SERVER_KEY.slice(-4)}` : 'Not configured',
            client_key_partial: env.MIDTRANS_CLIENT_KEY ? `${env.MIDTRANS_CLIENT_KEY.substring(0, 4)}...${env.MIDTRANS_CLIENT_KEY.slice(-4)}` : 'Not configured',
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error in /api/config endpoint:', error);
        throw error;
    }
});

// Debug database endpoint
router.get('/api/debug/database', async (request, env) => {
    try {
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Test if database is accessible
        let dbStatus = "Unknown";
        try {
            // Attempt to run a simple query
            const result = await env.DB.prepare('SELECT 1 AS test').first();
            dbStatus = result && result.test === 1 ? "Connected" : "Error";
        } catch (dbError) {
            dbStatus = "Error: " + dbError.message;
        }
        
        return new Response(JSON.stringify({
            success: true,
            database_status: dbStatus,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Database debug endpoint error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
});

// 404 handler
router.all('*', () => {
    return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    }), {
        status: 404,
        headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
});

export default {
    async fetch(request, env, ctx) {
        try {
            console.log('Worker starting request handling:', request.url);
            console.log('Environment bindings:', {
                has_DB: !!env.DB,
                has_MIDTRANS_SERVER_KEY: !!env.MIDTRANS_SERVER_KEY,
                has_MIDTRANS_CLIENT_KEY: !!env.MIDTRANS_CLIENT_KEY,
                has_MIDTRANS_IS_PRODUCTION: !!env.MIDTRANS_IS_PRODUCTION,
                has_APP_NAME: !!env.APP_NAME
            });
            
            console.log('About to call router.handle');
            // Add timeout protection to the router.handle call
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Router handling timeout after 5s')), 5000);
            });
            
            try {
                const routerPromise = router.handle(request, env, ctx);
                // Race between router handling and timeout
                return await Promise.race([routerPromise, timeoutPromise]);
            } catch (routerError) {
                console.error('Error in router.handle:', routerError);
                throw routerError;
            }
        } catch (error) {
            console.error('Worker error:', error.message);
            console.error('Error stack:', error.stack);
            // Ensure corsHeaders is defined in the error handler
                                    const errorCorsHeaders = corsHeaders || {
                'Access-Control-Allow-Origin': 'https://tagihan.kurniasari.co.id',
                'Vary': 'Origin',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            };
            
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred: ' + error.message
            }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    ...errorCorsHeaders
                }
            });
        }
    }
};

