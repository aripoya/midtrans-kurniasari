// Trigger redeploy to update secrets (v1)
import { Router } from 'itty-router';
import { createOrder, getOrders, getOrderById, updateOrderStatus, updateOrderDetails, refreshOrderStatus, getAdminOrders, deleteOrder, getOutletOrders, getDeliveryOrders } from './handlers/orders.js';
import { debugOutletOrderFiltering, fixOutletOrderAssignment } from './handlers/debug-outlet.js';
import { getOutletOrdersRelational, migrateOrdersToRelational } from './handlers/orders-relational.js';
import { updateOutletOrderStatus } from './handlers/outletOrderUpdate.js';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from './handlers/notifications.js';
import { markOrderAsReceived } from './handlers/received.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from './handlers/products.js';
// Legacy shipping handler removed - using direct Cloudflare Images endpoints instead
import { getLocations } from './handlers/locations.js';
import { registerUser, loginUser, getUserProfile, getOutlets, createOutlet } from './handlers/auth.js';
import { verifyToken, handleMiddlewareError } from './handlers/middleware.js';
import { resetAdminPassword } from './handlers/admin.js'; // Import the new handler
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from './handlers/user-management.js'; // Import user management handlers
import { resetOutletPassword, checkDatabaseSchema, createCustomersTable, testLogin, getTableSchema, analyzeOutletLocations, createRealOutlets, mapOrdersToOutlets, resetAdminPasswordForDebug, debugDeliveryAssignments, addEmailColumnToUsers, addUpdatedAtColumnToUsers, debugCreateOrderUpdateLogsTable, modifyUpdateOrderStatus, debugOrderDetails, debugOutletSync } from './handlers/debug.js';
import { migrateExistingOrdersToOutlets, getMigrationStatus } from './handlers/migrate-outlets.js';
import { createRelationalDBStructure, getRelationalDBStatus } from './handlers/migrate-relational-db.js';
import { migrateSafeRelationalDB, getSafeMigrationStatus } from './handlers/migrate-safe-db.js';

console.log('Initializing router');
const router = Router();
console.log('Router initialized successfully');

// CORS headers for all responses
const corsHeaders = (request) => {
    // Define allowed origins
    const allowedOrigins = [
        'https://kurniasari.co.id', 
        'https://www.kurniasari.co.id', 
        'https://tagihan.kurniasari.co.id', 
        'http://localhost:5173', 
        'http://172.16.1.5:5173',
        'https://order-management-app-production.wahwooh.workers.dev', // Production frontend
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://127.0.0.1:5176',
        'http://127.0.0.1:5177'
    ];
    
    const origin = request.headers.get('Origin');

    // Enhanced CORS for development and production
    let allowedOrigin;
    if (allowedOrigins.includes(origin)) {
        allowedOrigin = origin;
    } else if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        allowedOrigin = origin; // Allow any localhost/127.0.0.1 origin for development
    } else {
        allowedOrigin = '*'; // Fallback to allow all for testing
    }
        
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
        'Access-Control-Allow-Credentials': 'true',
    };
};

// Handle CORS preflight requests
router.options('*', (request) => {
    console.log('Handling OPTIONS request for path:', request.url);
    const headers = corsHeaders(request);
    console.log('CORS headers for OPTIONS:', headers);
    return new Response(null, {
        status: 200,
        headers: headers
    });
});

// Auth endpoints
router.post('/api/auth/register', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return registerUser(request, env);
});
router.post('/api/auth/login', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return loginUser(request, env);
});
// Handle login without /api prefix for backward compatibility
router.post('/auth/login', (request, env) => {
    console.log('Receiving login request at /auth/login (without /api prefix)');
    request.corsHeaders = corsHeaders(request);
    return loginUser(request, env);
});
router.get('/api/auth/profile', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getUserProfile(request, env);
});

// Tambahan endpoint /auth/profile tanpa prefix /api untuk mengatasi masalah CORS
router.get('/auth/profile', verifyToken, (request, env) => {
    console.log('Receiving profile request at /auth/profile (without /api prefix)');
    request.corsHeaders = corsHeaders(request);
    return getUserProfile(request, env);
});

// Outlet endpoints (Admin only)
router.get('/api/outlets', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getOutlets(request, env);
});
router.post('/api/outlets', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createOutlet(request, env);
});

// Order endpoints
router.post('/api/orders', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createOrder(request, env);
});
router.get('/api/orders', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getOrders(request, env);
});
router.get('/api/orders/admin', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getAdminOrders(request, env);
});
router.get('/api/orders/outlet', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getOutletOrders(request, env);
});

// NEW: Relational outlet orders endpoint (proper JOIN approach)
router.get('/api/orders/outlet-relational', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getOutletOrdersRelational(request, env);
});
router.get('/api/orders/delivery', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getDeliveryOrders(request, env);
});
router.get('/api/orders/:id', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getOrderById(request, env);
});
// CORS preflight handler for updating order status
router.options('/api/orders/:id/status', (request) => {
    // Mirror dynamic CORS headers if previously set on request
    const headers = request.corsHeaders || {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    return new Response(null, { headers });
});

// Update order shipping status (admin, outlet, deliveryman)
router.put('/api/orders/:id/status', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateOrderStatus(request, env);
});
router.put('/api/orders/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateOrderDetails(request, env);
});
router.patch('/api/orders/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateOrderDetails(request, env);
});
// Outlet-specific endpoint for updating shipping status
router.put('/api/orders/:id/update-status', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateOutletOrderStatus(request, env);
});
router.post('/api/orders/:id/refresh-status', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return refreshOrderStatus(request, env);
});
router.delete('/api/orders/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return deleteOrder(request, env);
});

// Photo upload endpoint for outlets (legacy)
router.post('/api/orders/upload-photo', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return uploadOrderPhoto(request, env);
});

// Modern shipping images endpoint (compatible with adminApi.uploadShippingImage)
router.post('/api/orders/:id/shipping-images', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return uploadShippingImageModern(request, env);
});

// Get shipping images for order
router.get('/api/orders/:id/shipping-images', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getShippingImagesModern(request, env);
});

// Notification endpoints
router.get('/api/notifications', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getUserNotifications(request, env);
});
router.post('/api/notifications/:id/read', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return markNotificationRead(request, env);
});
router.post('/api/notifications/read-all', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return markAllNotificationsRead(request, env);
});

// Public order tracking page (no authentication required)
router.get('/orders/:id', (request, env) => {
    console.log('⭐ Public Order Page Accessed:', request.url);
    request.corsHeaders = corsHeaders(request);
    return getOrderById(request, env);
});

