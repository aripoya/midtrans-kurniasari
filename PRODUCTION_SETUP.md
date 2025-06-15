# 🚀 Production Deployment Guide - Midtrans Integration

This guide will help you deploy the Order Management System to production with proper Midtrans credentials and security configuration.

## 📋 Prerequisites

Before starting, ensure you have:

1. **Cloudflare Account** with Workers enabled
2. **Midtrans Account** (production credentials)
3. **Wrangler CLI** installed and authenticated
4. **Domain** (optional, for custom domain)

## 🔐 Step 1: Get Midtrans Production Credentials

### 1.1 Login to Midtrans Dashboard
- Go to https://dashboard.midtrans.com
- Login with your production account
- Switch to **Production** environment

### 1.2 Get API Keys
Navigate to **Settings** → **Access Keys**:
- **Server Key**: `Mid-server-xxxxxxxxxx` (keep this secret!)
- **Client Key**: `Mid-client-xxxxxxxxxx` (safe for frontend)

### 1.3 Configure Webhook URL
In **Settings** → **Configuration**:
- **Payment Notification URL**: `https://your-worker-domain.workers.dev/api/webhook/midtrans`
- **Finish Redirect URL**: `https://your-frontend-domain.com/payment/finish`
- **Error Redirect URL**: `https://your-frontend-domain.com/payment/error`
- **Pending Redirect URL**: `https://your-frontend-domain.com/payment/pending`

## 🗄️ Step 2: Setup Database

### 2.1 Create D1 Database
```bash
wrangler d1 create order-management-prod
```

### 2.2 Update wrangler.toml
Replace `your-d1-database-id` with the ID from step 2.1:
```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "order-management-prod"
database_id = "your-actual-database-id-here"
```

### 2.3 Run Database Migrations
```bash
wrangler d1 execute order-management-prod --file=schema.sql --env production
```

## 🔧 Step 3: Configure Environment Variables

### 3.1 Set Midtrans Credentials
```bash
# Set server key (sensitive - stored as secret)
wrangler secret put MIDTRANS_SERVER_KEY --env production
# Enter your production server key when prompted

# Set client key (sensitive - stored as secret)
wrangler secret put MIDTRANS_CLIENT_KEY --env production
# Enter your production client key when prompted

# Set webhook secret for signature verification
wrangler secret put WEBHOOK_SECRET --env production
# Enter a random secure string (e.g., generated password)
```

### 3.2 Optional: Email Configuration
```bash
wrangler secret put SMTP_HOST --env production
wrangler secret put SMTP_PORT --env production
wrangler secret put SMTP_USER --env production
wrangler secret put SMTP_PASS --env production
```

### 3.3 Verify Configuration
```bash
wrangler secret list --env production
```

## 🚀 Step 4: Deploy Backend

### 4.1 Deploy to Production
```bash
wrangler deploy --env production
```

### 4.2 Test API Endpoints
```bash
# Test health check
curl https://order-management-app.your-subdomain.workers.dev/

# Test configuration
curl https://order-management-app.your-subdomain.workers.dev/api/config
```

## 🌐 Step 5: Deploy Frontend

### 5.1 Update Frontend Configuration
Edit `order-management-frontend/js/app.js`:

```javascript
const CONFIG = {
    // Update with your actual worker URL
    API_BASE_URL: 'https://order-management-app.your-subdomain.workers.dev',
    
    // Use your production client key
    MIDTRANS_CLIENT_KEY: 'Mid-client-your-production-key',
    
    // Set to true for production
    MIDTRANS_IS_PRODUCTION: true,
    
    // Update with your domain
    PAYMENT_CALLBACKS: {
        finish: 'https://your-domain.com/payment/finish',
        error: 'https://your-domain.com/payment/error',
        pending: 'https://your-domain.com/payment/pending'
    }
};
```

### 5.2 Deploy Frontend
```bash
# From the project root
cd order-management-frontend
# Deploy using your preferred method (Cloudflare Pages, Netlify, etc.)
```

