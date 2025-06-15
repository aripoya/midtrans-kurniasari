// Production configuration for Order Management System
const CONFIG = {
    // API Configuration - Update this with your deployed worker URL
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8787' 
        : 'https://order-management-app.your-subdomain.workers.dev',
    
    // Midtrans Configuration
    MIDTRANS_CLIENT_KEY: 'SB-Mid-client-XXXXXXXXXXXXXXXX', // Replace with your client key
    MIDTRANS_IS_PRODUCTION: false, // Set to true for production
    
    // Application Configuration
    APP_NAME: 'Order Management System',
    CURRENCY: 'IDR',
    
    // Payment Configuration
    PAYMENT_CALLBACKS: {
        finish: window.location.origin + '/payment/finish',
        error: window.location.origin + '/payment/error',
        pending: window.location.origin + '/payment/pending'
    }
};

// Global variables
let itemCount = 1;
let orders = [];

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: CONFIG.CURRENCY
    }).format(amount);
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'info' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
    }`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.item-row').forEach(row => {
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const quantity = parseInt(row.querySelector('.item-quantity').value) || 0;
        total += price * quantity;
    });
    document.getElementById('totalAmount').textContent = formatCurrency(total);
    return total;
}

function addItem() {
    itemCount++;
    const container = document.getElementById('itemsContainer');
    const newItem = document.createElement('div');
    newItem.className = 'item-row grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg';
    newItem.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
            <input type="text" class="item-name w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Price (IDR) *</label>
            <input type="number" class="item-price w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" required>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input type="number" class="item-quantity w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="1" value="1" required>
        </div>
        <div class="flex items-end">
            <button type="button" class="remove-item w-full bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors">
                🗑️ Remove
            </button>
        </div>
    `;
    container.appendChild(newItem);
    updateRemoveButtons();
    
    // Add event listeners for new item
    newItem.querySelector('.item-price').addEventListener('input', calculateTotal);
    newItem.querySelector('.item-quantity').addEventListener('input', calculateTotal);
    newItem.querySelector('.remove-item').addEventListener('click', function() {
        newItem.remove();
        updateRemoveButtons();
        calculateTotal();
    });
}

function updateRemoveButtons() {
    const items = document.querySelectorAll('.item-row');
    items.forEach((item, index) => {
        const removeBtn = item.querySelector('.remove-item');
        if (items.length > 1) {
            removeBtn.style.display = 'block';
        } else {
            removeBtn.style.display = 'none';
        }
    });
}

// API Functions
async function createOrder(orderData) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function fetchOrders() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/orders`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.success ? result.orders : [];
    } catch (error) {
        console.error('Fetch Orders Error:', error);
        return [];
    }
}

async function checkTransactionStatus(orderId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/transaction/${orderId}/status`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Transaction Status Error:', error);
        throw error;
    }
}

// Midtrans Integration
function initializeMidtrans() {
    // Load Midtrans Snap script
    const script = document.createElement('script');
    script.src = CONFIG.MIDTRANS_IS_PRODUCTION 
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', CONFIG.MIDTRANS_CLIENT_KEY);
    document.head.appendChild(script);
}

function openMidtransPayment(snapToken, orderId) {
    if (typeof window.snap === 'undefined') {
        showNotification('Payment system not loaded. Please refresh the page.', 'error');
        return;
    }

    window.snap.pay(snapToken, {
        onSuccess: function(result) {
            showNotification('Payment successful!', 'success');
            console.log('Payment success:', result);
            // Refresh orders list
            if (document.getElementById('ordersSection').style.display !== 'none') {
                loadOrders();
            }
        },
        onPending: function(result) {
            showNotification('Payment pending. Please complete your payment.', 'info');
            console.log('Payment pending:', result);
        },
        onError: function(result) {
            showNotification('Payment failed. Please try again.', 'error');
            console.log('Payment error:', result);
        },
        onClose: function() {
            showNotification('Payment popup closed.', 'info');
        }
    });
}