// Received endpoint
router.post('/api/received', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return markOrderAsReceived(request, env);
});

// Location endpoint
router.get('/api/locations', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getLocations(request, env);
});

// Product management endpoints
router.get('/api/products', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getProducts(request, env);
});
router.post('/api/products', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createProduct(request, env);
});
router.put('/api/products/:id', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateProduct(request, env);
});
router.delete('/api/products/:id', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return deleteProduct(request, env);
});

// User Management endpoints with proper CORS handling

// GET /api/admin/users - Fetch all users
router.get('/api/admin/users', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getUsers(request, env);
});

// POST /api/admin/users - Create a new user
router.post('/api/admin/users', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createUser(request, env);
});

// PUT /api/admin/users/:id - Update an existing user
router.put('/api/admin/users/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateUser(request, env);
});

// OPTIONS handler for /api/admin/users (preflight)
router.options('/api/admin/users', (request, env) => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
});
router.get('/api/admin/users', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getUsers(request, env);
});
// OPTIONS handler for POST /api/admin/users (create user)
router.options('/api/admin/users', (request, env) => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
});
router.post('/api/admin/users', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createUser(request, env);
});
// OPTIONS handler for PUT /api/admin/users/:id (update user)
router.options('/api/admin/users/:id', (request, env) => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
});
router.put('/api/admin/users/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return updateUser(request, env);
});
// OPTIONS handler for DELETE /api/admin/users/:id (delete user)  
router.options('/api/admin/users/:id', (request, env) => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
});
router.delete('/api/admin/users/:id', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return deleteUser(request, env);
});
// OPTIONS handler for POST /api/admin/users/:id/reset-password (reset password)
router.options('/api/admin/users/:id/reset-password', (request, env) => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
});
router.post('/api/admin/users/:id/reset-password', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return resetUserPassword(request, env);
});

// Outlet Migration endpoints
router.post('/api/admin/migrate-outlets', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return migrateExistingOrdersToOutlets(request, env);
});

router.get('/api/admin/migration-status', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getMigrationStatus(request, env);
});

// Relational Database Migration endpoints
router.post('/api/admin/migrate-relational-db', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createRelationalDBStructure(request, env);
});

router.get('/api/admin/relational-db-status', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getRelationalDBStatus(request, env);
});

// Safe Migration endpoints (bypass FK constraints)
router.post('/api/admin/migrate-safe-db', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return migrateSafeRelationalDB(request, env);
});

router.get('/api/admin/safe-migration-status', verifyToken, (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getSafeMigrationStatus(request, env);
});

// Cloudflare Images endpoints for image uploads and management
import { uploadToCloudflareImages, deleteFromCloudflareImages, getImageVariants } from './handlers/cloudflare-images.js';

