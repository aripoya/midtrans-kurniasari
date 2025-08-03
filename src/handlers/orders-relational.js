/**
 * RELATIONAL VERSION of getOutletOrders
 * Using proper JOIN instead of string matching for better performance and accuracy
 */

/**
 * Get orders specific to an outlet using PROPER RELATIONAL APPROACH
 * - Uses JOINs with outlets table instead of string matching
 * - Better performance with indexed foreign keys
 * - More accurate and maintainable filtering
 */
export async function getOutletOrdersRelational(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Parse URL and get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('perPage')) || 10;
    const isDeliveryView = request.isDeliveryView || false;
    
    // Calculate offset
    const offset = (page - 1) * perPage;
    
    // Debug user info
    console.log('🔗 Using RELATIONAL approach for outlet orders');
    console.log('User info in getOutletOrdersRelational:', request.user ? {
      id: request.user.id,
      role: request.user.role,
      outlet_id: request.user.outlet_id
    } : 'No user in request');

    // ================================================
    // PROPER RELATIONAL QUERY with JOINs
    // ================================================
    let orderQuery = `
      SELECT 
        o.*,
        -- Primary outlet information
        primary_outlet.name AS outlet_name,
        primary_outlet.location_alias AS outlet_location,
        primary_outlet.address AS outlet_address
        
      FROM orders o
      
      -- PRIMARY OUTLET JOIN (main outlet assignment)
      LEFT JOIN outlets_unified primary_outlet ON o.outlet_id = primary_outlet.id
      
      WHERE 1=1
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM orders o
      LEFT JOIN outlets_unified primary_outlet ON o.outlet_id = primary_outlet.id
      WHERE 1=1
    `;
    
    // ================================================
    // ROLE-BASED RELATIONAL FILTERING
    // ================================================
    
    // Filter by status if provided
    if (status) {
      const statusCondition = ` AND o.order_status = ?`;
      orderQuery += statusCondition;
      countQuery += statusCondition;
    }
    
    // Apply role-specific filters using PROPER JOINS
    let queryParams = [];
    let countParams = [];
    
    if (status) {
      queryParams.push(status);
      countParams.push(status);
    }
    
    if (request.user) {
      if (request.user.role === 'outlet_manager') {
        // SIMPLIFIED RELATIONAL APPROACH: Use only outlet_id
        // Orders directly assigned to outlet (outlet_id)
        
        const outletCondition = ` AND o.outlet_id = ?`;
        
        orderQuery += outletCondition;
        countQuery += outletCondition;
        
        // Add user's outlet_id 3 times for the 3 conditions
        queryParams.push(request.user.outlet_id);
        countParams.push(request.user.outlet_id);
        
        console.log(`🏪 Filtering orders for outlet manager with outlet_id: ${request.user.outlet_id}`);
        
      } else if (request.user.role === 'deliveryman') {
        // Deliverymen see only orders assigned to them
        const deliveryCondition = ` AND o.assigned_deliveryman_id = ?`;
        orderQuery += deliveryCondition;
        countQuery += deliveryCondition;
        
        queryParams.push(request.user.id);
        countParams.push(request.user.id);
        
      } else if (request.user.role === 'admin') {
        if (isDeliveryView) {
          // Admin in delivery view sees orders with assigned deliverymen
          orderQuery += ` AND o.assigned_deliveryman_id IS NOT NULL`;
          countQuery += ` AND o.assigned_deliveryman_id IS NOT NULL`;
        }
        // Admin without delivery view sees all orders (no additional filter)
      }
    } else {
      console.warn('No user found in request, returning unauthorized');
      return new Response(JSON.stringify({
        success: false,
        message: 'Authentication required',
        data: [],
        pagination: { total: 0, page, perPage, totalPages: 0 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 401
      });
    }
    
    // ================================================
    // EXECUTE QUERIES WITH PROPER PARAMETER BINDING
    // ================================================
    
    // Execute count query
    let countResult;
    try {
      console.log('Count query:', countQuery);
      console.log('Count params:', countParams);
      
      const countStmt = env.DB.prepare(countQuery);
      countResult = await countStmt.bind(...countParams).first();
    } catch (countError) {
      console.error('Error executing count query:', countError);
      countResult = { total: 0 };
    }
    
    const total = countResult?.total || 0;
    
    // Add pagination and ordering to main query
    orderQuery += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(perPage, offset);
    
    // Execute main query
    let result;
    try {
      console.log('Main query:', orderQuery);
      console.log('Main params:', queryParams);
      
      const orderStmt = env.DB.prepare(orderQuery);
      result = await orderStmt.bind(...queryParams).all();
      
      console.log(`✅ Relational query returned ${result?.results?.length || 0} results`);
    } catch (queryError) {
      console.error('Error executing order query:', queryError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error fetching orders: ' + queryError.message,
        data: [],
        pagination: { total: 0, page, perPage, totalPages: 0 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      });
    }
    
    // ================================================
    // PROCESS AND RETURN RESULTS
    // ================================================
    
    const totalPages = Math.ceil(total / perPage);
    
    // Process orders with enhanced outlet information
    const processedOrders = result?.results?.map(order => {
      return {
        ...order,
        // Enhanced outlet information from JOINs
        outlet_info: {
          primary: {
            id: order.outlet_id,
            name: order.outlet_name,
            location: order.outlet_location,
            address: order.outlet_address
          },
          // Simplified outlet info (using primary outlet only)
        },
        // Deliveryman information (simplified)
        deliveryman_info: null, // Removed until assigned_deliveryman_id column exists
        // Clean up duplicate fields
        outlet_name: order.outlet_name,  // Keep for backward compatibility
        // Ensure status fields have defaults
        shipping_status: order.shipping_status || 'menunggu-diproses',
        payment_status: order.payment_status || 'pending',
        order_status: order.order_status || 'pending'
      };
    }) || [];
    
    // Return success response with nested structure for frontend compatibility
    return new Response(JSON.stringify({
      success: true,
      message: `Orders retrieved successfully using relational approach`,
      data: {
        orders: processedOrders  // Frontend expects data.data.orders
      },
      pagination: {
        total,
        page,
        perPage,
        totalPages
      },
      meta: {
        approach: 'RELATIONAL_JOIN',
        query_type: 'FOREIGN_KEY_BASED',
        user_outlet_id: request.user?.outlet_id || null
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in getOutletOrdersRelational:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch outlet orders (relational)',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Migration helper to populate outlet relationships in existing orders
 */
export async function migrateOrdersToRelational(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    console.log('🔄 Starting migration to relational order-outlet relationships...');
    
    // Step 1: Map orders to outlets based on lokasi_pengiriman
    const migrationQuery = `
      UPDATE orders SET 
        outlet_id = (
          SELECT o.id 
          FROM outlets o 
          WHERE LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.name || '%')
             OR LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.location || '%')
          LIMIT 1
        )
      WHERE outlet_id IS NULL
        AND lokasi_pengiriman IS NOT NULL
    `;
    
    const migrationResult = await env.DB.prepare(migrationQuery).run();
    
    console.log('✅ Simplified migration: Using outlet_id only');
    
    console.log('✅ Migration completed successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Orders migrated to relational structure successfully',
      results: {
        orders_mapped: migrationResult.changes || 0,
        delivery_assignments: deliveryResult.changes || 0,
        pickup_assignments: pickupResult.changes || 0
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in migration:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Migration failed',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
