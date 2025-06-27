// Trigger redeploy to update secrets (v1)
import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById } from './handlers/orders.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from './handlers/products.js';
import { handleMidtransWebhook, checkTransactionStatus } from './handlers/webhook.js';

console.log('Initializing router');
const router = Router();
console.log('Router initialized successfully');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight requests
router.options('*', () => {
    return new Response(null, {
        status: 200,
        headers: corsHeaders
    });
});

// Health check endpoint - simplified for debugging
router.get('/', () => {
    console.log('Handling root endpoint request - simplified');
    return new Response('OK', {
        status: 200,
        headers: corsHeaders
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
    request.corsHeaders = corsHeaders;
    return getOrderById(request, env);
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

// Payment webhook endpoint
router.post('/api/webhook/midtrans', handleMidtransWebhook);

// Transaction status check endpoint
router.get('/api/transaction/:orderId/status', async (request, env) => {
    try {
        const { orderId } = request.params;
        const status = await checkTransactionStatus(orderId, env);
        
        return new Response(JSON.stringify({
            success: true,
            transaction_status: status
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Configuration endpoint (for debugging)
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
                'Access-Control-Allow-Origin': '*',
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

