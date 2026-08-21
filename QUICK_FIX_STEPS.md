# 🚨 QUICK FIX - Admin Activity Tidak Muncul

## Step 1: Buka Browser Console
Tekan `F12` atau `Cmd + Option + I` (Mac)

## Step 2: Clear Everything
Paste dan jalankan command ini di Console:

```javascript
// Clear all storage
localStorage.clear();
sessionStorage.clear();

// Clear cookies for this domain
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

// Reload page
alert("Storage cleared! Click OK to reload and login again.");
location.reload();
```

## Step 3: Login Ulang
1. Setelah page reload, Anda akan di-redirect ke login page
2. Login dengan username dan password Anda
3. **PENTING:** Ini akan generate token BARU dengan sessionId

## Step 4: Verify Token
Setelah login, buka Console lagi dan check:

```javascript
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('✅ Token payload:', payload);
  console.log('✅ Has sessionId:', !!payload.sessionId);
} else {
  console.log('❌ No token found!');
}
```

Jika `Has sessionId: true` → **SUCCESS!**

## Step 5: Test Activity Page
1. Buka: https://nota.kurniasari.co.id/admin/activity
2. Anda harus muncul di "Admin Yang Sedang Online"
3. Tidak ada error 401 di console

---

## ⚠️ Jika Masih Error:

### Hard Refresh:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### atau Incognito Mode:
1. Buka browser incognito/private
2. Login fresh
3. Check activity page

---

## ✅ Expected Console (Setelah Fix):
```
✅ Token payload: {
  id: "usr_xxx",
  username: "ana", 
  role: "admin",
  sessionId: "session-1765310212238-abc123"  ← MUST HAVE THIS
}
✅ Has sessionId: true
```

## ❌ Bad Console (Token Lama):
```
❌ Token payload: {
  id: "usr_xxx",
  username: "ana", 
  role: "admin"
  // NO sessionId!
}
❌ Has sessionId: false
```

---

## 🎯 Root Cause:
Token JWT tidak bisa di-update setelah dibuat. Token lama Anda tidak punya `sessionId`, jadi session tracking tidak berfungsi. Harus login ulang untuk dapat token baru.
