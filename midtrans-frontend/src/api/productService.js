import apiClient from './api';

// Product service functions
export const productService = {
  // Get all products, optionally filtered by name
  async getProducts(searchTerm = '') {
    try {
      const url = searchTerm ? `/api/products?name=${encodeURIComponent(searchTerm)}` : '/api/products';
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  // Create a new product
  async createProduct(productData) {
    try {
      const response = await apiClient.post('/api/products', productData);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  // Update an existing product
  async updateProduct(productId, productData) {
    try {
      const response = await apiClient.put(`/api/products/${productId}`, productData);
      return response.data;
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      throw error;
    }
  },

  // Delete a product
  async deleteProduct(productId) {
    try {
      const response = await apiClient.delete(`/api/products/${productId}`);
      return response.data; // Or handle 204 No Content response
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  },
};
