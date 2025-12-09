// Admin activity handlers for logging and history tracking
import { AdminActivityLogger } from '../utils/admin-activity-logger.js';

// Get admin activity history
export async function getAdminActivity(request, env) {
  try {
    const url = new URL(request.url);
    const adminId = url.searchParams.get('admin_id');
    const activityType = url.searchParams.get('activity_type');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const limit = url.searchParams.get('limit') || '100';

    const activityLogger = new AdminActivityLogger(env);
    
    const filters = {
      adminId,
      activityType,
      dateFrom,
      dateTo,
      limit: parseInt(limit)
    };

    const activities = await activityLogger.getActivityHistory(filters);

    return new Response(JSON.stringify({
      success: true,
      data: activities,
      total: activities.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting admin activity:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get admin activity',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get active admin sessions
export async function getActiveSessions(request, env) {
  try {
    const activityLogger = new AdminActivityLogger(env);
    
    // Cleanup old sessions first
    await activityLogger.cleanupOldSessions();
    
    // Get currently active sessions
    const sessions = await activityLogger.getActiveSessions();

    return new Response(JSON.stringify({
      success: true,
      data: sessions,
      total: sessions.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting active sessions:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get active sessions',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manual logout endpoint (for session cleanup)
export async function logoutUser(request, env) {
  try {
    const body = await request.json();
    const { sessionId, adminId } = body;

    if (!sessionId && !adminId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID or Admin ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const activityLogger = new AdminActivityLogger(env);
    
    // Get user info for logging
    let user = null;
    if (adminId) {
      user = await env.DB.prepare('SELECT id, username as name, email FROM users WHERE id = ?')
        .bind(adminId)
        .first();
    } else if (sessionId) {
      const session = await env.DB.prepare('SELECT admin_id, admin_name as name, admin_email as email FROM admin_sessions WHERE session_id = ?')
        .bind(sessionId)
        .first();
      
      if (session) {
        user = { id: session.admin_id, name: session.name, email: session.email };
      }
    }

    if (sessionId) {
      await activityLogger.endSession(sessionId);
    }

    if (user) {
      const { ipAddress, userAgent } = getClientInfo(request);
      await activityLogger.logLogout(user, ipAddress, userAgent, sessionId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error during logout:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to logout',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get admin statistics for dashboard
export async function getAdminStats(request, env) {
  try {
    const activityLogger = new AdminActivityLogger(env);
    
    // Get today's activities
    const today = new Date().toISOString().split('T')[0];
    const todayActivities = await activityLogger.getActivityHistory({
      dateFrom: today + 'T00:00:00Z',
      dateTo: today + 'T23:59:59Z'
    });

    // Get active sessions
    const activeSessions = await activityLogger.getActiveSessions();

    // Get recent order activities
    const recentOrderActivities = await activityLogger.getActivityHistory({
      activityType: 'order_created',
      limit: 10
    });

    // Calculate stats
    const stats = {
      today: {
        total_activities: todayActivities.length,
        logins: todayActivities.filter(a => a.activity_type === 'login').length,
        orders_created: todayActivities.filter(a => a.activity_type === 'order_created').length,
        orders_updated: todayActivities.filter(a => a.activity_type === 'order_updated').length
      },
      active_sessions: activeSessions.length,
      recent_orders: recentOrderActivities
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting admin stats:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get admin stats',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
