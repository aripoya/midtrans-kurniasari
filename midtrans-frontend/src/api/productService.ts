import apiClient from './api';

// TypeScript interfaces for product service
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  stock_quantity?: number;
  is_active?: boolean;
  image_url?: string;
  weight?: number; // in grams
  dimensions?: {
    length?: number; // in cm
    width?: number;  // in cm
    height?: number; // in cm
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  stock_quantity?: number;
  is_active?: boolean;
  image_url?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  sku?: string;
  stock_quantity?: number;
  is_active?: boolean;
  image_url?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

export interface GetProductsResponse {
  success: boolean;
  products: Product[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

export interface CreateProductResponse {
  success: boolean;
  product?: Product;
  message?: string;
  error?: string;
}

export interface UpdateProductResponse {
  success: boolean;
  product?: Product;
  message?: string;
  error?: string;
}

export interface DeleteProductResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ProductServiceError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

export interface ProductSearchParams {
  name?: string;
  category?: string;
  is_active?: boolean;
  min_price?: number;
  max_price?: number;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'price' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Product service for managing product data with comprehensive TypeScript support
 * Provides CRUD operations for product management with type safety
 */
class ProductService {
  /**
   * Handle API response with error checking
   * @param response - API response promise
   * @returns Promise with parsed response data
   */
  private async handleResponse<T>(responsePromise: Promise<any>): Promise<T> {
    try {
      const response = await responsePromise;
      return response.data;
    } catch (error: any) {
      console.error('Product service error:', error);
      
      const productError = new Error(
        error.response?.data?.message || 
        error.response?.data?.error ||
        error.message || 
        'Product service operation failed'
      ) as ProductServiceError;
      
      productError.response = error.response;
      throw productError;
    }
  }

  /**
   * Build query string from search parameters
   * @param params - Search parameters
   * @returns Query string
   */
  private buildQueryString(params: ProductSearchParams): string {
    const queryParams = new URLSearchParams();
    
    if (params.name) queryParams.set('name', params.name);
    if (params.category) queryParams.set('category', params.category);
    if (params.is_active !== undefined) queryParams.set('is_active', String(params.is_active));
    if (params.min_price !== undefined) queryParams.set('min_price', String(params.min_price));
    if (params.max_price !== undefined) queryParams.set('max_price', String(params.max_price));
    if (params.page) queryParams.set('page', String(params.page));
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.sort_by) queryParams.set('sort_by', params.sort_by);
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);
    
    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Get all products with optional filtering and search
   * @param searchTerm - Optional search term for product name
   * @returns Promise with products data
   */
  async getProducts(searchTerm: string = ''): Promise<GetProductsResponse> {
    const url = searchTerm 
      ? `/api/products?name=${encodeURIComponent(searchTerm)}` 
      : '/api/products';
    
    return this.handleResponse<GetProductsResponse>(
      apiClient.get(url)
    );
  }

  /**
   * Get products with advanced search parameters
   * @param params - Search and filter parameters
   * @returns Promise with products data
   */
  async searchProducts(params: ProductSearchParams): Promise<GetProductsResponse> {
    const queryString = this.buildQueryString(params);
    const url = `/api/products${queryString}`;
    
    return this.handleResponse<GetProductsResponse>(
      apiClient.get(url)
    );
  }

  /**
   * Get a single product by ID
   * @param productId - Product ID to fetch
   * @returns Promise with product data
   */
  async getProduct(productId: string): Promise<{ success: boolean; product?: Product; error?: string }> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.handleResponse<{ success: boolean; product?: Product; error?: string }>(
      apiClient.get(`/api/products/${encodeURIComponent(productId)}`)
    );
  }

  /**
   * Create a new product
   * @param productData - Product creation data
   * @returns Promise with created product data
   */
  async createProduct(productData: CreateProductRequest): Promise<CreateProductResponse> {
    // Validate required fields
    if (!productData.name) {
      throw new Error('Product name is required');
    }
    
    if (!productData.price || productData.price <= 0) {
      throw new Error('Product price is required and must be greater than 0');
    }

    return this.handleResponse<CreateProductResponse>(
      apiClient.post('/api/products', productData)
    );
  }

  /**
   * Update an existing product
   * @param productId - Product ID to update
   * @param productData - Updated product data
   * @returns Promise with updated product data
   */
  async updateProduct(productId: string, productData: UpdateProductRequest): Promise<UpdateProductResponse> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    if (!productData || Object.keys(productData).length === 0) {
      throw new Error('Update data is required');
    }

    // Validate price if provided
    if (productData.price !== undefined && productData.price <= 0) {
      throw new Error('Product price must be greater than 0');
    }

    return this.handleResponse<UpdateProductResponse>(
      apiClient.put(`/api/products/${encodeURIComponent(productId)}`, productData)
    );
  }

  /**
   * Delete a product
   * @param productId - Product ID to delete
   * @returns Promise with deletion result
   */
  async deleteProduct(productId: string): Promise<DeleteProductResponse> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.handleResponse<DeleteProductResponse>(
      apiClient.delete(`/api/products/${encodeURIComponent(productId)}`)
    );
  }

  /**
   * Type guard to check if response indicates success
   * @param response - API response to check
   * @returns True if response indicates success
   */
  isSuccessResponse<T extends { success: boolean }>(response: T): response is T & { success: true } {
    return response.success === true;
  }

  /**
   * Extract error message from API response
   * @param response - API response to extract error from
   * @returns Error message string
   */
  getErrorMessage(response: { error?: string; message?: string }): string {
    return response.error || response.message || 'An unknown error occurred';
  }

  /**
   * Format product price for display
   * @param price - Product price in smallest currency unit
   * @param currency - Currency code (default: 'IDR')
   * @returns Formatted price string
   */
  formatPrice(price: number, currency: string = 'IDR'): string {
    if (currency === 'IDR') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(price);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price);
  }

  /**
   * Calculate product weight in kilograms
   * @param product - Product data
   * @returns Weight in kg or null if not specified
   */
  getWeightInKg(product: Product): number | null {
    return product.weight ? product.weight / 1000 : null;
  }

  /**
   * Calculate product volume in cubic meters
   * @param product - Product data
   * @returns Volume in cubic meters or null if dimensions not specified
   */
  getVolumeInCubicMeters(product: Product): number | null {
    const { dimensions } = product;
    if (!dimensions?.length || !dimensions?.width || !dimensions?.height) {
      return null;
    }
    
    // Convert cm³ to m³
    return (dimensions.length * dimensions.width * dimensions.height) / 1000000;
  }

  /**
   * Check if product is in stock
   * @param product - Product data
   * @returns True if product is in stock
   */
  isInStock(product: Product): boolean {
    return (product.stock_quantity ?? 0) > 0;
  }

  /**
   * Check if product is active
   * @param product - Product data
   * @returns True if product is active
   */
  isActive(product: Product): boolean {
    return product.is_active !== false;
  }

  /**
   * Filter products by category
   * @param products - Array of products
   * @param category - Category to filter by
   * @returns Filtered array of products
   */
  filterByCategory(products: Product[], category: string): Product[] {
    return products.filter(product => 
      product.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Filter products by price range
   * @param products - Array of products
   * @param minPrice - Minimum price (inclusive)
   * @param maxPrice - Maximum price (inclusive)
   * @returns Filtered array of products
   */
  filterByPriceRange(products: Product[], minPrice?: number, maxPrice?: number): Product[] {
    return products.filter(product => {
      if (minPrice !== undefined && product.price < minPrice) return false;
      if (maxPrice !== undefined && product.price > maxPrice) return false;
      return true;
    });
  }

  /**
   * Sort products by specified criteria
   * @param products - Array of products to sort
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort order (asc/desc)
   * @returns Sorted array of products
   */
  sortProducts(
    products: Product[], 
    sortBy: ProductSearchParams['sort_by'] = 'name', 
    sortOrder: ProductSearchParams['sort_order'] = 'asc'
  ): Product[] {
    const sortedProducts = [...products];
    
    sortedProducts.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'created_at':
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return sortedProducts;
  }

  /**
   * Get unique categories from products array
   * @param products - Array of products
   * @returns Array of unique categories
   */
  getUniqueCategories(products: Product[]): string[] {
    const categories = products
      .map(product => product.category)
      .filter((category): category is string => !!category);
    
    return [...new Set(categories)].sort();
  }

  /**
   * Validate product data
   * @param productData - Product data to validate
   * @returns True if product data is valid
   */
  isValidProductData(productData: any): productData is CreateProductRequest {
    if (!productData || typeof productData !== 'object') {
      return false;
    }

    if (!productData.name || typeof productData.name !== 'string') {
      return false;
    }

    if (!productData.price || typeof productData.price !== 'number' || productData.price <= 0) {
      return false;
    }

    return true;
  }
}

// Create and export singleton instance
export const productService = new ProductService();

// Export default for compatibility with existing imports
export default productService;
