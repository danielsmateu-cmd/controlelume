import https from 'https';
const token = "APP_USR-7727923121805205-082109-000532f403c6c5921a10d77c4ddaebc8-1814819466";
const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: `/items?ids=MLB3891206967&access_token=${token}`,
  method: 'GET'
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(data)[0].body.shipping)));
});
req.end();
