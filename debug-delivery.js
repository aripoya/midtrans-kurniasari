// Script untuk mendiagnosis masalah sinkronisasi dashboard kurir
console.log('🔍 Debugging dashboard kurir...');

// Base URL untuk API
const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// Function untuk memanggil endpoint debug
async function checkDeliveryAssignments() {
  try {
    console.log('📡 Memanggil endpoint debugDeliveryAssignments...');
    
    const response = await fetch(`${API_BASE_URL}/api/debug/delivery-assignments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Mengambil token dari local storage
      }
    });
    
    const data = await response.json();
    console.log('✅ Hasil debug delivery assignments:', data);
    
    // Analisis hasil
    if (data.success) {
      console.log(`🧑‍💼 Deliverymen dalam database: ${data.deliverymen?.length || 0}`);
      console.log(`📦 Pesanan yang sudah di-assign: ${data.assignedOrders?.length || 0}`);
      
      if (data.deliverymen?.length === 0) {
        console.error('❌ MASALAH: Tidak ada akun deliveryman di database!');
      }
      
      if (data.assignedOrders?.length === 0) {
        console.error('❌ MASALAH: Tidak ada pesanan yang di-assign ke deliveryman!');
      }
      
      if (data.badAssignments?.length > 0) {
        console.error('❌ MASALAH: Ada pesanan yang salah assignment (username vs ID):', data.badAssignments);
      }
    } else {
      console.error('❌ Error:', data.message);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error saat debug:', error);
  }
}

// Function untuk membuat test assignment
async function createTestAssignments() {
  try {
    console.log('📡 Memanggil endpoint untuk membuat test assignments...');
    
    const response = await fetch(`${API_BASE_URL}/api/debug/assign-delivery-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ Hasil pembuatan test assignments:', data);
    return data;
  } catch (error) {
    console.error('❌ Error saat membuat test assignments:', error);
  }
}

// Export fungsi untuk digunakan di console browser
window.debugDelivery = {
  checkAssignments: checkDeliveryAssignments,
  createTestAssignments: createTestAssignments
};

console.log('🔧 Debug tools siap digunakan! Gunakan window.debugDelivery.checkAssignments() atau window.debugDelivery.createTestAssignments() di console browser');
