// Admin activity logging utility functions

export class AdminActivityLogger {
  constructor(env) {
    this.env = env;
  }

  /**
   * Log admin activity to database
   * @param {Object} params - Activity parameters
   * @param {string} params.adminId - Admin user ID
   * @param {string} params.adminName - Admin name
   * @param {string} params.adminEmail - Admin email
   * @param {string} params.activityType - Type of activity (login, logout, order_created, etc.)
   * @param {string} params.description - Activity description
   * @param {string} params.orderId - Order ID (optional)
   * @param {string} params.ipAddress - Client IP address
   * @param {string} params.userAgent - Client user agent
   * @param {string} params.sessionId - Session ID (optional)
   */
  async logActivity({
    adminId,
    adminName,
    adminEmail,
    activityType,
    description,
    orderId = null,
    ipAddress = null,
    userAgent = null,
    sessionId = null
  }) {
    try {
      const logEntry = await this.env.DB.prepare(`
        INSERT INTO admin_activity_logs 
        (admin_id, admin_name, admin_email, activity_type, description, order_id, ip_address, user_agent, session_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        adminId,
        adminName,
        adminEmail,
        activityType,
        description,
        orderId,
        ipAddress,
        userAgent,
        sessionId,
        new Date().toISOString()
      ).run();

      console.log(`📝 Admin activity logged: ${activityType} by ${adminName} (${adminId})`);
      return logEntry;
    } catch (error) {
      console.error('❌ Failed to log admin activity:', error);
      // Don't throw error to prevent breaking main functionality
      return null;
    }
  }

  /**
   * Log admin login
   */
  async logLogin(admin, ipAddress, userAgent, sessionId) {
    return await this.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      activityType: 'login',
      description: `Admin logged in`,
      ipAddress,
      userAgent,
      sessionId
    });
  }

  /**
   * Log admin logout
   */
  async logLogout(admin, ipAddress, userAgent, sessionId) {
    return await this.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      activityType: 'logout',
      description: `Admin logged out`,
      ipAddress,
      userAgent,
      sessionId
    });
  }

  /**
   * Log order creation
   */
  async logOrderCreated(admin, orderId, customerName, totalAmount, ipAddress, userAgent) {
    return await this.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      activityType: 'order_created',
      description: `Created order for ${customerName} (Rp ${totalAmount.toLocaleString('id-ID')})`,
      orderId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log order update
   */
  async logOrderUpdated(admin, orderId, updateType, ipAddress, userAgent) {
    return await this.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      activityType: 'order_updated',
      description: `Updated order: ${updateType}`,
      orderId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log order deletion
   */
  async logOrderDeleted(admin, orderId, customerName, ipAddress, userAgent) {
    return await this.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      activityType: 'order_deleted',
      description: `Deleted order for ${customerName}`,
      orderId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Create or update admin session
   */
  async createSession(admin, ipAddress, userAgent) {
    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.env.DB.prepare(`
        INSERT INTO admin_sessions 
        (session_id, admin_id, admin_name, admin_email, ip_address, user_agent, login_at, last_activity, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        sessionId,
        admin.id,
        admin.name,
        admin.email,
        ipAddress,
        userAgent,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create admin session:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    try {
      await this.env.DB.prepare(`
        UPDATE admin_sessions 
        SET last_activity = ? 
        WHERE session_id = ? AND is_active = 1
      `).bind(
        new Date().toISOString(),
        sessionId
      ).run();
    } catch (error) {
      console.error('❌ Failed to update session activity:', error);
    }
  }

  /**
   * End admin session
   */
  async endSession(sessionId) {
    try {
      await this.env.DB.prepare(`
        UPDATE admin_sessions 
        SET is_active = 0, logout_at = ? 
        WHERE session_id = ?
      `).bind(
        new Date().toISOString(),
        sessionId
      ).run();
    } catch (error) {
      console.error('❌ Failed to end admin session:', error);
    }
  }

  /**
   * Get admin activity history
   */
  async getActivityHistory(filters = {}) {
    try {
      let query = `
        SELECT 
          id, admin_id, admin_name, admin_email, activity_type, description, 
          order_id, ip_address, created_at
        FROM admin_activity_logs
      `;
      
      const conditions = [];
      const params = [];
      
      if (filters.adminId) {
        conditions.push('admin_id = ?');
        params.push(filters.adminId);
      }
      
      if (filters.activityType) {
        conditions.push('activity_type = ?');
        params.push(filters.activityType);
      }
      
      if (filters.dateFrom) {
        conditions.push('created_at >= ?');
        params.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        conditions.push('created_at <= ?');
        params.push(filters.dateTo);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY created_at DESC';
      
      if (filters.limit) {
        query += ` LIMIT ${parseInt(filters.limit)}`;
      }
      
      const result = await this.env.DB.prepare(query).bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('❌ Failed to get activity history:', error);
      return [];
    }
  }

  /**
   * Get active admin sessions
   */
  async getActiveSessions() {
    try {
      const result = await this.env.DB.prepare(`
        SELECT 
          session_id, admin_id, admin_name, admin_email, ip_address, 
          login_at, last_activity
        FROM admin_sessions 
        WHERE is_active = 1
        ORDER BY last_activity DESC
      `).all();
      
      return result.results || [];
    } catch (error) {
      console.error('❌ Failed to get active sessions:', error);
      return [];
    }
  }
}

// Helper function to extract client info from request
export function getClientInfo(request) {
  const ipAddress = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
  
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  return { ipAddress, userAgent };
}
