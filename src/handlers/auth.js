// Authentication handlers for user management
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminActivityLogger, getClientInfo } from '../utils/admin-activity-logger.js';

// Register a new user
export async function registerUser(request, env) {
    try {
        const body = await request.json();
        const { username, password, name, email, phone, role, outlet_id } = body;

        // Validate required fields
        if (!username || !password || !name || !role) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Missing required fields: username, password, name, and role are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Validate role is allowed
        if (!['admin', 'outlet_manager', 'deliveryman'].includes(role)) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid role. Must be one of: admin, outlet_manager, deliveryman'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Check if outlet_id exists for non-admin roles
        if ((role === 'outlet_manager' || role === 'deliveryman') && !outlet_id) {
            return new Response(JSON.stringify({
                success: false,
                message: 'outlet_id is required for outlet_manager and deliveryman roles'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Check if outlet exists for non-admin roles (use unified table)
        if (outlet_id) {
            const outlet = await env.DB.prepare('SELECT id FROM outlets_unified WHERE id = ?')
                .bind(outlet_id)
                .first();

            if (!outlet) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Outlet does not exist'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
                });
            }
        }

        // Check if username already exists
        const existingUser = await env.DB.prepare('SELECT id, username, role, outlet_id FROM users WHERE username = ?')
            .bind(username)
            .first();

        if (existingUser) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Username already exists'
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate unique ID
        const id = nanoid();

        // Insert user into database
        await env.DB.prepare(`
            INSERT INTO users (id, username, password_hash, name, role, email, phone, outlet_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, username, hashedPassword, name, role, email || null, phone || null, outlet_id || null)
        .run();

        // Return success without sending back the password
        return new Response(JSON.stringify({
            success: true,
            message: 'User registered successfully',
            user: {
                id,
                username,
                name,
                role,
                email,
                phone,
                outlet_id
            }
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    } catch (error) {
        console.error('Error in registerUser:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Server error during registration',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    }
}

// Login user
export async function loginUser(request, env) {
    console.log('LOGIN START: Beginning login function execution');
    
    try {
        console.log('LOGIN ENV: Available environment variables:', Object.keys(env));
        console.log('LOGIN DB: Database binding available:', !!env.DB);
        console.log('LOGIN JWT: JWT_SECRET available:', !!env.JWT_SECRET);
        console.log('LOGIN PARSE: Parsing request body');
        const body = await request.json();
        const { username, password } = body;
        console.log(`LOGIN ATTEMPT: Received login request for username: '${username}'`);

        // Validate required fields
        if (!username || !password) {
            console.error('LOGIN FAIL: Missing username or password in request.');
            return new Response(JSON.stringify({
                success: false,
                message: 'Username and password are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        console.log(`LOGIN DB_FETCH: Searching for user '${username}' in the database.`);
        // Select all columns to avoid errors if password_hash column doesn't exist in this DB
        // We'll handle presence of password_hash vs password at runtime below
        const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
            .bind(username)
            .first();

        if (!user) {
            console.error(`LOGIN FAIL: User not found in database for username: '${username}'`);
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid credentials'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        console.log(`LOGIN DB_SUCCESS: Found user '${username}'. Role: ${user.role}.`);
        let isMatch = false;
        // Strict: require bcrypt password_hash
        if (user.password_hash && typeof user.password_hash === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password_hash)) {
            console.log(`LOGIN HASH_COMPARE: Using password_hash for user '${username}'.`);
            isMatch = await bcrypt.compare(password, user.password_hash);
        } else {
            console.error(`LOGIN FAIL: password_hash missing or not bcrypt for user '${username}'.`);
            return new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        console.log('LOGIN RESULT: Password comparison result:', isMatch);

        if (!isMatch) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid credentials'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Get outlet data if applicable (from unified table)
        let outlet = null;
        if (user.outlet_id) {
            outlet = await env.DB.prepare('SELECT id, name FROM outlets_unified WHERE id = ?')
                .bind(user.outlet_id)
                .first();
        }

        // Initialize activity logger and get client info
        const activityLogger = new AdminActivityLogger(env);
        const { ipAddress, userAgent } = getClientInfo(request);
        
        // Create session and log login activity
        const sessionId = await activityLogger.createSession(user, ipAddress, userAgent);
        await activityLogger.logLogin(user, ipAddress, userAgent, sessionId);

        // Create JWT token with sessionId for activity tracking
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                name: user.name,
                role: user.role,
                outlet_id: user.outlet_id,
                sessionId: sessionId // Include sessionId for session tracking
            }, 
            env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Update last login timestamp with detailed error handling
        try {
            await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(user.id)
                .run();
        } catch (updateError) {
            console.error('Failed to update last_login:', updateError);
            // Non-critical error, so we can still return success but log the issue.
            // Or return a specific error if this is considered critical.
        }

        // Return user data and token in format expected by frontend
        return new Response(JSON.stringify({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name || user.username, // Fallback to username if name is null
                role: user.role,
                outlet_id: user.outlet_id // Match frontend expectation for outlet_id
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    } catch (error) {
        console.error('Error in loginUser:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Server error during login',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    }
}

// Get user profile for an authenticated user
export async function getUserProfile(request, env) {
    try {
        // The user ID is attached by the verifyToken middleware
        const userId = request.user.id;

        // Fetch the user's full profile from the database
        const user = await env.DB.prepare(
            'SELECT id, username, name, role, outlet_id FROM users WHERE id = ?'
        ).bind(userId).first();

        if (!user) {
            return new Response(JSON.stringify({ success: false, message: 'User not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Fetch outlet details if an outlet_id exists (from unified table)
        let outlet = null;
        if (user.outlet_id) {
            outlet = await env.DB.prepare('SELECT id, name FROM outlets_unified WHERE id = ?')
                .bind(user.outlet_id)
                .first();
        }

        // Return the user profile
        return new Response(JSON.stringify({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                outlet: outlet
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Server error while fetching profile',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    }
}

// Get all outlets (for admin)
export async function getOutlets(request, env) {
    try {
        // Check if user is admin
        const user = request.user;
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({
                success: false,
                message: 'Unauthorized - Admin access required'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // TEMPORARY: Return hardcoded outlets using actual outlet data from user
        console.log('🔧 Using exact outlet data from production system...');
        const outlets = {
            results: [
                { id: 'outlet_glagahsari_108', name: 'Outlet Glagahsari 108', location: 'Glagahsari 108' },
                { id: 'outlet_glagahsari_91c', name: 'Outlet Glagahsari 91C', location: 'Glagahsari 91C' },
                { id: 'outlet_bonbin', name: 'Outlet Bonbin', location: 'Bonbin' },
                { id: 'outlet_monjali', name: 'Outlet Monjali', location: 'Monjali' },
                { id: 'outlet_pogung', name: 'Outlet Pogung', location: 'Pogung' },
                { id: 'outlet_jakal_km14', name: 'Outlet Jakal KM14', location: 'Jakal KM14' },
                { id: 'outlet_jalan_wonosari', name: 'Outlet Jalan Wonosari', location: 'Jalan Wonosari' },
                { id: 'outlet_jalan_wates', name: 'Outlet Jalan Wates', location: 'Jalan Wates' },
                { id: 'outlet_godean', name: 'Outlet Godean', location: 'Godean' },
                { id: 'outlet_ahmad_dahlan', name: 'Outlet Ahmad Dahlan', location: 'Ahmad Dahlan' }
            ]
        };

        return new Response(JSON.stringify({
            success: true,
            outlets: outlets.results,
            debug: {
                total_outlets: outlets.results?.length || 0,
                sample_outlet: outlets.results?.[0] || null,
                available_columns: outlets.results?.[0] ? Object.keys(outlets.results[0]) : []
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    } catch (error) {
        console.error('Error in getOutlets:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Server error retrieving outlets',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    }
}

// Create outlet (admin only)
export async function createOutlet(request, env) {
    try {
        // Check if user is admin
        const user = request.user;
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({
                success: false,
                message: 'Unauthorized - Admin access required'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        const body = await request.json();
        const { name, location } = body;

        // Validate required fields
        if (!name || !location) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Name and location are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Generate ID based on name (slug-like)
        const id = 'outlet-' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Check if outlet ID already exists (in unified table)
        const existingOutlet = await env.DB.prepare('SELECT id FROM outlets_unified WHERE id = ?')
            .bind(id)
            .first();

        if (existingOutlet) {
            return new Response(JSON.stringify({
                success: false,
                message: 'An outlet with a similar name already exists'
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
            });
        }

        // Create outlet in unified table (store location as location_alias)
        await env.DB.prepare('INSERT INTO outlets_unified (id, name, location_alias, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
            .bind(id, name, location)
            .run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Outlet created successfully',
            outlet: {
                id,
                name,
                // keep response compatibility; stored as location_alias
                location
            }
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    } catch (error) {
        console.error('Error in createOutlet:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Server error creating outlet',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...request.corsHeaders }
        });
    }
}
