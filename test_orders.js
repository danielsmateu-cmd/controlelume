import https from 'https';
const token = "APP_USR-7727923121805205-082109-000532f403c6c5921a10d77c4ddaebc8-1814819466";
const sellerId = "1380409990"; // Lume Acrilicos

const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const dateTo = new Date().toISOString();
const path = `/orders/search?seller=${sellerId}&order.status=paid&order.date_created.from=${dateFrom}&order.date_created.to=${dateTo}&limit=10`;

const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `${path}&access_token=${token}`,
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Total orders in 30 days:", json.paging.total);
    if(json.results && json.results.length > 0) {
        const order = json.results[0];
        console.log("Sample order_items:", JSON.stringify(order.order_items, null, 2));
    }
  });
});
req.end();
