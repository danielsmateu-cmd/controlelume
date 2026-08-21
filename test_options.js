import https from 'https';

const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `/users/1814819466/items/search?status=active&offset=0&limit=50`,
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://controlelume.vercel.app',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Authorization,Content-Type'
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`CORS HEADER: ${res.headers['access-control-allow-origin']}`);
  console.log(`CORS METHODS: ${res.headers['access-control-allow-methods']}`);
  console.log(`CORS HEADERS: ${res.headers['access-control-allow-headers']}`);
});
req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
