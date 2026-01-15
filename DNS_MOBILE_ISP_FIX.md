# Solusi DNS Issue untuk Mobile ISP

## 🔴 Masalah

**Gejala:**
- ✅ ISP tertentu (WiFi/Fiber) bisa akses aplikasi normal
- ❌ Mobile data (Telkomsel, XL, Indosat, dll) tidak bisa load data
- 🎯 Root cause: DNS ISP mobile tidak bisa resolve domain `wahwooh.workers.dev`

**Error yang muncul:**
- `Failed to fetch`
- `NetworkError`
- `DNS resolution timeout`
- Data tidak muncul di dashboard

---

## ✅ Solusi yang Sudah Diimplementasikan

### 1. **DNS Prefetch & Preconnect**

File: `midtrans-frontend/index.html`

```html
<!-- DNS Prefetch untuk mengatasi masalah DNS ISP mobile -->
<link rel="dns-prefetch" href="//order-management-app-production.wahwooh.workers.dev" />
<link rel="preconnect" href="https://order-management-app-production.wahwooh.workers.dev" crossorigin />

<!-- Cloudflare DNS untuk fallback -->
<meta http-equiv="x-dns-prefetch-control" content="on" />
```

**Benefit:**
- Browser akan resolve DNS lebih awal
- Mengurangi latency saat request pertama
- Membantu ISP mobile yang lambat resolve DNS

### 2. **Retry Mechanism dengan Exponential Backoff**

File: `midtrans-frontend/src/api/config.ts`

```typescript
// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,   // 1 second
  MAX_DELAY: 5000,       // 5 seconds
  BACKOFF_MULTIPLIER: 2, // Exponential backoff
};

// Fetch with retry function
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> => {
  // Auto retry on DNS/network errors
  // Exponential backoff: 1s, 2s, 4s
};
```

**Benefit:**
- Auto retry jika DNS timeout
- Exponential backoff mencegah overload
- Max 3 retries untuk balance antara UX dan performance

### 3. **DNS Timeout Configuration**

```typescript
export const TIMEOUTS = {
  DEFAULT: 30000,
  DNS_TIMEOUT: 10000,    // 10 seconds for DNS resolution
};
```

**Benefit:**
- Timeout lebih cepat untuk DNS issues
- User tidak menunggu terlalu lama
- Trigger retry lebih cepat

---

## 📋 Cara Menggunakan

### Untuk Developer

Gunakan `fetchWithRetry` instead of `fetch`:

```typescript
import { fetchWithRetry } from '@/api/config';

// Old way (no retry)
const response = await fetch(url, options);

// New way (with retry)
const response = await fetchWithRetry(url, options);
```

### Untuk User dengan Mobile Data

**Jika masih ada masalah, sarankan user untuk:**

1. **Gunakan DNS Publik** (Settings → WiFi/Network → Advanced → DNS):
   - Cloudflare: `1.1.1.1` dan `1.0.0.1`
   - Google: `8.8.8.8` dan `8.8.4.4`

2. **Clear DNS Cache** di browser:
   - Chrome: `chrome://net-internals/#dns` → Clear host cache
   - Firefox: Restart browser
   - Safari: Clear browsing data

3. **Gunakan VPN** jika DNS ISP benar-benar bermasalah

---

## 🎯 Solusi Permanen (Recommended)

### Custom Domain

Ganti dari `wahwooh.workers.dev` ke custom domain seperti `api.kurniasari.co.id`:

**Keuntungan:**
- ✅ Lebih reliable di semua ISP
- ✅ Tidak di-block provider
- ✅ Lebih professional
- ✅ Bisa pakai DNS sendiri

**Setup di Cloudflare Workers:**

1. **Tambahkan custom domain di Cloudflare Dashboard:**
   - Workers & Pages → order-management-app-production
   - Settings → Domains & Routes
   - Add custom domain: `api.kurniasari.co.id`

2. **Update DNS di domain registrar:**
   ```
   Type: CNAME
   Name: api
   Value: order-management-app-production.wahwooh.workers.dev
   ```

3. **Update API_URL di frontend:**
   ```typescript
   export const API_URL = 'https://api.kurniasari.co.id';
   ```

---

## 📊 Testing

### Test DNS Resolution

```bash
# Test dari terminal
nslookup order-management-app-production.wahwooh.workers.dev

# Test dengan different DNS
nslookup order-management-app-production.wahwooh.workers.dev 1.1.1.1
nslookup order-management-app-production.wahwooh.workers.dev 8.8.8.8
```

### Test dari Browser Console

```javascript
// Test fetch dengan retry
import { fetchWithRetry } from './api/config';

fetchWithRetry('https://order-management-app-production.wahwooh.workers.dev/api/config')
  .then(res => res.json())
  .then(data => console.log('✅ Success:', data))
  .catch(err => console.error('❌ Error:', err));
```

---

## 🔧 Monitoring

### Check Logs

Browser console akan menampilkan:
```
DNS/Network error, retrying in 1000ms (attempt 1/3)...
DNS/Network error, retrying in 2000ms (attempt 2/3)...
DNS/Network error, retrying in 4000ms (attempt 3/3)...
```

### Success Indicators

- ✅ No retry messages = DNS working fine
- ✅ Retry 1-2 times then success = DNS slow but working
- ❌ All retries failed = DNS completely blocked

---

## 📞 Support

Jika masalah masih berlanjut setelah implementasi ini:

1. **Check ISP:** Apakah ISP mobile tertentu yang bermasalah?
2. **Check Region:** Apakah hanya region tertentu?
3. **Consider Custom Domain:** Solusi paling reliable

**Contact:**
- Developer: Check logs di browser console
- User: Gunakan DNS publik atau VPN sebagai workaround
