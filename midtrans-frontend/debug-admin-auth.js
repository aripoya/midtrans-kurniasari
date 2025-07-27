// 🔍 COMPREHENSIVE ADMIN AUTHENTICATION DEBUG SCRIPT
// Run this in browser console after loading admin dashboard

console.log('🎯 ADMIN AUTHENTICATION COMPREHENSIVE DEBUG');
console.log('==========================================');

// Step 1: Check basic authentication state
console.log('\n📊 STEP 1: Basic Authentication State');
console.log('====================================');

const token = sessionStorage.getItem('token');
const user = JSON.parse(sessionStorage.getItem('user') || '{}');

console.log('🔑 Token in sessionStorage:', token ? '✅ Found' : '❌ Missing');
console.log('👤 User in sessionStorage:', user ? '✅ Found' : '❌ Missing');
console.log('🎭 User role:', user.role);
console.log('🌐 Current URL:', window.location.href);

if (token) {
  console.log('🔍 Token preview:', token.substring(0, 50) + '...');
  
  // Step 2: Decode JWT token to check expiration
  console.log('\n📊 STEP 2: JWT Token Analysis');
  console.log('=============================');
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp && payload.exp < currentTime;
    
    console.log('⏰ Token issued at:', new Date(payload.iat * 1000).toLocaleString());
    console.log('⏰ Token expires at:', new Date(payload.exp * 1000).toLocaleString());
    console.log('⏰ Current time:', new Date().toLocaleString());
    console.log('✅ Token valid:', isExpired ? '❌ EXPIRED' : '✅ Valid');
    console.log('👤 Token user ID:', payload.id);
    console.log('🎭 Token role:', payload.role);
    
    if (isExpired) {
      console.log('🚨 TOKEN IS EXPIRED! This is likely the cause of 401 errors.');
    }
  } catch (error) {
    console.log('❌ Failed to decode JWT token:', error.message);
    console.log('🚨 Invalid token format! This will cause 401 errors.');
  }
} else {
  console.log('🚨 NO TOKEN FOUND! User needs to login.');
}

// Step 3: Test API endpoints with current authentication
if (token && user.role === 'admin') {
  console.log('\n📊 STEP 3: API Endpoint Testing');
  console.log('==============================');
  
  // Test different API endpoints to isolate the issue
  const endpoints = [
    {
      name: 'User Management',
      url: '/api/admin/users',
      method: 'GET'
    },
    {
      name: 'Admin Orders',
      url: '/api/orders/admin',
      method: 'GET'
    },
    {
      name: 'Auth Profile',
      url: '/auth/profile',
      method: 'GET'
    }
  ];
  
  endpoints.forEach((endpoint, index) => {
    setTimeout(() => {
      console.log(`\n🔄 Testing ${endpoint.name} (${endpoint.method} ${endpoint.url})...`);
      
      fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      .then(response => {
        console.log(`📊 ${endpoint.name} Response:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: {
            'content-type': response.headers.get('content-type'),
            'access-control-allow-origin': response.headers.get('access-control-allow-origin')
          }
        });
        
        if (response.status === 401) {
          console.log(`🚨 ${endpoint.name} AUTHENTICATION FAILED!`);
          console.log('   → Check token validity and backend authentication');
        } else if (response.status === 403) {
          console.log(`🚨 ${endpoint.name} AUTHORIZATION FAILED!`);
          console.log('   → User has valid token but insufficient permissions');
        } else if (response.ok) {
          console.log(`✅ ${endpoint.name} SUCCESS!`);
        } else {
          console.log(`❌ ${endpoint.name} ERROR:`, response.status, response.statusText);
        }
        
        return response.json();
      })
      .then(data => {
        if (endpoint.name === 'User Management') {
          if (data.success) {
            console.log(`✅ ${endpoint.name} Data:`, {
              success: data.success,
              userCount: data.users?.length || 0,
              hasUsers: !!data.users
            });
          } else {
            console.log(`❌ ${endpoint.name} Error:`, data.message || data.error);
          }
        }
      })
      .catch(error => {
        if (error.message.includes('CORS')) {
          console.log(`❌ ${endpoint.name} CORS Error:`, error.message);
        } else {
          console.log(`❌ ${endpoint.name} Network Error:`, error.message);
        }
      });
    }, index * 2000); // Stagger requests
  });
  
  // Step 4: Test authentication headers
  setTimeout(() => {
    console.log('\n📊 STEP 4: Authentication Headers Test');
    console.log('=====================================');
    
    console.log('🔍 Testing Authorization header format...');
    const authHeader = `Bearer ${token}`;
    console.log('📝 Authorization header:', authHeader.substring(0, 50) + '...');
    
    // Test different header combinations
    const headerTests = [
      {
        name: 'Standard Headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'With Accept Header',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      {
        name: 'With CORS Headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        }
      }
    ];
    
    headerTests.forEach((test, index) => {
      setTimeout(() => {
        console.log(`\n🧪 Testing ${test.name}...`);
        
        fetch('/api/admin/users', {
          method: 'GET',
          headers: test.headers
        })
        .then(response => {
          console.log(`📊 ${test.name} Result:`, {
            status: response.status,
            ok: response.ok,
            authWorks: response.status !== 401
          });
        })
        .catch(error => {
          console.log(`❌ ${test.name} Error:`, error.message);
        });
      }, index * 1000);
    });
  }, 8000);
  
} else {
  console.log('\n🚨 AUTHENTICATION REQUIRED');
  console.log('===========================');
  console.log('Please login as admin first:');
  console.log('🔗 Admin Login: http://localhost:5175/admin/login');
}

// Step 5: Recommendations
setTimeout(() => {
  console.log('\n💡 STEP 5: Debug Recommendations');
  console.log('=================================');
  
  if (!token) {
    console.log('🎯 SOLUTION: Login as admin first');
    console.log('   → Go to http://localhost:5175/admin/login');
  } else {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < currentTime;
      
      if (isExpired) {
        console.log('🎯 SOLUTION: Token is expired, need to re-login');
        console.log('   → Clear session and login again');
        console.log('   → Run: sessionStorage.clear(); then login');
      } else if (payload.role !== 'admin') {
        console.log('🎯 SOLUTION: User is not admin');
        console.log('   → Login with admin credentials');
      } else {
        console.log('🎯 SOLUTION: Token seems valid, check backend');
        console.log('   → Verify backend JWT verification logic');
        console.log('   → Check CORS configuration');
        console.log('   → Verify API endpoint availability');
      }
    } catch (error) {
      console.log('🎯 SOLUTION: Invalid token format');
      console.log('   → Clear session and login again');
      console.log('   → Run: sessionStorage.clear(); then login');
    }
  }
  
  console.log('\n🔄 To retry this debug script, run:');
  console.log('   → Copy and paste this entire script again');
}, 15000);
