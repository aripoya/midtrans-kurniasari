# 🔐 Midtrans Production Credentials Setup

## Quick Setup Guide

### 1. Get Your Midtrans Production Credentials

1. **Login to Midtrans Dashboard**
   - Go to: https://dashboard.midtrans.com
   - Login with your production account
   - **Important**: Switch to "Production" environment (top-right toggle)

2. **Get API Keys**
   - Navigate to: **Settings** → **Access Keys**
   - Copy these values:
     - **Server Key**: `Mid-server-xxxxxxxxxxxxxxxxxx`
     - **Client Key**: `Mid-client-xxxxxxxxxxxxxxxxxx`

3. **Configure Webhook**
   - Go to: **Settings** → **Configuration**
   - Set **Payment Notification URL**: 
     ```
     https://order-management-app.your-subdomain.workers.dev/api/webhook/midtrans
     ```

### 2. Set Environment Variables

Run these commands in your terminal:

```bash
# Navigate to project directory
cd /path/to/order-management-app

# Set Midtrans Server Key (keep this secret!)
wrangler secret put MIDTRANS_SERVER_KEY --env production
# When prompted, enter: Mid-server-your-actual-server-key

# Set Midtrans Client Key
wrangler secret put MIDTRANS_CLIENT_KEY --env production  
# When prompted, enter: Mid-client-your-actual-client-key

# Set webhook secret for security
wrangler secret put WEBHOOK_SECRET --env production
# When prompted, enter a random secure string (save this!)
```

### 3. Update Frontend Configuration

Edit `order-management-frontend/js/app.js`:

```javascript
const CONFIG = {
    // Replace with your deployed worker URL
    API_BASE_URL: 'https://order-management-app.your-subdomain.workers.dev',
    
    // Replace with your actual production client key
    MIDTRANS_CLIENT_KEY: 'Mid-client-your-actual-client-key',
    
    // Set to true for production
    MIDTRANS_IS_PRODUCTION: true,
    
    // Other settings...
};
```

### 4. Deploy

```bash
# Deploy backend
wrangler deploy --env production

# Deploy frontend (using your preferred method)
# The frontend is ready to deploy to any static hosting service
```

### 5. Test

1. Create a small test order (e.g., Rp 10,000)
2. Complete payment using real payment method
3. Verify order status updates correctly

## 🔒 Security Notes

- **Never commit** API keys to version control
- **Server Key** must be kept secret (backend only)
- **Client Key** can be used in frontend (but still sensitive)
- **Webhook Secret** should be a random, secure string
- Always use **HTTPS** in production

## 📞 Need Help?

- **Midtrans Documentation**: https://docs.midtrans.com
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers
- **Check logs**: `wrangler tail --env production`

---

**⚠️ Important**: Test thoroughly with small amounts before processing real payments!

