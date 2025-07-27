import { generateId } from '../utils/helpers';

/**
 * Get all users
 */
export async function getUsers(request, env) {
  console.log('[DEBUG] getUsers handler called');
  
  // Use unified CORS headers from main configuration
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log user information for debugging
    console.log('[DEBUG] User object:', JSON.stringify(request.user || 'No user in request'));
    
    // Verify admin role
    if (!request.user) {
      console.log('[ERROR] No user object in request - possible middleware issue');
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. No authentication data found.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    if (request.user.role !== 'admin') {
      console.log(`[ERROR] User role ${request.user.role} is not admin`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. Admin role required.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    console.log('[DEBUG] Admin access verified, querying users table');
    
    // Check if users table exists
    try {
      const tableCheck = await env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).first();
      
      if (!tableCheck) {
        console.log('[ERROR] Users table does not exist in the database');
        return new Response(JSON.stringify({
          success: false,
          message: 'Database error: Users table does not exist',
          error: 'Table not found'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      console.log('[DEBUG] Users table exists, proceeding to query');
    } catch (tableError) {
      console.error('[ERROR] Error checking users table:', tableError);
    }

    // Get all users from database
    const result = await env.DB.prepare(`
      SELECT id, username, name, role, outlet_id, email, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    console.log('[DEBUG] Query result:', JSON.stringify(result || 'No result'));

    if (!result || !result.success) {
      throw new Error('Failed to fetch users from database');
    }

    return new Response(JSON.stringify({
      success: true,
      users: result.results || []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[ERROR] Get Users Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Create new user
 */
export async function createUser(request, env) {
  // Use unified CORS headers from main configuration
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    if (!request.user || request.user.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. Admin role required.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get request body
    const data = await request.json();
    const { username, name, password, role, outlet_id, email } = data;

    // Validate required fields
    if (!username || !name || !password || !role) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Username, name, password, and role are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // For outlet managers, outlet_id is required
    if (role === 'outlet_manager' && !outlet_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Outlet ID is required for outlet managers'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if username already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Username already exists'
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate user ID
    const userId = generateId();
    const now = new Date().toISOString();

    // Insert new user
    const result = await env.DB.prepare(`
      INSERT INTO users (
        id, username, name, password, role, outlet_id, email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      username,
      name,
      hashedPassword,
      role,
      outlet_id || null,
      email || null,
      now,
      now
    ).run();

    if (!result.success) {
      throw new Error('Failed to create user');
    }

    // Fetch the newly created user (without password)
    const newUser = await env.DB.prepare(`
      SELECT id, username, name, role, outlet_id, email, created_at, updated_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'User created successfully',
      user: newUser
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create User Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to create user',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Update existing user
 */
export async function updateUser(request, env) {
  // Use unified CORS headers from main configuration
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    if (!request.user || request.user.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. Admin role required.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Extract userId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get request body
    const data = await request.json();
    const { username, name, role, outlet_id, email } = data;

    // Validate required fields
    if (!username || !name || !role) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Username, name, and role are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // For outlet managers, outlet_id is required
    if (role === 'outlet_manager' && !outlet_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Outlet ID is required for outlet managers'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if username is already taken by another user
    if (username) {
      const userWithSameName = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(username, userId).first();

      if (userWithSameName) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Username already exists'
        }), {
          status: 409, // Conflict
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const now = new Date().toISOString();

    // Update user
    const result = await env.DB.prepare(`
      UPDATE users
      SET username = ?,
          name = ?,
          role = ?,
          outlet_id = ?,
          email = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      username,
      name,
      role,
      outlet_id || null,
      email || null,
      now,
      userId
    ).run();

    if (!result.success) {
      throw new Error('Failed to update user');
    }

    // Fetch the updated user
    const updatedUser = await env.DB.prepare(`
      SELECT id, username, name, role, outlet_id, email, created_at, updated_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Update User Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to update user',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Reset user password
 */
export async function resetUserPassword(request, env) {
  // Use unified CORS headers from main configuration
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    if (!request.user || request.user.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. Admin role required.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Extract userId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 2]; // users/:userId/reset-password

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get request body
    const data = await request.json();
    const { password } = data;

    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Password is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Hash new password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    // Update password
    const result = await env.DB.prepare(`
      UPDATE users
      SET password = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      hashedPassword,
      now,
      userId
    ).run();

    if (!result.success) {
      throw new Error('Failed to reset password');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Password reset successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Reset Password Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Delete user
 */
export async function deleteUser(request, env) {
  // Use unified CORS headers from main configuration
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Debug logging
    console.log('[DEBUG] deleteUser handler called');
    console.log('[DEBUG] Request URL:', request.url);
    console.log('[DEBUG] User object:', JSON.stringify(request.user || 'No user in request'));
    
    // Verify admin role
    if (!request.user || request.user.role !== 'admin') {
      console.log('[ERROR] User role not admin:', request.user?.role);
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized. Admin role required.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Extract userId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    // Log extracted userId untuk debug
    console.log('[DEBUG] Path parts:', JSON.stringify(pathParts));
    console.log('[DEBUG] Extracted userId:', userId);

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    console.log('[DEBUG] Searching for user with ID:', userId);
    const existingUser = await env.DB.prepare(
      'SELECT id, username, role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Prevent deleting the current admin user
    if (existingUser.id === request.user.id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Cannot delete your own user account'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Prevent deleting the last admin user
    if (existingUser.role === 'admin') {
      const adminCount = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
      ).first();

      if (adminCount && adminCount.count <= 1) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Cannot delete the last admin user'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Delete user
    console.log('[DEBUG] Attempting to delete user with ID:', userId);
    const result = await env.DB.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).bind(userId).run();

    console.log('[DEBUG] Delete operation result:', JSON.stringify(result));
    
    if (!result || !result.success) {
      console.error('[ERROR] Failed to delete user:', JSON.stringify(result));
      throw new Error('Failed to delete user');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User deleted successfully',
      username: existingUser.username
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[ERROR] Delete User Error:', error);
    console.error('[ERROR] Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
