export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { zpl, dpmm = '8dpmm', size = '4x6' } = req.body || {};

    if (!zpl) {
      return res.status(400).json({ error: 'Missing zpl content' });
    }

    const formData = new FormData();
    formData.append('file', new Blob([zpl], { type: 'text/plain' }), 'labels.zpl');

    const labelaryUrl = `http://api.labelary.com/v1/printers/${dpmm}/labels/${size}/`;
    const response = await fetch(labelaryUrl, {
      method: 'POST',
      headers: { 'Accept': 'application/pdf' },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText || 'Labelary conversion failed' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="etiquetas_100x150.pdf"');
    return res.send(buffer);
  } catch (err) {
    console.error('Error in /api/labelary:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
