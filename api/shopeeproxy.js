export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Responder OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair target da query e o resto da query
  const target = req.query.target;
  if (!target) {
    return res.status(400).json({ error: 'Missing target URL' });
  }

  try {
    const url = new URL(target);
    
    // Obter todos os params da req.query, exceto o target
    const searchParams = new URLSearchParams(req.query);
    searchParams.delete('target');
    searchParams.forEach((val, key) => {
      url.searchParams.append(key, val);
    });

    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json',
      },
    };

    if (req.headers.authorization) {
      options.headers['Authorization'] = req.headers.authorization;
    }

    if (req.headers['content-type']) {
      options.headers['Content-Type'] = req.headers['content-type'];
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(url.toString(), options);
    
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Shopee Proxy Error:', err);
    return res.status(500).json({ error: 'Shopee Proxy error', details: err.message });
  }
}
