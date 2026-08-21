// Authentication middleware
import jwt from 'jsonwebtoken';
import { AdminActivityLogger } from '../utils/admin-activity-logger.js';

// Verify JWT token and extract user data
export async function verifyToken(request, env) {
    // Ensure CORS headers are always available with comprehensive settings
    const corsHeaders = request.corsHeaders || {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
        'Access-Control-Allow-Credentials': 'true',
    };
    
    try {
        // Get token from Authorization header
        const authHeader = request.headers.get('Authorization');
        console.log('🔑 [verifyToken] Authorization header:', authHeader ? 'Present' : 'Missing');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ [verifyToken] Invalid auth header format');
            return new Response(JSON.stringify({ success: false, message: 'Authentication token not provided' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Extract token
        const token = authHeader.split(' ')[1];
        console.log('🔑 [verifyToken] Token extracted, length:', token.length);
        
        // Verify token
        console.log('🔍 [verifyToken] Verifying token with JWT_SECRET...');
        const decoded = jwt.verify(token, env.JWT_SECRET);
        console.log('✅ [verifyToken] Token verified successfully. User:', decoded.username);
        
        // Add user data to request
        request.user = decoded;

        // Update session activity for active sessions
        if (decoded.sessionId) {
            try {
                const activityLogger = new AdminActivityLogger(env);
                await activityLogger.updateSessionActivity(decoded.sessionId);
            } catch (error) {
                console.error('Failed to update session activity:', error);
                // Don't block request if session update fails
            }
        }

        // By not returning a Response, we allow the router to proceed to the next handler.
    } catch (error) {
        console.error('❌ [verifyToken] Error verifying token:', error.name, error.message);
        
        if (error.name === 'TokenExpiredError') {
            console.log('⏰ [verifyToken] Token has expired');
            return new Response(JSON.stringify({ success: false, message: 'Token expired' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            console.log('🔴 [verifyToken] JWT verification failed:', error.message);
        }
        
        return new Response(JSON.stringify({ success: false, message: 'Invalid token', error: error.message }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
    }
}

// Check if user has admin role
export function requireAdmin(request) {
    if (!request.user || request.user.role !== 'admin') {
        return {
            success: false,
            status: 403,
            message: 'Admin access required'
        };
    }
    return { success: true };
}

// Check if user is outlet manager
export function requireOutletManager(request) {
    if (!request.user || request.user.role !== 'outlet_manager') {
        return {
            success: false,
            status: 403,
            message: 'Outlet manager access required'
        };
    }
    return { success: true };
}

// Check if user is deliveryman
export function requireDeliveryman(request) {
    if (!request.user || request.user.role !== 'deliveryman') {
        return {
            success: false,
            status: 403,
            message: 'Deliveryman access required'
        };
    }
    return { success: true };
}

// Check if user has access to specific outlet
export function requireOutletAccess(request, outletId) {
    // Admins have access to all outlets
    if (request.user && request.user.role === 'admin') {
        return { success: true };
    }
    
    // Check if user belongs to the specified outlet
    if (!request.user || request.user.outlet_id !== outletId) {
        return {
            success: false,
            status: 403,
            message: 'Access denied to this outlet'
        };
    }
    
    return { success: true };
}

// Check if user has access to specified order
export async function requireOrderAccess(request, env, orderId) {
    // Get order from database
    const order = await env.DB.prepare('SELECT id, outlet_id, assigned_deliveryman_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first();
    
    if (!order) {
        return {
            success: false,
            status: 404,
            message: 'Order not found'
        };
    }
    
    // Admin has access to all orders
    if (request.user && request.user.role === 'admin') {
        return { success: true, order };
    }
    
    // Outlet manager can only access orders for their outlet
    if (request.user && request.user.role === 'outlet_manager') {
        if (request.user.outlet_id !== order.outlet_id) {
            return {
                success: false,
                status: 403,
                message: 'Access denied to this order'
            };
        }
        return { success: true, order };
    }
    
    // Deliveryman can only access orders assigned to them
    if (request.user && request.user.role === 'deliveryman') {
        if (request.user.id !== order.assigned_deliveryman_id) {
            return {
                success: false,
                status: 403,
                message: 'Access denied to this order'
            };
        }
        return { success: true, order };
    }
    
    return {
        success: false,
        status: 403,
        message: 'Access denied to this order'
    };
}

// Helper function to handle errors in middleware
export function handleMiddlewareError(error, corsHeaders) {
    console.error('Middleware error:', error);
    return new Response(JSON.stringify({
        success: false,
        message: 'Authentication error',
        error: error.message
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

// Log user actions for audit trail
export async function logUserAction(env, userId, orderId, actionType, oldValue, newValue, notes = null) {
    try {
        // Get user role
        const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?')
            .bind(userId)
            .first();
        
        // Generate ID for the log entry
        const id = crypto.randomUUID();
        
        // Insert log entry
        await env.DB.prepare(`
            INSERT INTO order_update_logs 
            (id, order_id, user_id, update_type, old_value, new_value, user_role, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, orderId, userId, actionType, oldValue, newValue, user ? user.role : null, notes)
        .run();
        
        return true;
    } catch (error) {
        console.error('Error logging user action:', error);
        return false;
    }
}
