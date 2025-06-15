import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById } from './handlers/orders.js';
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

// Health check endpoint
router.get('/', (request, env) => {
    console.log('Handling root endpoint request');
    try {
        return new Response(JSON.stringify({
            message: 'Order Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: env.MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'development'
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error in root endpoint:', error);
        throw error;
    }
});

// Order management endpoints
router.post('/api/orders', createOrder);
router.get('/api/orders', getOrders);
router.get('/api/orders/:id', getOrderById);

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
            has_DB: !!env.DB
        });
        
        return new Response(JSON.stringify({
            environment: env.MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'development',
            app_name: env.APP_NAME || 'Order Management System',
            has_midtrans_config: !!(env.MIDTRANS_SERVER_KEY && env.MIDTRANS_CLIENT_KEY),
            has_database: !!env.DB,
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
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred: ' + error.message
            }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};

