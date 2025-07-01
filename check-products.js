// Script to check if the "ongkir" product still exists

const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

async function checkProducts() {
  try {
    console.log('Fetching all products...');
    
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Products fetched successfully!');
      
      // Check if the "ongkir" product exists
      const ongkirProduct = data.products.find(p => p.name === 'ongkir' || p.id === 19);
      
      if (ongkirProduct) {
        console.log('The "ongkir" product still exists:', ongkirProduct);
      } else {
        console.log('Good news! The "ongkir" product does not exist in the database.');
      }
      
      // Show list of all product names and IDs for reference
      console.log('\nAll products:');
      data.products.forEach(p => {
        console.log(`ID: ${p.id}, Name: ${p.name}, Price: ${p.price}`);
      });
    } else {
      console.error('Server returned an error:', response.status, data);
    }
  } catch (error) {
    console.error('Failed to fetch products:', error.message);
  }
}

// Execute the function
checkProducts();
