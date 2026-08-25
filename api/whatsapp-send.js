export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Credenciais da Evolution API
  const EVOLUTION_URL = 'http://169.58.132.151:8080';
  const API_KEY = 'LumeSecretKey2026!';
  const INSTANCE = 'whatsapp-vendas';

  try {
    const { number, text } = req.body;
    
    if (!number || !text) {
      return res.status(400).json({ error: 'Missing number or text' });
    }

    // O backend do Vercel faz a requisição HTTP (não sofre bloqueio de Mixed Content)
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ number, text })
    });
    
    if (!response.ok) {
      const errData = await response.text();
      return res.status(response.status).json({ error: errData });
    }
    
    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error in whatsapp-send:', error);
    return res.status(500).json({ error: error.message });
  }
}
