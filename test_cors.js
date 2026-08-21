import https from 'https';

const token = "APP_USR-7727923121805205-082109-000532f403c6c5921a10d77c4ddaebc8-1814819466";
const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `/users/1814819466/items/search?status=active&offset=0&limit=50`,
  method: 'GET',
  headers: {
    'Origin': 'https://controlelume.vercel.app',
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`CORS HEADER: ${res.headers['access-control-allow-origin']}`);
});
req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
