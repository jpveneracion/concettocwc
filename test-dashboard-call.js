// Test the dashboard API directly to see what's happening with encryption
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/dashboard?period=month',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // We'll need to add session cookie, but let's try without first to see what happens
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();