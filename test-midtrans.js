const https = require('https');

const serverKey = 'SB-Mid-server-03Jzw_2UGDNXu1KifC8FAfIq';
const auth = Buffer.from(serverKey + ':').toString('base64');

const options = {
  hostname: 'api.sandbox.midtrans.com',
  path: '/v2/status/ORDER-123',
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  }
};

console.log('Testing Midtrans API with server key:', serverKey.substring(0, 10) + '...');
console.log('Using auth header:', `Basic ${auth.substring(0, 10)}...`);

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      console.log('Response:', JSON.parse(data));
    } catch (e) {
      console.log('Raw Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
