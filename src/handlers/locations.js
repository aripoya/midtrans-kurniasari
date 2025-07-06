// Handler for locations functionality
export async function getLocations(request, env) {
  const corsHeaders = {
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
      throw new Error("Database binding not found.");
    }

    // Fetch all locations ordered by kode_area
    const locations = await env.DB.prepare(
      `SELECT id, kode_area, nama_lokasi, created_at, updated_at 
       FROM locations 
       ORDER BY kode_area ASC`
    ).all();

    return new Response(
      JSON.stringify({ 
        success: true, 
        locations: locations.results 
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
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch locations',
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}
