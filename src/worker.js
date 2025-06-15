import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById, updateOrderStatus } from './handlers/orders.js';
import { handleMidtransWebhook } from './handlers/webhook.js';

const router = Router();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Add CORS to all responses
function addCorsHeaders(response) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

// Handle CORS preflight requests
router.options('*', () => new Response(null, { headers: corsHeaders }));

// API Routes
router.post('/api/orders', createOrder);
router.get('/api/orders', getOrders);
router.get('/api/orders/:id', getOrderById);
router.put('/api/orders/:id/status', updateOrderStatus);
router.post('/api/webhook/midtrans', handleMidtransWebhook);

// Serve static files
router.get('*', async (request, env) => {
    try {
        // Try to serve static files from public directory
        const url = new URL(request.url);
        let pathname = url.pathname;
        
        // Default to index.html for SPA routing
        if (pathname === '/' || !pathname.includes('.')) {
            pathname = '/index.html';
        }
        
        // For now, return a simple HTML page
        if (pathname === '/index.html') {
            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Management System</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-center mb-8">Order Management System</h1>
        <div class="text-center">
            <p class="text-gray-600 mb-4">API is running successfully!</p>
            <p class="text-sm text-gray-500">Frontend will be implemented in the next phase.</p>
        </div>
    </div>
</body>
</html>`;
            return addCorsHeaders(new Response(html, {
                headers: { 'Content-Type': 'text/html' }
            }));
        }
        
        return addCorsHeaders(new Response('Not Found', { status: 404 }));
    } catch (error) {
        return addCorsHeaders(new Response('Internal Server Error', { status: 500 }));
    }
});

export default {
    async fetch(request, env, ctx) {
        try {
            const response = await router.handle(request, env, ctx);
            return addCorsHeaders(response);
        } catch (error) {
            console.error('Worker error:', error);
            return addCorsHeaders(new Response('Internal Server Error', { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
    }
};

