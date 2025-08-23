export async function handleGetOutlets(request, env) {
    try {
        // Fetch all active outlets from the database
        const { results } = await env.DB.prepare(
            'SELECT id, name FROM outlets WHERE is_active = TRUE ORDER BY name'
        ).all();

        return new Response(JSON.stringify({ success: true, data: results }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error fetching outlets:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: 'Failed to fetch outlets.', 
            error: error.message 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}
