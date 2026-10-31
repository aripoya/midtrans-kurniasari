/**
 * Cloudflare Images Handler
 * Handles image uploads using Cloudflare Images API
 */

/**
 * Upload image to Cloudflare Images
 * @param {File} file - Image file to upload
 * @param {Object} env - Environment variables
 * @returns {Object} Upload result with image URL
 */
export async function uploadToCloudflareImages(file, env) {
  try {
    const { CLOUDFLARE_ACCOUNT_ID, CF_IMAGES_TOKEN } = env;

    // Fallback: jika kredensial Cloudflare Images belum dikonfigurasi,
    // upload langsung ke bucket R2 SHIPPING_IMAGES agar fitur tetap bekerja.
    if (!CLOUDFLARE_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      console.warn('[CloudflareImages] Credentials not configured. Falling back to R2 bucket upload.');

      if (!env.SHIPPING_IMAGES) {
        throw new Error('Neither Cloudflare Images nor SHIPPING_IMAGES bucket is configured');
      }

      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
      const fileName = `fallback_${timestamp}_${random}.${ext}`;

      await env.SHIPPING_IMAGES.put(fileName, file, {
        httpMetadata: {
          contentType: file.type || 'image/jpeg',
        },
      });

      const imageUrl = `https://proses.kurniasari.co.id/${fileName}`;

      return {
        success: true,
        data: {
          imageId: null,
          imageUrl,
          publicUrl: imageUrl,
          variants: {
            thumbnail: imageUrl,
            medium: imageUrl,
            large: imageUrl,
            public: imageUrl,
          },
          metadata: { fallback: 'r2', uploadedAt: new Date().toISOString() },
        },
      };
    }

    // --- Normal path: upload ke Cloudflare Images API ---

    // Create FormData for Cloudflare Images API
    const formData = new FormData();
    formData.append('file', file);
    
    // Optional: Add metadata
    const metadata = {
      uploadedAt: new Date().toISOString(),
      source: 'order-management-system'
    };
    formData.append('metadata', JSON.stringify(metadata));

    // Upload to Cloudflare Images
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
        },
        body: formData
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Cloudflare Images upload failed:', result);
      throw new Error(result.errors?.[0]?.message || 'Upload to Cloudflare Images failed');
    }

    if (!result.success) {
      console.error('Cloudflare Images API error:', result);
      throw new Error(result.errors?.[0]?.message || 'Cloudflare Images API error');
    }

    // Return the image URLs
    const imageData = result.result;
    return {
      success: true,
      data: {
        imageId: imageData.id,
        imageUrl: imageData.variants[0], // Default variant
        publicUrl: `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}/${imageData.id}/public`,
        variants: {
          thumbnail: `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}/${imageData.id}/thumbnail`,
          medium: `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}/${imageData.id}/medium`,
          large: `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}/${imageData.id}/large`,
          public: `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}/${imageData.id}/public`
        },
        metadata: imageData.meta
      }
    };

  } catch (error) {
    console.error('Error uploading to Cloudflare Images:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete image from Cloudflare Images
 * @param {string} imageId - Image ID to delete
 * @param {Object} env - Environment variables
 * @returns {Object} Delete result
 */
export async function deleteFromCloudflareImages(imageId, env) {
  try {
    const { CLOUDFLARE_ACCOUNT_ID, CF_IMAGES_TOKEN } = env;
    
    if (!CLOUDFLARE_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      throw new Error('Cloudflare Images credentials not configured');
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
        }
      }
    );

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      console.error('Cloudflare Images delete failed:', result);
      throw new Error(result.errors?.[0]?.message || 'Delete from Cloudflare Images failed');
    }

    return {
      success: true,
      data: { deleted: true }
    };

  } catch (error) {
    console.error('Error deleting from Cloudflare Images:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get image variants for display
 * @param {string} imageId - Image ID
 * @param {string} hash - Cloudflare Images hash
 * @returns {Object} Image variants URLs
 */
export function getImageVariants(imageId, hash) {
  return {
    thumbnail: `https://imagedelivery.net/${hash}/${imageId}/thumbnail`,
    medium: `https://imagedelivery.net/${hash}/${imageId}/medium`, 
    large: `https://imagedelivery.net/${hash}/${imageId}/large`,
    public: `https://imagedelivery.net/${hash}/${imageId}/public`,
    original: `https://imagedelivery.net/${hash}/${imageId}/original`
  };
}
