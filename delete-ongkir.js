// Script to delete the "ongkir" product with ID 19

const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';
const PRODUCT_ID = 19;

async function deleteOngkirProduct() {
  try {
    console.log(`Attempting to delete product with ID ${PRODUCT_ID}...`);
    
    const response = await fetch(`${API_BASE_URL}/api/products/${PRODUCT_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Success! Product deleted:', data);
    } else {
      console.error('Server returned an error:', response.status, data);
    }
  } catch (error) {
    console.error('Failed to delete product:', error.message);
  }
}

// Execute the function
deleteOngkirProduct();