## 🔒 Step 6: Security Configuration

### 6.1 Environment Variables Checklist
- ✅ `MIDTRANS_SERVER_KEY` - Set as secret
- ✅ `MIDTRANS_CLIENT_KEY` - Set as secret  
- ✅ `MIDTRANS_IS_PRODUCTION` - Set to "true" in wrangler.toml
- ✅ `WEBHOOK_SECRET` - Set as secret
- ✅ `APP_URL` - Update in wrangler.toml

### 6.2 Security Best Practices
- **Never commit** API keys to version control
- **Use HTTPS** for all endpoints
- **Verify webhook signatures** (implemented in webhook handler)
- **Validate all inputs** (implemented in API handlers)
- **Monitor logs** regularly for suspicious activity

## 🧪 Step 7: Testing

### 7.1 Test Order Creation
1. Open your frontend application
2. Create a test order with small amount (e.g., Rp 10,000)
3. Complete payment using test credit card
4. Verify order status updates correctly

### 7.2 Test Webhook
1. Create an order
2. Complete payment
3. Check worker logs: `wrangler tail --env production`
4. Verify webhook received and processed correctly

### 7.3 Production Test Cards
Use Midtrans test cards in production sandbox:
- **Success**: 4811 1111 1111 1114
- **Failure**: 4911 1111 1111 1113
- **Challenge**: 4411 1111 1111 1118

## 📊 Step 8: Monitoring

### 8.1 View Logs
```bash
# Real-time logs
wrangler tail --env production

# View metrics in Cloudflare dashboard
# Go to Workers → order-management-app → Metrics
```

### 8.2 Database Monitoring
```bash
# Check database size and usage
wrangler d1 info order-management-prod
```

## 🔄 Step 9: Updates and Maintenance

### 9.1 Deploy Updates
```bash
# Deploy backend updates
wrangler deploy --env production

# Deploy frontend updates
# Re-deploy your frontend application
```

### 9.2 Database Migrations
```bash
# Run new migrations
wrangler d1 execute order-management-prod --file=new-migration.sql --env production
```

## 🆘 Troubleshooting

### Common Issues

**1. "Midtrans credentials not configured"**
- Verify secrets are set: `wrangler secret list --env production`
- Re-set credentials if needed

**2. "Database not configured"**
- Check wrangler.toml has correct database ID
- Verify database exists: `wrangler d1 list`

**3. "Payment webhook not working"**
- Check webhook URL in Midtrans dashboard
- Verify webhook signature verification
- Check worker logs for errors

**4. "CORS errors"**
- Verify API_BASE_URL in frontend config
- Check CORS headers in worker responses

### Debug Commands
```bash
# View environment variables
wrangler secret list --env production

# Check database
wrangler d1 execute order-management-prod --command="SELECT * FROM orders LIMIT 5" --env production

# View real-time logs
wrangler tail --env production

# Test API endpoints
curl -X POST https://your-worker.workers.dev/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","customer_email":"test@example.com","items":[{"name":"Test Product","price":10000,"quantity":1}]}'
```

## 📞 Support

If you encounter issues:

1. **Check logs** first: `wrangler tail --env production`
2. **Verify configuration** using the debug commands above
3. **Test with small amounts** before going live
4. **Contact Midtrans support** for payment-related issues
5. **Check Cloudflare status** for infrastructure issues

## 🎉 Go Live Checklist

Before accepting real payments:

- ✅ All tests pass with production credentials
- ✅ Webhook URL configured in Midtrans dashboard
- ✅ SSL certificates valid on all domains
- ✅ Error handling tested
- ✅ Monitoring and logging configured
- ✅ Backup and recovery plan in place
- ✅ Team trained on troubleshooting procedures

---

**🚀 Your Order Management System is now ready for production!**

Remember to monitor the system closely during the first few days and have a rollback plan ready if needed.

