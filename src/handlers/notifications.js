// Notifications handler for creating and managing user notifications

/**
 * Creates a notification for a specific user or all users in an outlet
 * @param {Object} env - Environment variables and bindings
 * @param {String|null} userId - User ID to send notification to (null if sending to outlet)
 * @param {String|null} outletId - Outlet ID to send notification to all users in this outlet
 * @param {String|null} orderId - Order ID related to this notification (if applicable)
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {String} type - Notification type (e.g., 'order_update', 'assignment', etc.)
 * @returns {Promise<Object>} - Result of the notification creation
 */
export async function createNotification(env, { userId = null, outletId = null, orderId = null, title, message, type }) {
  try {
    if (!title || !message || !type) {
      throw new Error('Title, message, and type are required for notifications');
    }

    if (!userId && !outletId) {
      throw new Error('Either userId or outletId must be provided');
    }

    // Generate a notification ID
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Create a single notification for a specific user
    if (userId) {
      const result = await env.DB.prepare(
        `INSERT INTO notifications (
          id, user_id, order_id, outlet_id, title, message, type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        notificationId,
        userId,
        orderId,
        outletId,
        title,
        message,
        type
      ).run();

      return {
        success: result.success,
        id: notificationId,
        error: result.error
      };
    } 
    // Create notifications for all users in an outlet
    else if (outletId) {
      // Get all users in the specified outlet
      const users = await env.DB.prepare(
        'SELECT id FROM users WHERE outlet_id = ? AND (role = "outlet_manager" OR role = "deliveryman")'
      ).bind(outletId).all();

      if (!users.results || users.results.length === 0) {
        return {
          success: true,
          message: 'No users found in outlet to notify',
          notifiedUsers: 0
        };
      }

      // Create a notification for each user in the outlet
      const insertPromises = users.results.map(user => {
        const userNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        return env.DB.prepare(
          `INSERT INTO notifications (
            id, user_id, order_id, outlet_id, title, message, type
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          userNotificationId,
          user.id,
          orderId,
          outletId,
          title,
          message,
          type
        ).run();
      });

      await Promise.all(insertPromises);

      return {
        success: true,
        message: `Notifications created for ${users.results.length} users in outlet`,
        notifiedUsers: users.results.length
      };
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get notifications for a specific user
 * @param {Object} request - Request object containing user info
 * @param {Object} env - Environment variables and bindings
 * @returns {Response} - API response with user's notifications
 */
export async function getUserNotifications(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get the user ID from the request
    if (!request.user || !request.user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not authenticated or missing user ID'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const userId = request.user.id;
    
    // Parse query parameters
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const page = parseInt(url.searchParams.get('page') || '1');
    const offset = (page - 1) * limit;
    
    // Build the query
    let query = `
      SELECT n.*, o.id as order_id, o.order_status, o.shipping_status
      FROM notifications n
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.user_id = ?
    `;
    
    const queryParams = [userId];
    
    // Add filter for unread notifications if specified
    if (unreadOnly) {
      query += ' AND n.is_read = 0';
    }
    
    // Add sorting and pagination
    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Execute the query
    const notifications = await env.DB.prepare(query)
      .bind(...queryParams)
      .all();
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    if (unreadOnly) {
      countQuery += ' AND is_read = 0';
    }
    
    const countResult = await env.DB.prepare(countQuery)
      .bind(userId)
      .first();
    
    return new Response(JSON.stringify({
      success: true,
      data: notifications.results,
      pagination: {
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Error fetching user notifications:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch notifications'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Mark a notification as read
 * @param {Object} request - Request object containing user info
 * @param {Object} env - Environment variables and bindings
 * @returns {Response} - API response with result
 */
export async function markNotificationRead(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract notification ID from URL
    const url = new URL(request.url);
    const notificationId = url.pathname.split('/').pop();
    
    if (!notificationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Notification ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Ensure user is authenticated and can only mark their own notifications as read
    if (!request.user || !request.user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Verify the notification belongs to this user
    const notification = await env.DB.prepare(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
    ).bind(notificationId, request.user.id).first();
    
    if (!notification) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Notification not found or does not belong to you'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Mark notification as read
    const result = await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).bind(notificationId).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to update notification'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Notification marked as read'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Error marking notification as read:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to mark notification as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Mark all notifications for a user as read
 * @param {Object} request - Request object containing user info
 * @param {Object} env - Environment variables and bindings
 * @returns {Response} - API response with result
 */
export async function markAllNotificationsRead(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ensure user is authenticated
    if (!request.user || !request.user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Mark all user's notifications as read
    const result = await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).bind(request.user.id).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: `${result.meta.changes} notifications marked as read`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to mark notifications as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
