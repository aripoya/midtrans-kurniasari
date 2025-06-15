# Midtrans Integration Guide

## Environment Variables Required

For development (sandbox):
```
MIDTRANS_SERVER_KEY=SB-Mid-server-your_server_key_here
MIDTRANS_CLIENT_KEY=SB-Mid-client-your_client_key_here
MIDTRANS_IS_PRODUCTION=false
```

For production:
```
MIDTRANS_SERVER_KEY=your_production_server_key
MIDTRANS_CLIENT_KEY=your_production_client_key
MIDTRANS_IS_PRODUCTION=true
```

## How to Get Midtrans Keys

1. Register at https://dashboard.midtrans.com/
2. Go to Settings > Access Keys
3. Copy Server Key and Client Key
4. For testing, use Sandbox keys (prefixed with SB-)

## Webhook Configuration

Set webhook URL in Midtrans dashboard:
- Development: `https://your-worker-domain.workers.dev/api/webhook/midtrans`
- Production: `https://your-domain.com/api/webhook/midtrans`

## API Endpoints

### Create Order with Payment
```
POST /api/orders
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+6281234567890",
  "items": [
    {
      "name": "Product 1",
      "price": 100000,
      "quantity": 2
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "order_id": "ORDER-1234567890-ABC12",
  "total_amount": 200000,
  "payment_link": "https://app.sandbox.midtrans.com/snap/v2/vtweb/...",
  "snap_token": "token_here",
  "message": "Order created successfully with payment link"
}
```

### Get Orders
```
GET /api/orders?page=1&limit=10
```

### Get Order by ID
```
GET /api/orders/{order_id}
```

### Update Order Status
```
PUT /api/orders/{order_id}/status
Content-Type: application/json

{
  "status": "paid"
}
```

## Payment Flow

1. Customer fills order form
2. API creates order and generates Midtrans payment link
3. Customer redirected to Midtrans payment page
4. After payment, Midtrans sends webhook to update order status
5. Order status updated in database automatically

