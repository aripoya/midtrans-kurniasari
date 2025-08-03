/**
 * Outlet Assignment Logic
 * Determines which outlet should handle an order based on location information
 */

/**
 * Determine outlet ID from location information
 * @param {string} lokasi_pengiriman - Delivery location
 * @param {string} lokasi_pengambilan - Pickup location  
 * @param {string} shipping_area - Shipping area
 * @returns {string|null} - Outlet ID or null if no match
 */
export function determineOutletFromLocation(lokasi_pengiriman, lokasi_pengambilan, shipping_area) {
  // Normalize inputs to lowercase for case-insensitive matching
  const pengiriman = (lokasi_pengiriman || '').toLowerCase().trim();
  const pengambilan = (lokasi_pengambilan || '').toLowerCase().trim();
  const area = (shipping_area || '').toLowerCase().trim();
  
  // Combine all location fields for comprehensive matching
  const combinedLocation = `${pengiriman} ${pengambilan} ${area}`.toLowerCase();
  
  console.log('🏪 Determining outlet for locations:', {
    lokasi_pengiriman: pengiriman,
    lokasi_pengambilan: pengambilan, 
    shipping_area: area,
    combinedLocation
  });

  // Define outlet mappings with multiple keywords per outlet
  const outletMappings = {
    'outlet_bonbin': [
      'bonbin',
      'outlet bonbin', 
      'ragunan',
      'kebun binatang',
      'taman margasatwa'
    ],
    'outlet_malioboro': [
      'malioboro',
      'outlet malioboro',
      'jalan malioboro',
      'malboro',
      'maliboro'
    ],
    'outlet_jogja': [
      'jogja',
      'yogyakarta',
      'outlet jogja',
      'yogya',
      'diy'
    ],
    'outlet_solo': [
      'solo',
      'surakarta',
      'outlet solo',
      'surakarta'
    ],
    'outlet_semarang': [
      'semarang',
      'outlet semarang',
      'smg'
    ]
  };

  // Check each outlet mapping
  for (const [outletId, keywords] of Object.entries(outletMappings)) {
    for (const keyword of keywords) {
      // Check if any location field contains the keyword
      if (pengiriman.includes(keyword) || 
          pengambilan.includes(keyword) || 
          area.includes(keyword) ||
          combinedLocation.includes(keyword)) {
        
        console.log(`✅ Outlet match found: ${outletId} (keyword: "${keyword}")`);
        return outletId;
      }
    }
  }
  
  console.log('❌ No outlet match found for locations:', {
    lokasi_pengiriman: pengiriman,
    lokasi_pengambilan: pengambilan,
    shipping_area: area
  });
  
  return null; // No match found
}

/**
 * Get outlet information by ID
 * @param {Object} env - Environment object with DB binding
 * @param {string} outletId - Outlet ID to lookup
 * @returns {Object|null} - Outlet info or null
 */
export async function getOutletInfo(env, outletId) {
  if (!outletId || !env.DB) {
    return null;
  }
  
  try {
    const outlet = await env.DB.prepare(
      'SELECT id, name, location, address FROM outlets WHERE id = ?'
    ).bind(outletId).first();
    
    return outlet;
  } catch (error) {
    console.error('Error fetching outlet info:', error);
    return null;
  }
}

/**
 * Auto-assign outlet to existing orders that don't have outlet_id set
 * @param {Object} env - Environment object with DB binding
 * @returns {Object} - Assignment results
 */
export async function autoAssignOutletsToExistingOrders(env) {
  if (!env.DB) {
    throw new Error('Database not available');
  }
  
  try {
    console.log('🔄 Starting auto-assignment of outlets to existing orders...');
    
    // Get orders without outlet_id
    const ordersWithoutOutlet = await env.DB.prepare(`
      SELECT id, lokasi_pengiriman, lokasi_pengambilan, shipping_area 
      FROM orders 
      WHERE outlet_id IS NULL OR outlet_id = ''
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    
    console.log(`📦 Found ${ordersWithoutOutlet.results?.length || 0} orders without outlet assignment`);
    
    let assignedCount = 0;
    let skippedCount = 0;
    const assignments = [];
    
    for (const order of (ordersWithoutOutlet.results || [])) {
      const outletId = determineOutletFromLocation(
        order.lokasi_pengiriman,
        order.lokasi_pengambilan, 
        order.shipping_area
      );
      
      if (outletId) {
        // Update the order with outlet assignment
        await env.DB.prepare(
          'UPDATE orders SET outlet_id = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(outletId, order.id).run();
        
        assignments.push({
          orderId: order.id,
          outletId: outletId,
          location: order.lokasi_pengiriman || order.lokasi_pengambilan || order.shipping_area
        });
        
        assignedCount++;
        console.log(`✅ Assigned order ${order.id} to ${outletId}`);
      } else {
        skippedCount++;
        console.log(`⏭️ Skipped order ${order.id} - no outlet match`);
      }
    }
    
    console.log(`🎉 Auto-assignment completed: ${assignedCount} assigned, ${skippedCount} skipped`);
    
    return {
      success: true,
      totalProcessed: ordersWithoutOutlet.results?.length || 0,
      assigned: assignedCount,
      skipped: skippedCount,
      assignments: assignments
    };
    
  } catch (error) {
    console.error('Error in auto-assignment:', error);
    throw error;
  }
}
