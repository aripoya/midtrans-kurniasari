/**
 * Product handlers
 */

// Utility to create a standard JSON response
const jsonResponse = (data, status = 200, corsHeaders) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
};

/**
 * GET /api/products
 * Get all products, with optional search by name.
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
export const getProducts = async (request, env) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('name'); // Correctly parse search param
    let query;

    try {
        if (search) {
            query = env.DB.prepare('SELECT * FROM products WHERE name LIKE ? ORDER BY created_at DESC').bind(`%${search}%`);
        } else {
            query = env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC');
        }
        const { results } = await query.all();
        return jsonResponse({ success: true, products: results }, 200, request.corsHeaders);
    } catch (error) {
        console.error('Error getting products:', error);
        return jsonResponse({ success: false, error: 'Failed to fetch products', details: error.message }, 500, request.corsHeaders);
    }
};

/**
 * POST /api/products
 * Create a new product.
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
export const createProduct = async (request, env) => {
    try {
        const { name, price } = await request.json();

        if (!name || !price) {
            return jsonResponse({ success: false, error: 'Product name and price are required' }, 400, request.corsHeaders);
        }

        const query = env.DB.prepare('INSERT INTO products (name, price) VALUES (?, ?) RETURNING *').bind(name, price);
        const result = await query.first();

        return jsonResponse({ success: true, product: result }, 201, request.corsHeaders);
    } catch (error) {
        console.error('Error creating product:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return jsonResponse({ success: false, error: 'Product with this name already exists' }, 409, request.corsHeaders);
        }
        return jsonResponse({ success: false, error: 'Failed to create product', details: error.message }, 500, request.corsHeaders);
    }
};

/**
 * PUT /api/products/:id
 * Update an existing product.
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
export const updateProduct = async (request, env) => {
    try {
        const { id } = request.params;
        const { name, price } = await request.json();

        if (!name || !price) {
            return jsonResponse({ success: false, error: 'Product name and price are required' }, 400, request.corsHeaders);
        }

        const query = env.DB.prepare('UPDATE products SET name = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *').bind(name, price, id);
        const result = await query.first();

        if (!result) {
            return jsonResponse({ success: false, error: 'Product not found' }, 404, request.corsHeaders);
        }

        return jsonResponse({ success: true, product: result }, 200, request.corsHeaders);
    } catch (error) {
        console.error('Error updating product:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return jsonResponse({ success: false, error: 'Another product with this name already exists' }, 409, request.corsHeaders);
        }
        return jsonResponse({ success: false, error: 'Failed to update product', details: error.message }, 500, request.corsHeaders);
    }
};

/**
 * DELETE /api/products/:id
 * Delete a product.
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
export const deleteProduct = async (request, env) => {
    try {
        const { id } = request.params;

        const query = env.DB.prepare('DELETE FROM products WHERE id = ?');
        await query.bind(id).run();

        // Standard practice is to return 204 No Content on successful deletion.
        return new Response(null, { status: 204, headers: request.corsHeaders });
    } catch (error) {
        console.error('Error deleting product:', error);
        return jsonResponse({ success: false, error: 'Failed to delete product', details: error.message }, 500, request.corsHeaders);
    }
};
