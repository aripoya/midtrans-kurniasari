/**
 * RELATIONAL VERSION of getOutletOrders
 * Using proper JOIN instead of string matching for better performance and accuracy
 */
import { derivePaymentStatusFromData } from '../utils/payment-status.js';

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
    
    // NOTE: order_status is being removed. Ignore status filter for now to avoid relying on the column.
    
    // Apply role-specific filters using PROPER JOINS
    let queryParams = [];
    let countParams = [];
    
    // No push for removed order_status
    
    if (request.user) {
      if (request.user.role === 'outlet_manager') {
        // COMPREHENSIVE OUTLET MATCHING: 
        // 1. Direct outlet_id matching (primary)
        // 2. Legacy string matching for orders without outlet_id (fallback)
        
        const outletId = request.user.outlet_id || '';
        
        // Get outlet info for legacy string matching
        let outletName = '';
        try {
          if (outletId) {
            const outletInfo = await env.DB.prepare(`SELECT name FROM outlets_unified WHERE id = ?`).bind(outletId).first();
            outletName = outletInfo?.name || '';
          }
        } catch (error) {
          console.warn('Could not fetch outlet info:', error);
        }
        
        // Build comprehensive outlet condition
        let outletConditions = [];
        
        // ⭐ PRIMARY: Direct outlet_id matching (most reliable)
        if (outletId) {
          outletConditions.push(`o.outlet_id = ?`);
          queryParams.push(outletId);
          countParams.push(outletId);
        }
        
        // ⭐ FALLBACK: Location-based matching for legacy orders without outlet_id
        if (outletName) {
          let legacyMatchingConditions = [];
          
          // Add outlet name matching
          legacyMatchingConditions.push(`LOWER(o.lokasi_pengiriman) LIKE LOWER(?)`);
          queryParams.push(`%${outletName}%`);
          countParams.push(`%${outletName}%`);
          
          // Add special patterns for common outlet names
          if (outletName.toLowerCase().includes('bonbin')) {
            legacyMatchingConditions.push(`LOWER(o.lokasi_pengiriman) LIKE LOWER(?)`);
            legacyMatchingConditions.push(`LOWER(o.lokasi_pengambilan) LIKE LOWER(?)`);
            legacyMatchingConditions.push(`LOWER(o.shipping_area) LIKE LOWER(?)`);
            queryParams.push('%bonbin%', '%bonbin%', '%bonbin%');
            countParams.push('%bonbin%', '%bonbin%', '%bonbin%');
          }
          
          if (outletName.toLowerCase().includes('malioboro')) {
            legacyMatchingConditions.push(`LOWER(o.lokasi_pengiriman) LIKE LOWER(?)`);
            legacyMatchingConditions.push(`LOWER(o.shipping_area) LIKE LOWER(?)`);
            queryParams.push('%malioboro%', '%malioboro%');
            countParams.push('%malioboro%', '%malioboro%');
          }
          
          if (outletName.toLowerCase().includes('jogja')) {
            legacyMatchingConditions.push(`LOWER(o.lokasi_pengiriman) LIKE LOWER(?)`);
            legacyMatchingConditions.push(`LOWER(o.lokasi_pengambilan) LIKE LOWER(?)`);
            queryParams.push('%jogja%', '%jogja%');
            countParams.push('%jogja%', '%jogja%');
          }
          
          // Create legacy condition for orders without outlet_id
          if (legacyMatchingConditions.length > 0) {
            outletConditions.push(`(o.outlet_id IS NULL AND (${legacyMatchingConditions.join(' OR ')}))`);
          }
        }
        
        // Combine all outlet conditions with OR
        if (outletConditions.length > 0) {
          const finalOutletCondition = ` AND (${outletConditions.join(' OR ')})`;
          orderQuery += finalOutletCondition;
          countQuery += finalOutletCondition;
        }
        
        console.log(`🏪 Filtering orders for outlet manager: ${outletName} (ID: ${outletId}) with comprehensive matching`);
        console.log(`📊 Query params count: ${queryParams.length}, Count params count: ${countParams.length}`);
        
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
        payment_status: derivePaymentStatusFromData(order)
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
    
    // Step 1: Map orders to outlets based on lokasi_pengiriman/lokasi_pengambilan/shipping_area
    const migrationQuery = `
      UPDATE orders SET 
        outlet_id = (
          SELECT ou.id 
          FROM outlets_unified ou 
          WHERE 
            (orders.lokasi_pengiriman IS NOT NULL AND (
              LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.name || '%') OR
              LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.location_alias || '%')
            ))
            OR (orders.lokasi_pengambilan IS NOT NULL AND (
              LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou.name || '%') OR
              LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou.location_alias || '%')
            ))
            OR (orders.shipping_area IS NOT NULL AND (
              LOWER(orders.shipping_area) LIKE LOWER('%' || ou.name || '%') OR
              LOWER(orders.shipping_area) LIKE LOWER('%' || ou.location_alias || '%')
            ))
          LIMIT 1
        )
      WHERE outlet_id IS NULL
        AND (lokasi_pengiriman IS NOT NULL OR lokasi_pengambilan IS NOT NULL OR shipping_area IS NOT NULL)
    `;

    const migrationResult = await env.DB.prepare(migrationQuery).run();

    console.log('✅ Migration completed successfully using outlets_unified');

    return new Response(JSON.stringify({
      success: true,
      message: 'Orders migrated to relational structure successfully',
      results: {
        orders_mapped: migrationResult?.changes || 0
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
