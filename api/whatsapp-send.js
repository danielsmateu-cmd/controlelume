export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Credenciais da Evolution API
  const EVOLUTION_URL = 'http://169.58.132.151:8080';
  const API_KEY = 'LumeSecretKey2026!';
  const INSTANCE = 'whatsapp-vendas';

  try {
    const { number, text, mediaBase64, mediaName, mediaType } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'Missing number' });
    }

    let endpoint = `${EVOLUTION_URL}/message/sendText/${INSTANCE}`;
    let payload = { number, text: text || '' };

    if (mediaBase64) {
      endpoint = `${EVOLUTION_URL}/message/sendMedia/${INSTANCE}`;
      payload = {
        number,
        mediatype: mediaType || 'document',
        caption: text || '',
        media: mediaBase64,
        fileName: mediaName || 'arquivo'
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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

