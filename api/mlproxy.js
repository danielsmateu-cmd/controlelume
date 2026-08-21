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

    // Passar Authorization header se existir
    if (req.headers.authorization) {
      options.headers['Authorization'] = req.headers.authorization;
    }

    if (req.headers['content-type']) {
      options.headers['Content-Type'] = req.headers['content-type'];
    }

    // Se houver body (POST/PUT), repassar
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      // Vercel parses JSON bodies automatically, need to stringify it back
      options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(url.toString(), options);
    
    // Pegar o body
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}
