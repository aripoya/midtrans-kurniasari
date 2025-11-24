# Debug Guide: Legacy Orders Items Not Showing

## Deployed Version
**Version**: `7d876500-6e6f-42c9-af59-8ab7791893c3`  
**Status**: ✅ Deployed with comprehensive logging

---

## Steps to Debug

### 1. Refresh Order Detail Page
Refresh halaman order detail yang bermasalah (ORDER-1763989823397-JH5HQ):
```
https://nota.kurniasari.co.id/admin/orders/ORDER-1763989823397-JH5HQ
```

### 2. Check Cloudflare Workers Logs

#### Via Cloudflare Dashboard:
1. Go to: https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **order-management-app-production**
3. Click **Logs** tab
4. Look for logs with prefix `[getOrderById]`

#### What to Look For:

```log
# Expected log sequence for ORDER-1763989823397-JH5HQ:

[getOrderById] ORDER-1763989823397-JH5HQ - Found X items in order_items table
↓
[getOrderById] ORDER-1763989823397-JH5HQ - Attempting Midtrans extraction
↓
[getOrderById] ORDER-1763989823397-JH5HQ - payment_response type: string, parsed: true
↓
[getOrderById] ORDER-1763989823397-JH5HQ - payment_response has item_details: true
↓
[getOrderById] ✅ Extracting N items from Midtrans payment_response
↓
[getOrderById] ORDER-1763989823397-JH5HQ - Items after extraction: N items
↓
[getOrderById] ✅ ORDER-1763989823397-JH5HQ - Final response: N items, X images
```

---

## Possible Scenarios

### Scenario 1: payment_response doesn't have item_details
```log
[getOrderById] ORDER-XXX - payment_response exists but no item_details array found
[getOrderById] ORDER-XXX - payment_response keys: [...list of keys...]
```

**Solution**: Check what keys exist in payment_response. Midtrans might use different field names.

### Scenario 2: payment_response is malformed
```log
[getOrderById] ❌ Failed to extract items from payment_response for order ORDER-XXX: [error message]
```

**Solution**: Check payment_response format in database.

### Scenario 3: Items exist in order_items table
```log
[getOrderById] ORDER-XXX - Found 3 items in order_items table
[getOrderById] ORDER-XXX - Skip Midtrans extraction (items: 3, payment_response: true)
```

**Action**: Items should display. If not, check frontend.

---

## Direct API Test

Test the API endpoint directly to see raw response:

```bash
# Get admin token first (from browser localStorage)
TOKEN="your-admin-token"

# Call API
curl -H "Authorization: Bearer $TOKEN" \
  https://order-management-app-production.wahwooh.workers.dev/api/orders/ORDER-1763989823397-JH5HQ \
  | jq '.data.items'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "ORDER-1763989823397-JH5HQ",
    "items": [
      {
        "id": 1,
        "product_name": "Produk Name",
        "product_price": 10000,
        "quantity": 1,
        "subtotal": 10000,
        "price": 10000
      }
    ]
  }
}
```

**If items is empty**:
```json
{
  "success": true,
  "data": {
    "id": "ORDER-1763989823397-JH5HQ",
    "items": []  // ❌ Empty - Check logs!
  }
}
```

---

## Check Database Directly

### Via Wrangler:
```bash
cd /Users/ipoy/Documents/Kurniasari\ web/Kurniasari-Midtrans/midtrans-kurniasari

# Check order_items table
wrangler d1 execute order-management-prod --remote \
  --command "SELECT * FROM order_items WHERE order_id = 'ORDER-1763989823397-JH5HQ'"

# Check payment_response
wrangler d1 execute order-management-prod --remote \
  --command "SELECT id, payment_response FROM orders WHERE id = 'ORDER-1763989823397-JH5HQ'"
```

### Via Cloudflare Dashboard:
1. Go to **D1 Databases** → **order-management-prod**
2. Click **Console** tab
3. Run queries:

```sql
-- Check order_items
SELECT * FROM order_items WHERE order_id = 'ORDER-1763989823397-JH5HQ';

-- Check payment_response structure
SELECT 
  id,
  LENGTH(payment_response) as response_length,
  SUBSTR(payment_response, 1, 200) as response_preview
FROM orders 
WHERE id = 'ORDER-1763989823397-JH5HQ';
```

---

## Frontend Debugging

### Check Browser Console:
Look for logs in browser console (F12):

```javascript
// Check what data arrived
Order data loaded: {items: [...]}

// Check items structure
console.log('Items:', order.items);
console.log('Items length:', order.items?.length);
console.log('First item:', order.items?.[0]);
```

### Check Network Tab:
1. Open DevTools (F12) → **Network** tab
2. Filter by `/api/orders/ORDER-`
3. Click the request
4. Check **Response** tab
5. Look for `data.items` array

---

## Common Issues & Solutions

### Issue 1: payment_response has different structure
**Symptom**: Logs show "no item_details array found"

**Investigation**:
```sql
SELECT json_extract(payment_response, '$.item_details') 
FROM orders 
WHERE id = 'ORDER-1763989823397-JH5HQ';
```

**Possible Solutions**:
- Check if Midtrans uses different field name (e.g., `items`, `order_items`, `transaction_details`)
- Update extraction code to handle different formats

### Issue 2: payment_response is null or empty
**Symptom**: Logs show "Skip Midtrans extraction (payment_response: false)"

**Solution**: Order was created without proper Midtrans integration. No way to recover items unless manually added.

### Issue 3: Items arrive at frontend but don't display
**Symptom**: API returns items, but UI shows "Detail item tidak tersedia"

**Check**:
```javascript
// In browser console
console.log('Order items:', order.items);
console.log('Items length:', order.items?.length);
console.log('Is array?', Array.isArray(order.items));
```

**Solution**: Check frontend condition `order.items && order.items.length > 0`

---

## Logging Added

### Backend (orders.js):
- ✅ Item count from database
- ✅ Fallback extraction attempt detection
- ✅ payment_response parsing status
- ✅ item_details existence check
- ✅ Extraction success with item count
- ✅ Final response summary

### Purpose:
Track complete flow from database → extraction → response to pinpoint exact failure point.

---

## Next Steps

1. **Refresh page** → Trigger new API call with logging
2. **Check Cloudflare logs** → See what's happening in backend
3. **Report findings** → Share logs to diagnose issue
4. **Apply fix** → Based on log analysis

---

## Report Template

When reporting issue, include:

```
**Order ID**: ORDER-1763989823397-JH5HQ
**Problem**: Items not showing

**Cloudflare Logs**:
[Copy relevant logs here]

**API Response** (items section):
[Copy from Network tab]

**Database Check**:
- order_items count: X
- payment_response length: X bytes
- payment_response has item_details: yes/no
```

---

**Deployment**: Version `7d876500-6e6f-42c9-af59-8ab7791893c3`  
**Status**: 🔍 Ready for debugging with comprehensive logging
