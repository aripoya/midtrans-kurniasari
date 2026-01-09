# Fix Admin Session Tracking - Cara Menggunakan

## 🎯 Problem
Setelah update backend, **token lama tidak memiliki `sessionId`** sehingga session tracking tidak berfungsi.

## ✅ Solution
**LOGOUT dan LOGIN ULANG** untuk mendapatkan token baru dengan `sessionId`.

---

## 📝 Step-by-Step Instructions

### 1. **Logout dari Aplikasi**
   - Klik tombol **Logout** di aplikasi
   - Atau clear localStorage di browser console:
     ```javascript
     localStorage.clear();
     location.reload();
     ```

### 2. **Login Ulang**
   - Masuk ke https://nota.kurniasari.co.id
   - Login dengan username dan password Anda
   - Token baru akan memiliki `sessionId` di payload

### 3. **Verify Token (Optional)**
   Buka browser console dan check token:
   ```javascript
   // Get token
   const token = localStorage.getItem('token');
   
   // Decode JWT (base64)
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token payload:', payload);
   
   // Check if sessionId exists
   console.log('Has sessionId:', !!payload.sessionId);
   ```

### 4. **Buka Halaman Activity**
   - Navigasi ke: https://nota.kurniasari.co.id/admin/activity
   - Section "Admin Yang Sedang Online" akan menampilkan Anda
   - Selama Anda aktif menggunakan app, session akan ter-update

---

## 🔍 Technical Details

### Token Structure

**OLD TOKEN (sebelum fix):**
```json
{
  "id": "user_id",
  "username": "ana",
  "role": "admin",
  "outlet_id": null
}
```

**NEW TOKEN (setelah fix):**
```json
{
  "id": "user_id",
  "username": "ana",
  "role": "admin",
  "outlet_id": null,
  "sessionId": "session-1765310212238-1rerevvll"  ← ADDED
}
```

### How It Works

1. **Login** → System creates session in `admin_sessions` table
2. **Token Generated** → `sessionId` included in JWT payload
3. **Every API Call** → `verifyToken` middleware updates `last_activity`
4. **Fetch Online Admins** → Query sessions with `last_activity` < 24 hours

---

## ✅ Verification

Setelah login ulang, verify dengan:

### Check API Response:
```bash
# Get your token from localStorage
TOKEN="your_token_here"

# Test sessions endpoint
curl -X GET "https://order-management-app-production.wahwooh.workers.dev/api/admin/sessions" \
  -H "Authorization: Bearer $TOKEN"
```

### Check Database:
```sql
-- Check your active session
SELECT 
  admin_name, 
  login_at, 
  last_activity,
  ROUND((julianday('now') - julianday(last_activity)) * 24 * 60, 1) as minutes_ago
FROM admin_sessions 
WHERE admin_name = 'YOUR_NAME' 
  AND is_active = 1
ORDER BY last_activity DESC;
```

---

## ⚠️ Common Issues

### 1. "Tidak ada admin yang sedang online"
   - **Cause:** Using old token without `sessionId`
   - **Fix:** Logout and login again

### 2. Session hilang setelah beberapa saat
   - **Cause:** No activity for 24+ hours
   - **Fix:** This is expected behavior. Login again.

### 3. Error 404 di console
   - **Cause:** Backend deployment issue
   - **Fix:** Backend sudah di-redeploy, hard refresh (Ctrl+Shift+R)

---

## 📊 Backend Deployment Status

✅ **Latest Version:** af3127fd-0bd1-4420-b80f-5ac8eabd98d6
✅ **Deployed:** December 10, 2025
✅ **Features:**
- Session tracking on every authenticated request
- Auto-cleanup of sessions > 24 hours
- sessionId included in JWT token

---

## 🎉 Expected Behavior After Fix

1. Login → Session created with `sessionId`
2. Browse app → `last_activity` updates automatically
3. Check Activity page → Your name appears in "Admin Yang Sedang Online"
4. Keep using app → Stay online (as long as activity < 24 hours)
5. Inactive 24+ hours → Session expires, need to login again

---

## 📞 Support

If still not working after following these steps:
1. Check browser console for errors
2. Verify token has `sessionId`
3. Clear browser cache and cookies
4. Try incognito/private browsing mode
