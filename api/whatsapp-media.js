import { createClient } from '@supabase/supabase-js';

const EVOLUTION_URL = 'http://169.58.132.151:8080';
const API_KEY = 'LumeSecretKey2026!';
const INSTANCE = 'whatsapp-vendas';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const messageId = req.query?.messageId || req.body?.messageId;
    const fileName = req.query?.fileName || req.body?.fileName || 'arquivo';

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // 1. Verifica se a mensagem já tem media_url salvo no Supabase
    const { data: existingMsg } = await supabase
      .from('whatsapp_messages')
      .select('id, media_url, text, media_mime_type')
      .eq('message_id', messageId)
      .maybeSingle();

    if (existingMsg?.media_url && existingMsg.media_url.startsWith('http')) {
      return res.status(200).json({ url: existingMsg.media_url });
    }

    // 2. Busca o arquivo na Evolution API sob demanda
    const evoResp = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          key: { id: messageId }
        }
      })
    });

    if (!evoResp.ok) {
      const errText = await evoResp.text();
      return res.status(evoResp.status).json({ error: 'Evolution API error: ' + errText });
    }

    const evoData = await evoResp.json();
    if (!evoData?.base64) {
      return res.status(404).json({ error: 'Arquivo não encontrado na Evolution API' });
    }

    const mimeType = evoData.mimetype || existingMsg?.media_mime_type || 'application/octet-stream';
    const finalName = (evoData.fileName || existingMsg?.text || fileName || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `whatsapp/${messageId}_${finalName}`;
    const buffer = Buffer.from(evoData.base64, 'base64');

    // 3. Faz upload no bucket público do Supabase Storage
    const { error: upErr } = await supabase.storage
      .from('orcamentos')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (upErr) {
      console.error('Supabase storage upload error:', upErr);
      // Se o arquivo for menor que 2MB e o storage falhar, retorna data URL como fallback
      if (evoData.base64.length < 2 * 1024 * 1024) {
        const fallbackUrl = `data:${mimeType};base64,${evoData.base64}`;
        if (existingMsg?.id) {
          await supabase.from('whatsapp_messages').update({ media_url: fallbackUrl }).eq('id', existingMsg.id);
        }
        return res.status(200).json({ url: fallbackUrl });
      }
      return res.status(500).json({ error: 'Erro ao salvar arquivo no Storage: ' + upErr.message });
    }

    // 4. Obtém URL pública permanente
    const { data: pubData } = supabase.storage
      .from('orcamentos')
      .getPublicUrl(storagePath);

    const publicUrl = pubData?.publicUrl;

    // 5. Atualiza a mensagem no banco com a URL permanente
    if (existingMsg?.id && publicUrl) {
      await supabase
        .from('whatsapp_messages')
        .update({
          media_url: publicUrl,
          media_mime_type: mimeType
        })
        .eq('id', existingMsg.id);
    }

    return res.status(200).json({ url: publicUrl });

  } catch (err) {
    console.error('Error in whatsapp-media endpoint:', err);
    return res.status(500).json({ error: err.message });
  }
}