// Order Management Functions
async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center py-8';
    loadingDiv.innerHTML = `
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading orders...</p>
    `;
    container.innerHTML = '';
    container.appendChild(loadingDiv);

    try {
        orders = await fetchOrders();
        renderOrders();
    } catch (error) {
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-500 text-lg">Failed to load orders</p>
                <p class="text-gray-500 text-sm mt-2">${error.message}</p>
                <button onclick="loadOrders()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                    Retry
                </button>
            </div>
        `;
    }
}

function renderOrders() {
    const container = document.getElementById('ordersContainer');
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">📋</div>
                <p class="text-gray-500 text-lg">No orders found</p>
                <p class="text-gray-400 text-sm mt-2">Create your first order to get started!</p>
            </div>
        `;
        return;
    }

    const ordersHTML = orders.map(order => `
        <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">${order.id}</h3>
                    <p class="text-gray-600">${order.customer_name} • ${order.customer_email}</p>
                    <p class="text-sm text-gray-500">
                        ${new Date(order.created_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
                <div class="text-right">
                    ${getStatusBadge(order.payment_status)}
                    <p class="text-lg font-bold text-gray-900 mt-2">
                        ${formatCurrency(order.total_amount)}
                    </p>
                </div>
            </div>

            ${order.items && order.items.length > 0 ? `
                <div class="mb-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Items:</h4>
                    <div class="space-y-1">
                        ${order.items.map(item => `
                            <div class="flex justify-between text-sm text-gray-600">
                                <span>${item.product_name} x ${item.quantity}</span>
                                <span>${formatCurrency(item.subtotal)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="flex gap-2">
                ${order.payment_link ? `
                    <button onclick="copyToClipboard('${order.payment_link}')" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors">
                        📋 Copy Payment Link
                    </button>
                    <button onclick="window.open('${order.payment_link}', '_blank')" class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">
                        Open Payment Page
                    </button>
                ` : ''}
                <button onclick="refreshOrderStatus('${order.id}')" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
                    🔄 Refresh Status
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `<div class="space-y-4">${ordersHTML}</div>`;
}

function getStatusBadge(status) {
    const statusConfig = {
        pending: { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', text: 'Pending' },
        paid: { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Paid' },
        failed: { color: 'bg-red-100 text-red-800', icon: '❌', text: 'Failed' },
        cancelled: { color: 'bg-gray-100 text-gray-800', icon: '❌', text: 'Cancelled' },
        challenge: { color: 'bg-orange-100 text-orange-800', icon: '⚠️', text: 'Challenge' },
        refunded: { color: 'bg-purple-100 text-purple-800', icon: '↩️', text: 'Refunded' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}">
            ${config.icon} ${config.text}
        </span>
    `;
}

// Utility Functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Payment link copied to clipboard!');
    }).catch(() => {
        showNotification('Failed to copy to clipboard', 'error');
    });
}

async function refreshOrderStatus(orderId) {
    try {
        showNotification('Checking payment status...', 'info');
        const result = await checkTransactionStatus(orderId);
        
        if (result.success) {
            showNotification('Status updated successfully!');
            loadOrders(); // Refresh the orders list
        } else {
            showNotification('Failed to check status', 'error');
        }
    } catch (error) {
        showNotification('Error checking status', 'error');
    }
}

// Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Midtrans
    initializeMidtrans();
    
    // Tab switching
    document.getElementById('createTab').addEventListener('click', function() {
        document.getElementById('createOrderSection').style.display = 'block';
        document.getElementById('ordersSection').style.display = 'none';
        
        // Update tab styles
        document.getElementById('createTab').className = 'tab-btn px-6 py-2 rounded-md font-medium transition-all duration-200 bg-green-500 text-white shadow-md';
        document.getElementById('ordersTab').className = 'tab-btn px-6 py-2 rounded-md font-medium transition-all duration-200 text-gray-600 hover:text-gray-900';
    });

    document.getElementById('ordersTab').addEventListener('click', function() {
        document.getElementById('createOrderSection').style.display = 'none';
        document.getElementById('ordersSection').style.display = 'block';
        
        // Update tab styles
        document.getElementById('createTab').className = 'tab-btn px-6 py-2 rounded-md font-medium transition-all duration-200 text-gray-600 hover:text-gray-900';
        document.getElementById('ordersTab').className = 'tab-btn px-6 py-2 rounded-md font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        
        // Load orders when tab is opened
        loadOrders();
    });

    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', addItem);

    // Form submission
    document.getElementById('orderForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Order...';
        
        try {
            // Collect form data
            const formData = {
                customer_name: document.getElementById('customerName').value,
                customer_email: document.getElementById('customerEmail').value,
                customer_phone: document.getElementById('customerPhone').value,
                items: []
            };

            // Collect items
            document.querySelectorAll('.item-row').forEach(row => {
                const name = row.querySelector('.item-name').value;
                const price = parseFloat(row.querySelector('.item-price').value) || 0;
                const quantity = parseInt(row.querySelector('.item-quantity').value) || 1;
                
                if (name && price > 0) {
                    formData.items.push({ name, price, quantity });
                }
            });

            if (formData.items.length === 0) {
                throw new Error('Please add at least one item');
            }

            // Create order
            const result = await createOrder(formData);
            
            if (result.success) {
                showNotification('Order created successfully!');
                
                // Reset form
                document.getElementById('orderForm').reset();
                document.getElementById('totalAmount').textContent = formatCurrency(0);
                
                // Show payment options
                if (result.snap_token) {
                    const shouldOpenPayment = confirm(
                        `Order created successfully!\n\nOrder ID: ${result.order_id}\nTotal: ${formatCurrency(result.total_amount)}\n\nWould you like to open the payment page?`
                    );
                    
                    if (shouldOpenPayment) {
                        openMidtransPayment(result.snap_token, result.order_id);
                    }
                } else if (result.payment_link) {
                    const shouldOpenLink = confirm(
                        `Order created successfully!\n\nOrder ID: ${result.order_id}\nTotal: ${formatCurrency(result.total_amount)}\n\nWould you like to open the payment page?`
                    );
                    
                    if (shouldOpenLink) {
                        window.open(result.payment_link, '_blank');
                    }
                }
            } else {
                throw new Error(result.error || 'Failed to create order');
            }
            
        } catch (error) {
            console.error('Order creation error:', error);
            showNotification(error.message || 'Failed to create order', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // Add event listeners for initial item
    document.querySelector('.item-price').addEventListener('input', calculateTotal);
    document.querySelector('.item-quantity').addEventListener('input', calculateTotal);
    
    updateRemoveButtons();
    calculateTotal();
});

