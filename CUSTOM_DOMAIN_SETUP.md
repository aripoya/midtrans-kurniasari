# Setup Custom Domain api.kurniasari.co.id untuk Cloudflare Workers

## 🎯 Tujuan

Mengganti domain dari `wahwooh.workers.dev` ke `api.kurniasari.co.id` untuk:
- ✅ Mengatasi masalah DNS di mobile ISP (Telkomsel, XL, Indosat)
- ✅ Lebih professional dan branded
- ✅ Lebih reliable di semua provider
- ✅ SSL certificate otomatis dari Cloudflare

---

## 📋 Langkah Setup di Cloudflare Dashboard

### **Step 1: Tambahkan Custom Domain di Workers**

1. **Login ke Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com
   - Login dengan akun Cloudflare Anda

2. **Pilih Domain**
   - Klik domain: `kurniasari.co.id`

3. **Buka Workers & Pages**
   - Menu kiri → **Workers & Pages**

4. **Pilih Worker Production**
   - Klik: `order-management-app-production`

5. **Buka Settings**
   - Klik tab **"Settings"**

6. **Tambah Custom Domain**
   - Scroll ke section **"Domains & Routes"**
   - Klik button **"Add Custom Domain"**
   - Masukkan: `api.kurniasari.co.id`
   - Klik **"Add Domain"**

7. **Tunggu Provisioning**
   - Cloudflare akan otomatis:
     - ✅ Buat DNS record CNAME
     - ✅ Setup SSL certificate (Let's Encrypt)
     - ✅ Route traffic ke worker
   - Proses: ~1-5 menit

8. **Verifikasi**
   - Status harus: **"Active"** dengan ikon hijau
   - SSL: **"Active"**

---

## 🔧 Perubahan Code yang Sudah Dilakukan

### **1. wrangler.toml**

```toml
[env.production]
name = "order-management-app-production"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Custom domain configuration
routes = [
  { pattern = "api.kurniasari.co.id/*", custom_domain = true }
]
```

### **2. Frontend API Config**

File: `midtrans-frontend/src/api/config.ts`

```typescript
// Before
return 'https://order-management-app-production.wahwooh.workers.dev';

// After
return 'https://api.kurniasari.co.id';
```

### **3. DNS Prefetch**

File: `midtrans-frontend/index.html`

```html
<!-- Before -->
<link rel="dns-prefetch" href="//order-management-app-production.wahwooh.workers.dev" />

<!-- After -->
<link rel="dns-prefetch" href="//api.kurniasari.co.id" />
```

### **4. Real-Time Sync Hook**

File: `midtrans-frontend/src/hooks/useRealTimeSync.ts`

```typescript
// Before
const API_BASE_URL = "https://order-management-app-production.wahwooh.workers.dev";

// After
const API_BASE_URL = "https://api.kurniasari.co.id";
```

---

## 🚀 Deploy

### **Deploy Backend (Workers)**

```bash
cd /Users/ipoy/Documents/Kurniasari\ web/Kurniasari-Midtrans/midtrans-kurniasari

# Deploy dengan custom domain configuration
npx wrangler deploy --env production
```

**Output yang diharapkan:**
```
✨ Success! Uploaded order-management-app-production
🌍 Custom domain: https://api.kurniasari.co.id
```

### **Deploy Frontend**

```bash
cd midtrans-frontend

# Build production
npm run build

# Deploy ke Cloudflare Pages
npx wrangler pages deploy dist --project-name=nota-kurniasari
```

---

## ✅ Testing

### **1. Test DNS Resolution**

```bash
# Test apakah DNS sudah resolve
nslookup api.kurniasari.co.id

# Expected output:
# Name:    api.kurniasari.co.id
# Address: [Cloudflare IP]
```

### **2. Test API Endpoint**

```bash
# Test dari terminal
curl https://api.kurniasari.co.id/api/config

# Expected: JSON response dengan config
```

### **3. Test dari Browser**

1. **Buka Developer Console** (F12)
2. **Jalankan:**
   ```javascript
   fetch('https://api.kurniasari.co.id/api/config')
     .then(res => res.json())
     .then(data => console.log('✅ Success:', data))
     .catch(err => console.error('❌ Error:', err));
   ```

### **4. Test dengan Mobile Data**

1. **Buka aplikasi** dengan mobile data (Telkomsel/XL/Indosat)
2. **Check Network tab** di browser console
3. **Verify:** Request ke `api.kurniasari.co.id` (bukan `wahwooh.workers.dev`)
4. **Check:** Data muncul tanpa error

---

## 🔍 Troubleshooting

### **Issue: DNS belum resolve**

**Solusi:**
- Tunggu 5-10 menit untuk DNS propagation
- Clear DNS cache:
  ```bash
  # macOS
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  
  # Windows
  ipconfig /flushdns
  ```

### **Issue: SSL Certificate error**

**Solusi:**
- Tunggu provisioning selesai (max 15 menit)
- Check di Cloudflare Dashboard → SSL/TLS → Edge Certificates
- Pastikan mode: **"Full (strict)"**

### **Issue: 404 Not Found**

**Solusi:**
- Pastikan worker sudah di-deploy dengan `--env production`
- Check routes di Cloudflare Dashboard
- Verify custom domain status: **"Active"**

### **Issue: CORS error**

**Solusi:**
- Custom domain otomatis inherit CORS settings dari worker
- Tidak perlu perubahan CORS configuration

---

## 📊 Monitoring

### **Check Custom Domain Status**

```bash
# Via wrangler CLI
npx wrangler deployments list --env production

# Check custom domain
npx wrangler deployments view [deployment-id] --env production
```

### **Check DNS Propagation**

- Global DNS checker: https://dnschecker.org
- Input: `api.kurniasari.co.id`
- Type: `CNAME`

---

## 🎉 Benefits Setelah Setup

### **Sebelum (wahwooh.workers.dev):**
- ❌ DNS timeout di mobile ISP
- ❌ Perlu retry mechanism
- ❌ User experience buruk
- ❌ Tidak professional

### **Setelah (api.kurniasari.co.id):**
- ✅ DNS resolve cepat di semua ISP
- ✅ Tidak perlu retry (tapi tetap ada sebagai fallback)
- ✅ User experience smooth
- ✅ Branded dan professional
- ✅ SSL certificate otomatis
- ✅ Cloudflare CDN global

---

## 📝 Checklist

Sebelum deploy, pastikan:

- [ ] Custom domain sudah ditambahkan di Cloudflare Dashboard
- [ ] Status custom domain: **"Active"**
- [ ] SSL certificate: **"Active"**
- [ ] `wrangler.toml` sudah updated
- [ ] Frontend `config.ts` sudah updated
- [ ] `index.html` DNS prefetch sudah updated
- [ ] `useRealTimeSync.ts` sudah updated
- [ ] Backend di-deploy dengan `--env production`
- [ ] Frontend di-build dan deploy
- [ ] Test dengan mobile data
- [ ] Monitor logs untuk errors

---

## 🔗 Resources

- **Cloudflare Workers Custom Domains:** https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- **DNS Checker:** https://dnschecker.org
- **SSL Test:** https://www.ssllabs.com/ssltest/

---

## 📞 Support

Jika ada masalah:
1. Check Cloudflare Dashboard untuk status
2. Check browser console untuk errors
3. Check wrangler logs: `npx wrangler tail --env production`
4. Verify DNS dengan `nslookup api.kurniasari.co.id`
