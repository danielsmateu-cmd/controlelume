import https from 'https';
const token = "APP_USR-7727923121805205-082109-000532f403c6c5921a10d77c4ddaebc8-1814819466";

const body = JSON.stringify({ available_quantity: 10 });

const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `/items/MLB3841655081?access_token=${token}&_method=PUT`,
  method: 'POST',
  headers: {
    'Origin': 'https://controlelume.vercel.app',
    'Content-Type': 'text/plain',
    'Content-Length': body.length
  }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(`STATUS: ${res.statusCode} DATA: ${data.substring(0, 200)}`));
});
req.write(body);
req.end();