// Upload shipping image to Cloudflare Images
router.post('/api/shipping/images/:orderId/:imageType', verifyToken, async (request, env) => {
    try {
        const { orderId, imageType } = request.params;
        
        // Validate image type
        const validTypes = ['ready_for_pickup', 'picked_up', 'delivered', 'shipment_proof', 'packaged_product'];
        if (!validTypes.includes(imageType)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid image type',
                validTypes
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Validate order exists
        const orderExists = await env.DB.prepare(
            'SELECT id FROM orders WHERE id = ?'
        ).bind(orderId).first();
        
        if (!orderExists) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Handle multipart/form-data
        const formData = await request.formData();
        const file = formData.get('image');
        
        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No image provided'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Upload to Cloudflare Images
        const uploadResult = await uploadToCloudflareImages(file, env);
        
        if (!uploadResult.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to upload image',
                details: uploadResult.error
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Get image data from upload result
        const { imageId, publicUrl } = uploadResult.data;
        const imageUrl = publicUrl;
        
        // Remove old image reference if exists
        await env.DB.prepare(
            'DELETE FROM shipping_images WHERE order_id = ? AND image_type = ?'
        ).bind(orderId, imageType).run();
        
        // Save image reference to database
        await env.DB.prepare(
            'INSERT INTO shipping_images (order_id, image_type, image_url, cloudflare_image_id) VALUES (?, ?, ?, ?)'
        ).bind(orderId, imageType, imageUrl, imageId).run();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Image uploaded successfully to Cloudflare Images',
            data: {
                orderId,
                imageType,
                imageUrl,
                imageId: imageId,
                variants: getImageVariants(imageId, env.CLOUDFLARE_IMAGES_HASH)
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('Error uploading to Cloudflare Images:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to upload image',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Get shipping images from database
router.get('/api/shipping/images/:orderId', verifyToken, async (request, env) => {
    try {
        const { orderId } = request.params;
        
        // Get all images for this order
        const images = await env.DB.prepare(
            'SELECT image_type, image_url, cloudflare_image_id FROM shipping_images WHERE order_id = ?'
        ).bind(orderId).all();
        
        // Format response with variants
        const formattedImages = {};
        
        for (const img of images.results || []) {
            if (img.cloudflare_image_id) {
                formattedImages[img.image_type] = {
                    url: img.image_url,
                    imageId: img.cloudflare_image_id,
                    variants: getImageVariants(img.cloudflare_image_id, env.CLOUDFLARE_IMAGES_HASH)
                };
            } else {
                // Fallback for legacy images without cloudflare_image_id
                formattedImages[img.image_type] = {
                    url: img.image_url,
                    imageId: null,
                    variants: null
                };
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: formattedImages
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('Error getting shipping images:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to get images',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Delete shipping image from Cloudflare Images
router.delete('/api/shipping/images/:orderId/:imageType', verifyToken, async (request, env) => {
    try {
        const { orderId, imageType } = request.params;
        
        // Get image info from database
        const imageInfo = await env.DB.prepare(
            'SELECT cloudflare_image_id FROM shipping_images WHERE order_id = ? AND image_type = ?'
        ).bind(orderId, imageType).first();
        
        if (!imageInfo) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Image not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Delete from Cloudflare Images if we have the image ID
        if (imageInfo.cloudflare_image_id) {
            const deleteResult = await deleteFromCloudflareImages(imageInfo.cloudflare_image_id, env);
            if (!deleteResult.success) {
                console.warn('Failed to delete from Cloudflare Images:', deleteResult.error);
                // Continue with database deletion even if Cloudflare deletion fails
            }
        }
        
        // Delete from database
        await env.DB.prepare(
            'DELETE FROM shipping_images WHERE order_id = ? AND image_type = ?'
        ).bind(orderId, imageType).run();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Image deleted successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('Error deleting shipping image:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to delete image',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
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
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('Error in /debug/midtrans:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get Midtrans config',
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
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

// Debug endpoint untuk menguji login step-by-step (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/test-login', async (request, env) => {
    try {
        console.log('DEBUG LOGIN: Starting debug test');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Test 1: Query user from database
        console.log('DEBUG LOGIN: Testing database query');
        const user = await env.DB.prepare('SELECT id, username, password, role, outlet_id FROM users WHERE username = ?')
            .bind('outlet')
            .first();
        
        console.log('DEBUG LOGIN: User query result:', user);
        
        if (!user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'User not found',
                step: 'database_query'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Test 2: Check bcrypt availability
        console.log('DEBUG LOGIN: Testing bcrypt import');
        const bcrypt = require('bcryptjs');
        if (!bcrypt) {
            return new Response(JSON.stringify({
                success: false,
                error: 'bcrypt not available',
                step: 'bcrypt_import'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Test 3: Test password comparison
        console.log('DEBUG LOGIN: Testing password comparison');
        const testPassword = 'outlet123';
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log('DEBUG LOGIN: Password match result:', isMatch);
        
        // Test 4: Check JWT availability
        console.log('DEBUG LOGIN: Testing JWT');
        const jwt = require('jsonwebtoken');
        if (!jwt || !env.JWT_SECRET) {
            return new Response(JSON.stringify({
                success: false,
                error: 'JWT not available or secret missing',
                step: 'jwt_test',
                jwt_available: !!jwt,
                secret_available: !!env.JWT_SECRET
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'All login components working',
            tests: {
                database_query: 'passed',
                user_found: !!user,
                bcrypt_available: !!bcrypt,
                password_match: isMatch,
                jwt_available: !!jwt,
                secret_available: !!env.JWT_SECRET
            },
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                outlet_id: user.outlet_id,
                password_hash_length: user.password ? user.password.length : 0
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    } catch (error) {
        console.error('DEBUG LOGIN ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
            step: 'debug_error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to reset outlet password (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/reset-outlet-password', async (request, env) => {
    try {
        console.log('RESET PASSWORD: Starting outlet password reset');
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }

        // Import bcryptjs
        const bcrypt = require('bcryptjs');
        
        // Generate a new password hash
        console.log('RESET PASSWORD: Generating password hash');
        const username = 'outlet'; // Correct username from DB
        const password = 'outlet123';
        console.log('RESET PASSWORD: Generating hash for', username);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('RESET PASSWORD: New hash generated for user:', username, hashedPassword);
        
        // Update the outlet user
        console.log('RESET PASSWORD: Updating user with new hash');
        const result = await env.DB.prepare(
            'UPDATE users SET password = ? WHERE username = ?'
        ).bind(hashedPassword, username).run();
        
        console.log('RESET PASSWORD: Update result:', JSON.stringify(result));
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Outlet password reset successfully',
            hash_generated: hashedPassword,
            affected_rows: result.meta.changes
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    } catch (error) {
        console.error('RESET PASSWORD ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to add email column to users table
router.post('/api/debug/add-email-column', async (request, env) => {
    console.log('DEBUG: Adding email column to users table');
    request.corsHeaders = corsHeaders(request);
    return addEmailColumnToUsers(request, env);
});

// Debug endpoint to add updated_at column to users table
router.post('/api/debug/add-updated-at-column', async (request, env) => {
    console.log('DEBUG: Adding updated_at column to users table');
    request.corsHeaders = corsHeaders(request);
    return addUpdatedAtColumnToUsers(request, env);
});

// Debug endpoint to add missing photo columns (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/add-photo-columns', async (request, env) => {
    try {
        console.log('ADD PHOTO COLUMNS: Starting database schema migration');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Add photo columns to orders table
        const columns = [
            'readyForPickup_photo_url',
            'pickedUp_photo_url', 
            'delivered_photo_url'
        ];
        
        const results = [];
        
        for (const column of columns) {
            try {
                const result = await env.DB.prepare(
                    `ALTER TABLE orders ADD COLUMN ${column} TEXT`
                ).run();
                
                results.push({
                    column: column,
                    success: true,
                    result: result
                });
                
                console.log(`ADD PHOTO COLUMNS: Successfully added column ${column}`);
            } catch (columnError) {
                console.log(`ADD PHOTO COLUMNS: Column ${column} might already exist or error:`, columnError.message);
                results.push({
                    column: column,
                    success: false,
                    error: columnError.message,
                    note: 'Column might already exist'
                });
            }
        }
        
        // Verify columns were added by checking schema
        const schemaResult = await env.DB.prepare('PRAGMA table_info(orders)').all();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Photo columns migration completed',
            results: results,
            current_schema: schemaResult.results
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('ADD PHOTO COLUMNS ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to check shipping images table and R2 configuration (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/check-shipping-setup', async (request, env) => {
    try {
        console.log('SHIPPING SETUP CHECK: Starting checks');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Check if shipping_images table exists
        console.log('SHIPPING SETUP CHECK: Checking shipping_images table');
        let shippingTableExists = false;
        try {
            const tableCheck = await env.DB.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='shipping_images'"
            ).first();
            shippingTableExists = !!tableCheck;
            console.log('SHIPPING SETUP CHECK: shipping_images table exists:', shippingTableExists);
        } catch (tableError) {
            console.error('SHIPPING SETUP CHECK: Error checking table:', tableError);
        }
        
        // Check R2 binding
        let r2Available = false;
        try {
            r2Available = !!env.SHIPPING_IMAGES;
            console.log('SHIPPING SETUP CHECK: R2 SHIPPING_IMAGES binding available:', r2Available);
        } catch (r2Error) {
            console.error('SHIPPING SETUP CHECK: R2 error:', r2Error);
        }
        
        // Get sample order for testing
        const sampleOrder = await env.DB.prepare(
            'SELECT id FROM orders LIMIT 1'
        ).first();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Shipping setup check completed',
            checks: {
                database_available: !!env.DB,
                shipping_images_table_exists: shippingTableExists,
                r2_binding_available: r2Available,
                sample_order_id: sampleOrder?.id || null
            },
            next_steps: shippingTableExists ? 
                'Table exists - check upload API directly' : 
                'Create shipping_images table first'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('SHIPPING SETUP CHECK ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to create shipping_images table if missing (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/create-shipping-table', async (request, env) => {
    try {
        console.log('CREATE SHIPPING TABLE: Starting table creation');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Create shipping_images table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS shipping_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                image_type TEXT NOT NULL,
                image_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(order_id, image_type)
            )
        `;
        
        const result = await env.DB.prepare(createTableSQL).run();
        console.log('CREATE SHIPPING TABLE: Table creation result:', result);
        
        // Verify table was created
        const verifyTable = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='shipping_images'"
        ).first();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'shipping_images table created successfully',
            table_created: !!verifyTable,
            creation_result: result
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('CREATE SHIPPING TABLE ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to test actual shipping upload API (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/test-shipping-upload-api', async (request, env) => {
    try {
        console.log('TEST SHIPPING UPLOAD API: Starting test');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Get a test order ID
        const testOrder = await env.DB.prepare(
            'SELECT id FROM orders LIMIT 1'
        ).first();
        
        if (!testOrder) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No test order available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Test different upload URL formats to debug routing
        const testUrls = [
            `/api/shipping/images/${testOrder.id}/ready_for_pickup`,
            `/api/shipping/images/${testOrder.id}/shipment_proof`,
            `/api/shipping/images/${testOrder.id}/delivered`
        ];
        
        const testResults = [];
        
        for (const testUrl of testUrls) {
            console.log(`TEST SHIPPING UPLOAD API: Testing URL: ${testUrl}`);
            
            // Test with GET first to see if routing works
            try {
                const testRequestUrl = new URL(`https://example.com${testUrl}`);
                const testRequest = new Request(testRequestUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                // Legacy shipping handler test removed - using direct Cloudflare Images endpoints now
                testResults.push({
                    url: testUrl,
                    method: 'GET',
                    status: 'SKIPPED',
                    response: 'Legacy handler removed - using direct endpoints'
                });
                
            } catch (testError) {
                console.error(`TEST SHIPPING UPLOAD API: Error testing ${testUrl}:`, testError);
                testResults.push({
                    url: testUrl,
                    method: 'GET',
                    error: testError.message
                });
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Shipping upload API test completed',
            test_order_id: testOrder.id,
            routing_tests: testResults,
            backend_config: {
                has_shipping_handler: false, // Legacy handler removed
                has_r2_binding: !!env.SHIPPING_IMAGES,
                has_db_binding: !!env.DB,
                uses_cloudflare_images: true
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('TEST SHIPPING UPLOAD API ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to test actual upload process with authentication (TEMPORARY - REMOVE AFTER USE)
router.post('/api/debug/test-upload-full', async (request, env) => {
    try {
        console.log('FULL UPLOAD TEST: Starting comprehensive test');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Check authentication
        const authHeader = request.headers.get('Authorization');
        console.log('FULL UPLOAD TEST: Auth header:', authHeader ? 'Present' : 'Missing');
        
        // Get test order
        const testOrder = await env.DB.prepare(
            'SELECT id FROM orders LIMIT 1'
        ).first();
        
        if (!testOrder) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No test order available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Create a test FormData with dummy image
        const testImageUrl = new URL(`https://example.com/api/shipping/images/${testOrder.id}/ready_for_pickup`);
        const testUploadRequest = new Request(testImageUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader || 'Bearer test-token',
                'Content-Type': 'multipart/form-data'
            },
            body: request.body // Forward the actual FormData from frontend
        });
        
        // Test actual upload handler
        console.log('FULL UPLOAD TEST: Testing upload handler with:', {
            url: testImageUrl.toString(),
            method: 'POST',
            hasAuth: !!authHeader,
            hasBody: !!request.body
        });
        
        try {
            // Legacy handler removed - testing direct Cloudflare Images endpoint instead
            const uploadResponse = 'Legacy handler removed - use direct /api/shipping/images endpoints';
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Full upload test completed',
                test_order_id: testOrder.id,
                auth_provided: !!authHeader,
                upload_test: {
                    status: 'SKIPPED',
                    response: uploadResponse,
                    success: false,
                    note: 'Legacy handler removed - use direct Cloudflare Images endpoints'
                },
                backend_config: {
                    has_shipping_handler: false, // Legacy handler removed
                    has_r2_binding: !!env.SHIPPING_IMAGES,
                    has_db_binding: !!env.DB,
                    uses_cloudflare_images: true
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
            
        } catch (uploadError) {
            console.error('FULL UPLOAD TEST: Upload handler error:', uploadError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Upload handler failed',
                details: uploadError.message,
                test_order_id: testOrder.id,
                auth_provided: !!authHeader
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
    } catch (error) {
        console.error('FULL UPLOAD TEST ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to test FormData parsing and file handling (TEMPORARY - REMOVE AFTER USE)
router.post('/api/debug/test-formdata', async (request, env) => {
    try {
        console.log('FORMDATA TEST: Starting FormData parsing test');
        
        // Check request method and content type
        const method = request.method;
        const contentType = request.headers.get('content-type');
        const authHeader = request.headers.get('authorization');
        
        console.log('FORMDATA TEST: Request details:', {
            method,
            contentType,
            hasAuth: !!authHeader,
            hasBody: !!request.body
        });
        
        if (method !== 'POST') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Method not allowed, use POST'
            }), {
                status: 405,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Test FormData parsing
        let formData;
        let file;
        let parseError = null;
        
        try {
            formData = await request.formData();
            file = formData.get('image');
            console.log('FORMDATA TEST: FormData parsed successfully');
            console.log('FORMDATA TEST: File details:', {
                hasFile: !!file,
                isFileInstance: file instanceof File,
                fileName: file?.name,
                fileSize: file?.size,
                fileType: file?.type
            });
        } catch (formError) {
            parseError = formError.message;
            console.error('FORMDATA TEST: FormData parse error:', formError);
        }
        
        // Test file validation
        let validationResults = {};
        if (file && file instanceof File) {
            const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            validationResults = {
                validMimeType: validMimeTypes.includes(file.type),
                fileSizeOK: file.size <= 5 * 1024 * 1024, // 5MB max
                hasName: !!file.name
            };
        }
        
        // Test R2 availability (without actual upload)
        const r2Available = !!env.SHIPPING_IMAGES;
        const dbAvailable = !!env.DB;
        
        return new Response(JSON.stringify({
            success: true,
            message: 'FormData test completed',
            test_results: {
                request_valid: method === 'POST',
                content_type: contentType,
                formdata_parsed: !parseError,
                parse_error: parseError,
                file_received: !!file,
                file_is_valid_instance: file instanceof File,
                file_details: file ? {
                    name: file.name,
                    size: file.size,
                    type: file.type
                } : null,
                validation_results: validationResults,
                backend_ready: {
                    r2_available: r2Available,
                    db_available: dbAvailable
                }
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('FORMDATA TEST ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint to test photo upload functionality (TEMPORARY - REMOVE AFTER USE)
router.get('/api/debug/test-photo-upload', async (request, env) => {
    try {
        console.log('TEST PHOTO UPLOAD: Starting test');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
        }
        
        // Check if photo columns exist
        const schemaResult = await env.DB.prepare('PRAGMA table_info(orders)').all();
        const photoColumns = schemaResult.results.filter(col => 
            col.name.includes('photo_url')
        );
        
        // Check if there are any orders with photo URLs
        const ordersWithPhotos = await env.DB.prepare(
            'SELECT id, readyForPickup_photo_url, pickedUp_photo_url, delivered_photo_url FROM orders WHERE readyForPickup_photo_url IS NOT NULL OR pickedUp_photo_url IS NOT NULL OR delivered_photo_url IS NOT NULL'
        ).all();
        
        // Get sample order for testing
        const sampleOrder = await env.DB.prepare(
            'SELECT * FROM orders LIMIT 1'
        ).first();
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Photo upload test completed',
            photo_columns: photoColumns,
            orders_with_photos: ordersWithPhotos.results || [],
            sample_order: sampleOrder,
            endpoint_available: true
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
        
    } catch (error) {
        console.error('TEST PHOTO UPLOAD ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
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
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
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
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    } catch (error) {
        console.error('Database debug endpoint error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
    }
});

// Debug endpoint for database schema
router.get('/api/debug/schema', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return checkDatabaseSchema(request, env);
});

// Debug endpoint to create customers table
router.post('/api/debug/create-customers-table', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createCustomersTable(request, env);
});

// Debug endpoint to get table schema
router.get('/api/debug/table-schema', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return getTableSchema(request, env);
});

// DEBUG ONLY endpoints
// Reset outlet password for debug purposes
router.get('/api/debug/reset-outlet-password', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return resetOutletPassword(request, env);
});

// Create order_update_logs table for tracking status changes
router.get('/api/debug/create-order-update-logs-table', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return debugCreateOrderUpdateLogsTable(request, env);
});

// Debug endpoint to create real outlets
router.post('/api/debug/create-real-outlets', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return createRealOutlets(request, env);
});

// Debug endpoint to map orders to outlets
router.post('/api/debug/map-orders-to-outlets', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return mapOrdersToOutlets(request, env);
});

// GET version for easy access to fix assignment data
router.get('/api/debug/fix-assignment-data', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return mapOrdersToOutlets(request, env);
});

// Direct fix for specific order
router.get('/api/debug/fix-specific-order', async (request, env) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    try {
        const orderId = 'ORDER-1752037059362-FLO3E';
        
        // Check current state
        const before = await env.DB.prepare(
            'SELECT id, lokasi_pengiriman, outlet_id FROM orders WHERE id = ?'
        ).bind(orderId).first();
        
        // Force update to correct outlet
        const updateResult = await env.DB.prepare(
            'UPDATE orders SET outlet_id = ? WHERE id = ?'
        ).bind('outlet_bonbin', orderId).run();
        
        // Check after state
        const after = await env.DB.prepare(
            'SELECT id, lokasi_pengiriman, outlet_id FROM orders WHERE id = ?'
        ).bind(orderId).first();
        
        return new Response(JSON.stringify({
            success: true,
            orderId: orderId,
            before: before,
            after: after,
            updateResult: {
                changes: updateResult.changes,
                success: updateResult.success
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Debug endpoint to check delivery assignments
router.get('/api/debug/delivery-assignments', (request, env) => {
    request.corsHeaders = corsHeaders(request);
    return debugDeliveryAssignments(request, env);
});

// Debug endpoint to migrate shipping_images table for Cloudflare Images
router.post('/api/debug/migrate-shipping-images-table', async (request, env) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('MIGRATE SHIPPING IMAGES TABLE: Starting migration');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Check current table schema
        const tableInfo = await env.DB.prepare(
            "PRAGMA table_info(shipping_images)"
        ).all();
        
        console.log('Current shipping_images table schema:', JSON.stringify(tableInfo, null, 2));
        
        // Check if cloudflare_image_id column already exists
        const hasCloudflareImageId = tableInfo.results.some(col => col.name === 'cloudflare_image_id');
        
        if (hasCloudflareImageId) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Table already has cloudflare_image_id column',
                schema: tableInfo.results
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Add cloudflare_image_id column
        await env.DB.prepare(
            'ALTER TABLE shipping_images ADD COLUMN cloudflare_image_id TEXT'
        ).run();
        
        console.log('Added cloudflare_image_id column to shipping_images table');
        
        // Verify the column was added
        const updatedTableInfo = await env.DB.prepare(
            "PRAGMA table_info(shipping_images)"
        ).all();
        
        console.log('Updated shipping_images table schema:', JSON.stringify(updatedTableInfo, null, 2));
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Successfully added cloudflare_image_id column to shipping_images table',
            oldSchema: tableInfo.results,
            newSchema: updatedTableInfo.results
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        console.error('Error migrating shipping_images table:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to migrate table',
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
});

// Debug endpoint to test Cloudflare Images upload with real image
router.post('/api/debug/test-cloudflare-images-upload', async (request, env) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('TEST CLOUDFLARE IMAGES UPLOAD: Starting comprehensive test');
        
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Check Cloudflare Images environment variables
        const { CLOUDFLARE_ACCOUNT_ID, CF_IMAGES_TOKEN, CLOUDFLARE_IMAGES_HASH } = env;
        
        if (!CLOUDFLARE_ACCOUNT_ID || !CF_IMAGES_TOKEN || !CLOUDFLARE_IMAGES_HASH) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cloudflare Images credentials not configured',
                missing: {
                    CLOUDFLARE_ACCOUNT_ID: !CLOUDFLARE_ACCOUNT_ID,
                    CF_IMAGES_TOKEN: !CF_IMAGES_TOKEN,
                    CLOUDFLARE_IMAGES_HASH: !CLOUDFLARE_IMAGES_HASH
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Cloudflare Images credentials found');
        
        // Get a test order ID
        const testOrder = await env.DB.prepare(
            'SELECT id FROM orders LIMIT 1'
        ).first();
        
        if (!testOrder) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No test order available'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Test order found:', testOrder.id);
        
        // Create a test image (1x1 PNG)
        const testImageData = new Uint8Array([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
            0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00,
            0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        const testFile = new File([testImageData], 'test-image.png', { type: 'image/png' });
        console.log('Test image created:', testFile.name, 'Size:', testFile.size, 'bytes');
        
        // Test upload using the new endpoint logic
        const uploadResult = await uploadToCloudflareImages(testFile, env);
        
        if (!uploadResult.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to upload test image to Cloudflare Images',
                details: uploadResult.error
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Cloudflare Images upload successful:', JSON.stringify(uploadResult, null, 2));
        
        // Get image data from upload result
        const { imageId, publicUrl } = uploadResult.data;
        const imageType = 'test_upload';
        
        // Save to database
        await env.DB.prepare(
            'INSERT OR REPLACE INTO shipping_images (order_id, image_type, image_url, cloudflare_image_id) VALUES (?, ?, ?, ?)'
        ).bind(testOrder.id, imageType, publicUrl, imageId).run();
        
        console.log('Image saved to database');
        
        // Test retrieval
        const retrievedImages = await env.DB.prepare(
            'SELECT * FROM shipping_images WHERE order_id = ? AND image_type = ?'
        ).bind(testOrder.id, imageType).first();
        
        console.log('Retrieved from database:', JSON.stringify(retrievedImages, null, 2));
        
        // Generate variants
        const variants = getImageVariants(imageId, CLOUDFLARE_IMAGES_HASH);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Cloudflare Images upload test completed successfully',
            data: {
                uploadResult: uploadResult.data,
                orderId: testOrder.id,
                imageType,
                imageId,
                publicUrl,
                variants,
                databaseRecord: retrievedImages,
                testDetails: {
                    imageName: testFile.name,
                    imageSize: testFile.size,
                    imageType: testFile.type,
                    timestamp: new Date().toISOString()
                }
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        console.error('Error in Cloudflare Images upload test:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Test failed with exception',
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
});

// Debug endpoint untuk memeriksa sinkronisasi outlet
router.get('/api/debug/outlet-sync', async (request, env) => {
  try {
    return await debugOutletSync(request, env);
  } catch (error) {
    console.error('Debug Outlet Sync Router Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }
});

// Debug endpoint untuk memeriksa order yang tidak muncul
router.get('/api/debug/order-details', async (request, env) => {
  try {
    console.log('DEBUG ORDER: Starting order debug analysis');
    
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database binding not available'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });
    }

    const orderId = 'ORDER-1752037059362-FLO3E';
    
    // Cari detail order
    const orderQuery = `SELECT * FROM orders WHERE id = ?`;
    const order = await env.DB.prepare(orderQuery).bind(orderId).first();
    
    if (!order) {
      return new Response(JSON.stringify({
        success: false,
        message: `Order dengan ID ${orderId} tidak ditemukan`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }
    
    // Cari semua outlet untuk perbandingan - first check schema
    let outletsQuery = `SELECT * FROM outlets LIMIT 1`;
    let outletsSchema = await env.DB.prepare(outletsQuery).first();
    
    // Now get all outlets with available columns
    outletsQuery = `SELECT * FROM outlets`;
    const outlets = await env.DB.prepare(outletsQuery).all();
    
    // Cek kecocokan dengan outlet
    const matches = [];
    
    // Format nilai untuk pencarian
    const lokasi_pengiriman = (order.lokasi_pengiriman || '').toLowerCase();
    const shipping_area = (order.shipping_area || '').toLowerCase();
    
    outlets.results.forEach(outlet => {
      const outletName = (outlet.name || '').toLowerCase();
      // Use available columns (check for location, address, alamat, etc.)
      const outletLocation = (outlet.location || outlet.address || outlet.alamat || '').toLowerCase();
      
      const matched = 
        (order.outlet_id === outlet.id) || 
        lokasi_pengiriman.includes(outletName) || 
        shipping_area.includes(outletName) ||
        (outletLocation && lokasi_pengiriman.includes(outletLocation)) || 
        (outletLocation && shipping_area.includes(outletLocation)) ||
        lokasi_pengiriman.includes('bonbin') || 
        shipping_area.includes('bonbin');
      
      matches.push({
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        outlet_all_data: outlet, // Include all outlet data for debugging
        matched: matched,
        match_reason: matched ? [
          order.outlet_id === outlet.id ? 'outlet_id match' : null,
          lokasi_pengiriman.includes(outletName) ? 'lokasi_pengiriman contains outlet name' : null,
          shipping_area.includes(outletName) ? 'shipping_area contains outlet name' : null,
          (outletLocation && lokasi_pengiriman.includes(outletLocation)) ? 'lokasi_pengiriman contains outlet location' : null,
          (outletLocation && shipping_area.includes(outletLocation)) ? 'shipping_area contains outlet location' : null,
          lokasi_pengiriman.includes('bonbin') ? 'lokasi_pengiriman contains bonbin' : null,
          shipping_area.includes('bonbin') ? 'shipping_area contains bonbin' : null
        ].filter(Boolean) : []
      });
    });
    
    // Include schema info for debugging
    const debugInfo = {
      outlets_schema_sample: outletsSchema,
      total_outlets: outlets.results.length
    };
    
    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        customer_name: order.customer_name,
        lokasi_pengiriman: order.lokasi_pengiriman,
        shipping_area: order.shipping_area,
        outlet_id: order.outlet_id
      },
      outlets_match_analysis: matches,
      debug_info: debugInfo,
      all_order_props: order
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Error saat debug order',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Real-time synchronization endpoints
router.get('/api/sync/last-update', async (request, env) => {
  try {
    console.log('SYNC: Getting last update timestamp');
    
    // Get the most recent update from multiple tables
    const ordersUpdate = await env.DB.prepare(
      'SELECT MAX(updated_at) as last_update FROM orders'
    ).first();
    
    const notificationsUpdate = await env.DB.prepare(
      'SELECT MAX(created_at) as last_update FROM notifications'
    ).first();
    
    const usersUpdate = await env.DB.prepare(
      'SELECT MAX(updated_at) as last_update FROM users'
    ).first();
    
    // Find the most recent timestamp
    const timestamps = [
      ordersUpdate?.last_update,
      notificationsUpdate?.last_update, 
      usersUpdate?.last_update
    ].filter(Boolean);
    
    const lastUpdate = timestamps.length > 0 ? Math.max(...timestamps.map(t => new Date(t).getTime())) : Date.now();
    
    return new Response(JSON.stringify({
      success: true,
      lastUpdate: lastUpdate,
      timestamp: new Date(lastUpdate).toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
    
  } catch (error) {
    console.error('Error getting last update:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get last update',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }
});

// Quick status check for specific role
router.get('/api/sync/status/:role', verifyToken, async (request, env) => {
  try {
    const url = new URL(request.url);
    const role = url.pathname.split('/').pop();
    
    let query = '';
    let bindings = [];
    
    // Role-specific queries for quick status check
    switch(role) {
      case 'admin':
        query = 'SELECT COUNT(*) as total_orders, COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_orders FROM orders';
        break;
      case 'outlet':
        if (!request.user.outlet_id) {
          throw new Error('Outlet ID not found for user');
        }
        query = 'SELECT COUNT(*) as total_orders, COUNT(CASE WHEN shipping_status = "pending" THEN 1 END) as pending_orders FROM orders WHERE outlet_id = ?';
        bindings = [request.user.outlet_id];
        break;
      case 'deliveryman':
        query = 'SELECT COUNT(*) as total_orders, COUNT(CASE WHEN shipping_status = "dalam_pengiriman" THEN 1 END) as in_delivery FROM orders WHERE assigned_deliveryman_id = ?';
        bindings = [request.user.id];
        break;
      default:
        throw new Error('Invalid role specified');
    }
    
    const result = await env.DB.prepare(query).bind(...bindings).first();
    
    return new Response(JSON.stringify({
      success: true,
      role: role,
      status: result,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
    
  } catch (error) {
    console.error('Error getting role status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get role status',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }
});

// Static assets and SPA routing handler
router.all('*', (request) => {
    const url = new URL(request.url);
    
    // If it's an API route and not handled above, return 404 JSON
    if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
            error: 'Not Found',
            message: 'The requested endpoint does not exist'
        }), {
            status: 404,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders(request)
            }
        });
    }
    
    // Handle static assets - return 404 for now (will be handled by CDN/assets)
    if (url.pathname.startsWith('/assets/') || 
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.svg') || 
        url.pathname.endsWith('.png') || 
        url.pathname.endsWith('.jpg') || 
        url.pathname.endsWith('.ico')) {
        return new Response('Static asset not found', {
            status: 404,
            headers: { 
                'Content-Type': 'text/plain',
                ...corsHeaders(request)
            }
        });
    }
    
    // For SPA routes (login, dashboard, etc), serve index.html
    // This enables React Router to handle client-side routing
    const indexHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kurniasari Order Management</title>
    <script type="module" crossorigin src="/assets/index-DYyYxaB4.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Da-yJpWV.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    
    return new Response(indexHTML, {
        headers: {
            'Content-Type': 'text/html',
            ...corsHeaders(request)
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
                has_APP_NAME: !!env.APP_NAME,
                has_JWT_SECRET: !!env.JWT_SECRET, // Check for JWT_SECRET
                jwt_secret_preview: env.JWT_SECRET ? env.JWT_SECRET.substring(0, 3) + '...' : 'NOT SET' // Preview, don't log the whole secret
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
                                    const errorCorsHeaders = request ? corsHeaders(request) : {
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

// Function to handle photo upload from outlets
async function uploadOrderPhoto(request, env) {
    try {
        console.log('PHOTO UPLOAD: Starting photo upload process');
        
        // Parse form data from multipart/form-data request
        const formData = await request.formData();
        const photo = formData.get('photo');
        const orderId = formData.get('order_id');
        const photoType = formData.get('photo_type');
        
        console.log('PHOTO UPLOAD: Form data received:', {
            hasPhoto: !!photo,
            photoName: photo ? photo.name : 'none',
            photoType: photo ? photo.type : 'none',
            photoSize: photo ? photo.size : 0,
            orderId: orderId,
            photoTypeParam: photoType
        });
        
        if (!photo || !orderId || !photoType) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Missing required fields: photo, order_id, or photo_type'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Validate photo type
        const validPhotoTypes = ['readyForPickup', 'pickedUp', 'delivered'];
        if (!validPhotoTypes.includes(photoType)) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid photo_type. Must be one of: ' + validPhotoTypes.join(', ')
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Create a unique filename for the photo using order ID, photo type and timestamp
        const timestamp = Date.now();
        const fileExtension = photo.name.split('.').pop() || 'jpeg';
        const fileName = `ORDER-${orderId}_${photoType}_${timestamp}.${fileExtension}`;
        
        // Determine which storage system to use
        // Set to 'proses' for proses.kurniasari.co.id or 'r2' for Cloudflare R2
        const storageType = env.PHOTO_STORAGE_TYPE || 'r2';
        let photoUrl;
        
        // Upload photo based on selected storage type
        if (storageType === 'proses') {
            // For proses.kurniasari.co.id
            // Note: This implementation would require a separate API or webhook to upload to proses.kurniasari.co.id
            // For now, we'll just create the URL pattern and assume the upload happens elsewhere
            photoUrl = `https://proses.kurniasari.co.id/${fileName}`;
            console.log('PHOTO UPLOAD: Using proses.kurniasari.co.id storage:', photoUrl);
        } else {
            // Default: Upload to R2 Storage
            console.log('PHOTO UPLOAD: Uploading to R2 Storage:', fileName);
            
            try {
                await env.SHIPPING_IMAGES.put(fileName, photo.stream(), {
                    httpMetadata: {
                        contentType: photo.type,
                    },
                });
                
                // Generate the public URL for the uploaded photo using the R2 bucket public URL
                photoUrl = `https://13b5c18f23aa268941269ea0db1d1e5a.r2.cloudflarestorage.com/kurniasari-shipping-images/${fileName}`;
                
                console.log('PHOTO UPLOAD: File uploaded successfully to R2:', photoUrl);
            } catch (r2Error) {
                console.error('Error uploading to R2:', r2Error);
                throw new Error(`R2 upload failed: ${r2Error.message}`);
            }
        }
        
        // Get current timestamp for DB update
        const dbTimestamp = new Date().toISOString();
        
        // Update order with photo URL in database
        const columnName = `${photoType}_photo_url`;
        console.log('PHOTO UPLOAD: Attempting database update with R2 URL:', {
            columnName: columnName,
            orderId: orderId,
            photoUrl: photoUrl,
            timestamp: dbTimestamp
        });
        
        const updateResult = await env.DB.prepare(
            `UPDATE orders SET ${columnName} = ?, updated_at = ? WHERE id = ?`
        ).bind(photoUrl, dbTimestamp, orderId).run();
        
        console.log('PHOTO UPLOAD: Database update result:', updateResult);
        
        if (!updateResult.success) {
            console.error('PHOTO UPLOAD: Database update failed:', updateResult);
            throw new Error('Failed to update order with photo URL');
        }
        
        // Verify the update by selecting the order
        const verifyResult = await env.DB.prepare(
            `SELECT id, ${columnName}, updated_at FROM orders WHERE id = ?`
        ).bind(orderId).first();
        
        console.log('PHOTO UPLOAD: Verification query result:', verifyResult);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Photo uploaded successfully',
            data: {
                order_id: orderId,
                photo_type: photoType,
                photo_url: photoUrl,
                updated_at: dbTimestamp
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Internal server error: ' + error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
    }
}

// Modern shipping image upload handler (compatible with adminApi.uploadShippingImage)
async function uploadShippingImageModern(request, env) {
    try {
        console.log('MODERN UPLOAD: Starting modern shipping image upload');
        
        // Extract order ID from URL path
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const orderId = pathSegments[3]; // /api/orders/:id/shipping-images
        
        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order ID is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Parse form data
        const formData = await request.formData();
        const imageFile = formData.get('image');
        const imageType = formData.get('imageType');
        
        console.log('MODERN UPLOAD: Request data:', {
            orderId,
            imageType,
            hasImage: !!imageFile,
            imageName: imageFile ? imageFile.name : 'none',
            imageSize: imageFile ? imageFile.size : 0
        });
        
        if (!imageFile || !imageType) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields: image and imageType'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Validate image type
        const validTypes = ['siap_kirim', 'pengiriman', 'diterima', 'shipment_proof'];
        if (!validTypes.includes(imageType)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid imageType. Must be one of: ' + validTypes.join(', ')
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Create unique filename
        const timestamp = Date.now();
        const fileExtension = imageFile.name.split('.').pop() || 'jpeg';
        const fileName = `ORDER-${orderId}_${imageType}_${timestamp}.${fileExtension}`;
        
        // Upload to R2/Cloudflare Images based on configuration
        let imageUrl;
        
        try {
            // Use Cloudflare Images if available, otherwise fall back to R2
            if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_IMAGES_API_TOKEN) {
                console.log('MODERN UPLOAD: Using Cloudflare Images');
                
                // Create FormData for Cloudflare Images API
                const cfFormData = new FormData();
                cfFormData.append('file', imageFile);
                cfFormData.append('id', fileName.replace(/\./g, '_')); // Replace dots for Cloudflare Images ID
                
                const cfResponse = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}`
                        },
                        body: cfFormData
                    }
                );
                
                const cfResult = await cfResponse.json();
                
                if (cfResult.success && cfResult.result) {
                    imageUrl = cfResult.result.variants.find(v => v.includes('/public')) || cfResult.result.variants[0];
                    console.log('MODERN UPLOAD: Cloudflare Images upload successful:', imageUrl);
                } else {
                    throw new Error('Cloudflare Images upload failed: ' + JSON.stringify(cfResult));
                }
            } else {
                console.log('MODERN UPLOAD: Using R2 Storage');
                
                // Upload to R2 Storage
                await env.SHIPPING_IMAGES.put(fileName, imageFile.stream(), {
                    httpMetadata: {
                        contentType: imageFile.type,
                    },
                });
                
                imageUrl = `https://13b5c18f23aa268941269ea0db1d1e5a.r2.cloudflarestorage.com/kurniasari-shipping-images/${fileName}`;
                console.log('MODERN UPLOAD: R2 upload successful:', imageUrl);
            }
        } catch (uploadError) {
            console.error('MODERN UPLOAD: Upload failed:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Update database with image URL
        const timestamp_iso = new Date().toISOString();
        
        // Delete existing image of same type for this order
        await env.DB.prepare(
            'DELETE FROM shipping_images WHERE order_id = ? AND image_type = ?'
        ).bind(orderId, imageType).run();
        
        // Insert new image record
        await env.DB.prepare(
            'INSERT INTO shipping_images (order_id, image_type, image_url, created_at) VALUES (?, ?, ?, ?)'
        ).bind(orderId, imageType, imageUrl, timestamp_iso).run();
        
        console.log('MODERN UPLOAD: Database updated successfully');
        
        // Debug: Verify imageUrl before returning response
        console.log('MODERN UPLOAD: Final imageUrl before response:', imageUrl);
        
        if (!imageUrl) {
            console.error('MODERN UPLOAD: Critical Error - imageUrl is null/undefined!');
            throw new Error('Image upload completed but imageUrl is null');
        }
        
        // Return response in format expected by frontend
        return new Response(JSON.stringify({
            success: true,
            data: {
                imageUrl: imageUrl, // Frontend expects this field
                orderId: orderId,
                imageType: imageType,
                fileName: fileName,
                message: 'Image uploaded successfully'
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
        
    } catch (error) {
        console.error('MODERN UPLOAD: Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to upload image: ' + error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
    }
}

// Get shipping images for an order (compatible with adminApi.getShippingImages)
async function getShippingImagesModern(request, env) {
    try {
        console.log('MODERN GET: Getting shipping images');
        
        // Extract order ID from URL path
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const orderId = pathSegments[3]; // /api/orders/:id/shipping-images
        
        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order ID is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.corsHeaders
                }
            });
        }
        
        // Get all shipping images for this order
        console.log('MODERN GET: Querying database for order_id:', orderId);
        console.log('MODERN GET: Query: SELECT * FROM shipping_images WHERE order_id = ? ORDER BY created_at DESC');
        
        const images = await env.DB.prepare(
            'SELECT * FROM shipping_images WHERE order_id = ? ORDER BY created_at DESC'
        ).bind(orderId).all();
        
        console.log('MODERN GET: Raw query result:', images);
        console.log('MODERN GET: Found images:', images.results?.length || 0);
        console.log('MODERN GET: Images data:', images.results);
        
        // Also check if there are ANY images in the table for debugging
        const allImages = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM shipping_images'
        ).first();
        console.log('MODERN GET: Total images in shipping_images table:', allImages?.total || 0);
        
        // Check if there are images for similar order IDs
        const similarImages = await env.DB.prepare(
            'SELECT order_id, image_type, created_at FROM shipping_images WHERE order_id LIKE ? LIMIT 5'
        ).bind(`%${orderId.substring(-10)}%`).all();
        console.log('MODERN GET: Similar order IDs in database:', similarImages.results);
        
        return new Response(JSON.stringify({
            success: true,
            data: {
                images: images.results || [],
                orderId: orderId
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
        
    } catch (error) {
        console.error('MODERN GET: Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to get shipping images: ' + error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...request.corsHeaders
            }
        });
    }
}
