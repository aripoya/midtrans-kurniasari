// Script untuk test webhook Midtrans secara manual
// Cara pakai: node test-webhook.js ORDER-xxx

const crypto = require('crypto');

const ORDER_ID = process.argv[2] || 'ORDER-1763176315253-G3TP3';
const WEBHOOK_URL = 'https://order-management-app-production.wahwooh.workers.dev/api/webhook/midtrans';
const SERVER_KEY = 'SB-Mid-server-xxxxx'; // Ganti dengan server key asli

// Simulasi payment notification dari Midtrans untuk Virtual Account
const createVANotification = (orderId, grossAmount = '100000') => {
  const statusCode = '200';
  const transactionStatus = 'settlement';
  
  // Generate signature
  const signatureKey = orderId + statusCode + grossAmount + SERVER_KEY;
  const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');
  
  return {
    transaction_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    transaction_status: transactionStatus,
    transaction_id: `va-${Date.now()}`,
    status_message: 'midtrans payment notification',
    status_code: statusCode,
    signature_key: signature,
    payment_type: 'bank_transfer',
    order_id: orderId,
    merchant_id: 'G530664620',
    gross_amount: grossAmount,
    fraud_status: 'accept',
    currency: 'IDR',
    permata_va_number: '1234567890123456',
    va_numbers: [
      {
        va_number: '1234567890123456',
        bank: 'bca'
      }
    ]
  };
};

// Simulasi payment notification untuk QRIS
const createQRISNotification = (orderId, grossAmount = '100000') => {
  const statusCode = '200';
  const transactionStatus = 'settlement';
  
  // Generate signature
  const signatureKey = orderId + statusCode + grossAmount + SERVER_KEY;
  const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');
  
  return {
    transaction_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    transaction_status: transactionStatus,
    transaction_id: `qris-${Date.now()}`,
    status_message: 'midtrans payment notification',
    status_code: statusCode,
    signature_key: signature,
    payment_type: 'qris',
    order_id: orderId,
    merchant_id: 'G530664620',
    gross_amount: grossAmount,
    fraud_status: 'accept',
    currency: 'IDR',
    acquirer: 'gopay'
  };
};

async function testWebhook(paymentType = 'va') {
  const notification = paymentType === 'qris' 
    ? createQRISNotification(ORDER_ID)
    : createVANotification(ORDER_ID);
  
  console.log('🚀 Sending webhook notification:');
  console.log(JSON.stringify(notification, null, 2));
  console.log('\n📡 Webhook URL:', WEBHOOK_URL);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification)
    });
    
    const responseText = await response.text();
    
    console.log('\n✅ Response status:', response.status);
    console.log('📄 Response body:', responseText);
    
    if (response.status === 200) {
      console.log('\n🎉 Webhook berhasil! Cek order status di database.');
    } else {
      console.log('\n❌ Webhook gagal! Cek error di atas.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run test
const paymentType = process.argv[3] || 'va'; // va atau qris
console.log(`\n🧪 Testing ${paymentType.toUpperCase()} webhook for order: ${ORDER_ID}\n`);
testWebhook(paymentType);
