import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById } from './handlers/orders.js';
import { handleMidtransWebhook, checkTransactionStatus } from './handlers/webhook.js';

const router = Router();

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
            
            return await router.handle(request, env, ctx);
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

