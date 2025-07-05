/**
 * Handler untuk operasi terkait pengiriman (shipping)
 * Termasuk upload gambar, update status, dan operasi lainnya
 */

// Helper untuk respons JSON standar
const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
};

/**
 * Upload gambar status pengiriman ke R2 dan simpan referensinya di D1
 */
async function uploadShippingImage(request, env) {
  try {
    // Validasi metode request
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Parse URL untuk mendapatkan ID order dan tipe gambar
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    
    // Format path: /api/shipping/images/:orderId/:imageType
    if (pathSegments.length < 6) {
      return jsonResponse({ error: 'Invalid URL format' }, 400);
    }

    const orderId = pathSegments[4];
    const imageType = pathSegments[5];
    
    // Validasi tipe gambar
    const validTypes = ['ready_for_pickup', 'picked_up', 'delivered'];
    if (!validTypes.includes(imageType)) {
      return jsonResponse({ 
        error: 'Invalid image type', 
        validTypes 
      }, 400);
    }
    
    // Validasi bahwa order ID ada di database
    const orderExists = await env.DB.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).bind(orderId).first();
    
    if (!orderExists) {
      return jsonResponse({ error: 'Order not found' }, 404);
    }

    // Tangani konten multipart/form-data untuk upload file
    const formData = await request.formData();
    const file = formData.get('image');
    
    if (!file || !(file instanceof File)) {
      return jsonResponse({ error: 'No image provided' }, 400);
    }

    // Validasi tipe file
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      return jsonResponse({
        error: 'Invalid file type', 
        validTypes: validMimeTypes
      }, 400);
    }

    // Buat nama file unik dengan timestamp
    const timestamp = new Date().getTime();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${orderId}_${imageType}_${timestamp}.${fileExtension}`;
    
    // Upload file ke R2
    await env.SHIPPING_IMAGES.put(fileName, file, {
      httpMetadata: {
        contentType: file.type
      }
    });
    
    // Generate URL untuk gambar
    // Menggunakan Cloudflare R2 custom domain yang valid
    const imageUrl = `https://proses.kurniasari.co.id/${fileName}`;
    
    // Hapus referensi gambar lama dengan tipe yang sama jika ada
    await env.DB.prepare(
      'DELETE FROM shipping_images WHERE order_id = ? AND image_type = ?'
    ).bind(orderId, imageType).run();
    
    // Simpan referensi gambar di database D1
    await env.DB.prepare(
      'INSERT INTO shipping_images (order_id, image_type, image_url) VALUES (?, ?, ?)'
    ).bind(orderId, imageType, imageUrl).run();
    
    return jsonResponse({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        orderId,
        imageType,
        imageUrl,
        fileName
      }
    });
  } catch (error) {
    console.error('Error uploading shipping image:', error);
    return jsonResponse({
      error: 'Failed to upload image',
      message: error.message
    }, 500);
  }
}

/**
 * Ambil gambar status pengiriman untuk order tertentu
 */
async function getShippingImages(request, env) {
  try {
    // Parse URL untuk mendapatkan ID order
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    
    // Format path: /api/shipping/images/:orderId
    if (pathSegments.length < 5) {
      return jsonResponse({ error: 'Invalid URL format' }, 400);
    }

    const orderId = pathSegments[4];
    
    // Validasi bahwa order ID ada di database
    const orderExists = await env.DB.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).bind(orderId).first();
    
    if (!orderExists) {
      return jsonResponse({ error: 'Order not found' }, 404);
    }
    
    // Ambil semua gambar untuk order tersebut
    const images = await env.DB.prepare(
      'SELECT * FROM shipping_images WHERE order_id = ?'
    ).bind(orderId).all();
    
    return jsonResponse({
      success: true,
      data: images.results
    });
  } catch (error) {
    console.error('Error getting shipping images:', error);
    return jsonResponse({
      error: 'Failed to get shipping images',
      message: error.message
    }, 500);
  }
}

/**
 * Handler untuk preflight CORS request
 */
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Hapus gambar status pengiriman dari R2 dan database D1
 */
async function deleteShippingImage(request, env) {
  try {
    // Validasi metode request
    if (request.method !== 'DELETE') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Parse URL untuk mendapatkan ID order dan tipe gambar
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    
    // Format path: /api/shipping/images/:orderId/:imageType
    if (pathSegments.length < 6) {
      return jsonResponse({ error: 'Invalid URL format' }, 400);
    }

    const orderId = pathSegments[4];
    const imageType = pathSegments[5];
    
    // Validasi tipe gambar
    const validTypes = ['ready_for_pickup', 'picked_up', 'delivered'];
    if (!validTypes.includes(imageType)) {
      return jsonResponse({ 
        error: 'Invalid image type', 
        validTypes 
      }, 400);
    }
    
    // Validasi bahwa order ID ada di database
    const orderExists = await env.DB.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).bind(orderId).first();
    
    if (!orderExists) {
      return jsonResponse({ error: 'Order not found' }, 404);
    }

    // Cari data gambar yang akan dihapus untuk mendapatkan nama file
    const image = await env.DB.prepare(
      'SELECT * FROM shipping_images WHERE order_id = ? AND image_type = ?'
    ).bind(orderId, imageType).first();

    if (!image) {
      return jsonResponse({ error: 'Image not found' }, 404);
    }

    // Ekstrak nama file dari URL
    const imageUrl = image.image_url;
    const fileName = imageUrl.split('/').pop().split('?')[0]; // Ambil nama file saja, hapus query params

    // Hapus file dari R2
    await env.SHIPPING_IMAGES.delete(fileName);
    
    // Hapus referensi dari database D1
    await env.DB.prepare(
      'DELETE FROM shipping_images WHERE order_id = ? AND image_type = ?'
    ).bind(orderId, imageType).run();
    
    return jsonResponse({
      success: true,
      message: 'Image deleted successfully',
      data: {
        orderId,
        imageType
      }
    });
  } catch (error) {
    console.error('Error deleting shipping image:', error);
    return jsonResponse({
      error: 'Failed to delete image',
      message: error.message
    }, 500);
  }
}

/**
 * Route handler untuk request shipping
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  // Tangani preflight CORS request
  if (request.method === 'OPTIONS') {
    return handleCors();
  }

  // Route untuk upload gambar: POST /api/shipping/images/:orderId/:imageType
  if (url.pathname.match(/^\/api\/shipping\/images\/[^\/]+\/[^\/]+$/)) {
    if (request.method === 'POST') {
      return uploadShippingImage(request, env);
    } else if (request.method === 'DELETE') {
      return deleteShippingImage(request, env);
    }
  }
  
  // Route untuk mendapatkan gambar: GET /api/shipping/images/:orderId
  if (url.pathname.match(/^\/api\/shipping\/images\/[^\/]+$/) && request.method === 'GET') {
    return getShippingImages(request, env);
  }
  
  // Route tidak ditemukan
  return jsonResponse({ error: 'Not found' }, 404);
}

export { handleRequest };
