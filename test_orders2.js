import https from 'https';
const token = "APP_USR-7727923121805205-082109-000532f403c6c5921a10d77c4ddaebc8-1814819466";
const sellerId = "1380409990"; 
const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const dateTo = new Date().toISOString();
const path = `/orders/search?seller=${sellerId}&order.status=paid&order.date_created.from=${dateFrom}&order.date_created.to=${dateTo}&limit=2`;

const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `${path}&access_token=${token}`,
  method: 'GET'
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.end();
