// Debug script to check shipping images for specific order
// Usage: node debug-shipping-images.js ORDER-1755607910696-007CW

const orderId = process.argv[2] || 'ORDER-1755607910696-007CW';

async function checkShippingImages() {
  try {
    // Make API call to check shipping images
    const response = await fetch(`https://order-management-app-production.wahwooh.workers.dev/api/shipping/images/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if available
        'Authorization': `Bearer ${process.env.AUTH_TOKEN || ''}`
      }
    });

    const result = await response.text();
    console.log('=== SHIPPING IMAGES API RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response:', result);
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('\n=== PARSED DATA ===');
      console.log('Success:', data.success);
      console.log('Images found:', data.data?.images?.length || 0);
      
      if (data.data?.images) {
        data.data.images.forEach((img, index) => {
          console.log(`\nImage ${index + 1}:`, {
            image_type: img.image_type,
            image_url: img.image_url?.substring(0, 80) + '...',
            cloudflare_image_id: img.cloudflare_image_id,
            created_at: img.created_at
          });
        });
      }
    }
  } catch (error) {
    console.error('Error checking shipping images:', error.message);
  }
}

checkShippingImages();
