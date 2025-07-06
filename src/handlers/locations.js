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

    // Fetch only location names, ordered alphabetically
    const locations = await env.DB.prepare(
      `SELECT id, nama_lokasi 
       FROM locations 
       ORDER BY nama_lokasi ASC`
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
