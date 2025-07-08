# Kurniasari Development Setup Documentation

## 📋 Current Development Configuration

### Environment Setup

| Component | Environment | URL/Location |
|-----------|-------------|--------------|
| **Frontend** | Local | http://localhost:5175 (Vite development server) |
| **Backend** | Production | https://order-management-app-production.wahwooh.workers.dev |
| **Database** | Production | Cloudflare D1 (order-management-prod) |

## ⚠️ IMPORTANT: DO NOT DELETE PRODUCTION DATA

The current development workflow relies on accessing production data from the local frontend. **DO NOT DELETE OR MODIFY PRODUCTION DATA** during development unless absolutely necessary.

## 🔄 Why This Setup?

This hybrid development approach allows:
1. Rapid frontend iteration and testing without affecting production
2. Testing against real production data
3. Debugging frontend issues with production backend responses
4. Development without needing to replicate the entire production database locally

## 🚀 Development Workflow

### Starting Development

1. Start the frontend server:
   ```bash
   cd midtrans-frontend
   npm run dev
   ```

2. Ensure `.env.development` points to production backend:
   ```
   VITE_API_BASE_URL=https://order-management-app-production.wahwooh.workers.dev
   ```

3. Access the application at `http://localhost:5175` (or whichever port Vite assigns)

### Testing With Production Data

Current production order IDs for testing:
- `ORDER-1751868494891-JZXWN` (Bakpia, Rp 2.000)
- `ORDER-1751868452350-UKMA1` (Total: Rp 24.000.000)

Access these orders via:
- `http://localhost:5175/orders/ORDER-1751868494891-JZXWN`
- `http://localhost:5175/orders/ORDER-1751868452350-UKMA1`

## 🔧 Switching Between Environments

### For Local-only Development (if needed)

To use a local backend instead:
1. Change `.env.development`:
   ```
   VITE_API_BASE_URL=http://localhost:8787
   ```

2. Start local backend:
   ```bash
   cd midtrans-backend
   npm run dev
   ```

## 🔍 Troubleshooting

### Common Issues

1. **404 Not Found errors**: Ensure you're using order IDs that exist in the environment your API is pointing to
2. **CORS errors**: These shouldn't occur with this setup, but if they do, check browser console for details
3. **API Structure Mismatches**: Production API returns `{success:true, data:{...}}` while local might use `{success:true, order:{...}}`

### API Response Structure

Current production API response format:
```json
{
  "success": true,
  "data": {
    "id": "ORDER-1751868494891-JZXWN",
    "customer_name": "ari wibowo",
    "customer_email": "aripoya09@gmail.com",
    ...
  }
}
```

## 📝 Historical Context

- The application was previously built on a platform called 'Manus'
- There may be legacy references to domains like `order-management-app-rs.dev` in older code
- The current production Worker name is `order-management-app-production` on Cloudflare

## 📊 Known Differences Between Environments

| Feature | Production | Local Development |
|---------|-----------|-------------------|
| Order IDs | Real customer orders | Test/sample orders |
| Database | Fully populated | May have limited data |
| Midtrans | Live integration | Test mode |

## 🛠️ Future Improvements

- Consider data synchronization tools to copy production data to local for safer development
- Implement better error handling for cross-environment issues
- Add environment indicators in the UI to clearly show which backend is being used
