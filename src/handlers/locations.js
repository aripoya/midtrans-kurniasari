// Handler for locations functionality
export async function getLocations(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!env.DB) {
      console.warn("[getLocations] Database binding not found.");
      // Return empty array instead of throwing an error
      return new Response(
        JSON.stringify({ 
          success: true, 
          locations: [],
          warning: "Database binding not available"
        }), 
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Check if the compatibility view exists before querying
    const tableExists = await env.DB.prepare(
      `SELECT name FROM sqlite_master 
       WHERE type='view' AND name='locations_view'`
    ).first();

    // If table doesn't exist, return empty array with success
    if (!tableExists) {
      console.log("[getLocations] Locations table doesn't exist.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          locations: [],
          warning: "Locations table not found"
        }), 
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Fetch only location names, ordered alphabetically (from compatibility view)
    const locations = await env.DB.prepare(
      `SELECT id, nama_lokasi 
       FROM locations_view 
       ORDER BY nama_lokasi ASC`
    ).all();

    return new Response(
      JSON.stringify({ 
        success: true, 
        locations: locations.results || [] 
      }), 
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error(`[getLocations] Error:`, error);
    
    // Return success with empty array instead of error
    // This prevents frontend crashes
    return new Response(
      JSON.stringify({ 
        success: true, 
        locations: [],
        error_info: error.message // For debugging only
      }), 
      { 
        status: 200, // Use 200 instead of 500 to prevent frontend errors
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}
