# Legacy Orders Items Extraction from Midtrans

## Problem
Pesanan lama (legacy orders) hanya memiliki:
- ✅ Total nilai pesanan
- ❌ Detail items tidak tersimpan di tabel `order_items`
- ℹ️ Detail items tersimpan di Midtrans `payment_response` JSON

## Solution
Implementasi fallback extraction untuk mengambil detail items dari `payment_response.item_details` Midtrans.

---

## Implementation

### 1. Updated Functions

#### `getOrderById()` - Get Single Order Detail
```javascript
// Fallback 2: Extract items from Midtrans payment_response for old orders
if ((!items || items.length === 0) && order.payment_response) {
  try {
    const paymentData = JSON.parse(order.payment_response);
    if (paymentData.item_details && Array.isArray(paymentData.item_details)) {
      items = paymentData.item_details.map((item, idx) => ({
        id: item.id || idx + 1,
        order_id: orderId,
        product_name: item.name || 'Produk',
        product_price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        subtotal: Number(item.price || 0) * Number(item.quantity || 1),
        price: Number(item.price || 0),
      }));
    }
  } catch (err) {
    console.error('Failed to extract items from payment_response');
  }
}
```

#### `getOrders()` - Get All Orders List
```javascript
// Fallback: Extract items from Midtrans payment_response if order_items empty
if ((!items || items.length === 0) && order.payment_response) {
  try {
    const paymentData = JSON.parse(order.payment_response);
    if (paymentData.item_details && Array.isArray(paymentData.item_details)) {
      items = paymentData.item_details.map((item, idx) => ({
        id: item.id || idx + 1,
        order_id: order.id,
        product_name: item.name || 'Produk',
        product_price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        subtotal: Number(item.price || 0) * Number(item.quantity || 1),
      }));
    }
  } catch (err) {
    console.error('Failed to extract items from payment_response');
  }
}
```

---

## Midtrans payment_response Structure

```json
{
  "status_code": "201",
  "status_message": "Success, transaction is found",
  "transaction_id": "6162c632-bd31-4cfd-88a0-6d39abe509b9",
  "order_id": "ORDER-1756712258743-WE0G9",
  "gross_amount": "456.00",
  "payment_type": "qris",
  "transaction_time": "2024-12-31 08:30:58",
  "transaction_status": "pending",
  "item_details": [
    {
      "id": "123",
      "name": "api Bonbin",
      "price": 456,
      "quantity": 1
    }
  ],
  "customer_details": {
    "first_name": "api wibowo",
    "email": "aripoya9@gmail.com",
    "phone": "087880285678"
  }
}
```

---

## Behavior

### Data Source Priority (Order of Fallback)

1. **Primary**: `order_items` table (untuk pesanan baru)
2. **Fallback 1**: `order.items` JSON column (legacy format 1)
3. **Fallback 2**: `payment_response.item_details` (legacy format 2 - from Midtrans)

### Example Legacy Order

**Before Fix**:
```json
{
  "id": "ORDER-1234567890",
  "total_amount": 15000,
  "items": []  // Empty!
}
```

**After Fix**:
```json
{
  "id": "ORDER-1234567890",
  "total_amount": 15000,
  "items": [
    {
      "id": "prod_123",
      "product_name": "Kue Lapis",
      "product_price": 5000,
      "quantity": 3,
      "subtotal": 15000
    }
  ]  // Extracted from payment_response!
}
```

---

## Benefits

✅ **Backward Compatibility**: Legacy orders sekarang menampilkan detail items  
✅ **No Data Loss**: Data tidak hilang, hanya perlu extraction  
✅ **Automatic**: Tidak perlu migration manual  
✅ **Transparent**: Frontend tidak perlu perubahan  

---

## Testing

### Test Legacy Order Detail
```bash
curl https://order-management-app-production.wahwooh.workers.dev/api/orders/ORDER-XXXX
```

### Expected Result
```json
{
  "success": true,
  "data": {
    "id": "ORDER-XXXX",
    "total_amount": 15000,
    "items": [
      {
        "product_name": "Kue Lapis",
        "product_price": 5000,
        "quantity": 3,
        "subtotal": 15000
      }
    ],
    "payment_status": "settlement"
  }
}
```

---

## Deployment

**Status**: ✅ DEPLOYED  
**Version**: `297df277-f906-4e4b-8f65-14450cc35c23`  
**URL**: https://order-management-app-production.wahwooh.workers.dev  
**Date**: November 25, 2025  

---

## Notes

- Extraction hanya terjadi jika `order_items` table kosong
- Tidak mengubah database, hanya runtime extraction
- Logging ditambahkan untuk debugging
- Error handling memastikan fallback tidak break API

---

## Future Improvements

### Optional: Backfill order_items Table
Jika ingin permanently store items di database (opsional):

```javascript
// Migration script to backfill order_items from payment_response
async function backfillOrderItems(env) {
  const orders = await env.DB.prepare(
    'SELECT id, payment_response FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)'
  ).all();
  
  for (const order of orders.results) {
    const paymentData = JSON.parse(order.payment_response);
    if (paymentData.item_details) {
      for (const item of paymentData.item_details) {
        await env.DB.prepare(
          'INSERT INTO order_items (order_id, product_name, product_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          order.id,
          item.name,
          item.price,
          item.quantity,
          item.price * item.quantity
        ).run();
      }
    }
  }
}
```

Namun ini tidak diperlukan karena extraction otomatis sudah berfungsi dengan baik.
