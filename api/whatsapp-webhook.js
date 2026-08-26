import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

const EVOLUTION_URL = 'http://169.58.132.151:8080';
const API_KEY = 'LumeSecretKey2026!';
const INSTANCE = 'whatsapp-vendas';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    // Evolution API v2 webhook format
    const event = payload?.event;
    const data = payload?.data;

    if (!data) return res.status(200).json({ ok: true, skipped: 'no data' });

    // Handle incoming messages
    if (event === 'messages.upsert' || event === 'message.upsert') {
      const msg = data?.message || data;
      const key = msg?.key || data?.key;
      const remoteJid = key?.remoteJid || data?.remoteJid;

      if (!remoteJid || remoteJid.includes('@g.us')) {
        // Skip group messages
        return res.status(200).json({ ok: true, skipped: 'group or no jid' });
      }

      const fromMe = key?.fromMe || false;
      const messageTimestamp = msg?.messageTimestamp || data?.messageTimestamp || Date.now();
      const pushName = data?.pushName || msg?.pushName || null;

      // Detect message type and content
      const msgContent = msg?.message || data?.message || {};
      let text = '';
      let messageType = 'text';
      let mediaUrl = null;
      let mediaCaption = null;
      let mediaMimeType = null;
      let shouldFetchMedia = false;

      if (msgContent?.conversation) {
        text = msgContent.conversation;
        messageType = 'text';
      } else if (msgContent?.extendedTextMessage) {
        text = msgContent.extendedTextMessage.text;
        messageType = 'text';
      } else if (msgContent?.imageMessage) {
        messageType = 'image';
        mediaCaption = msgContent.imageMessage.caption || '';
        mediaMimeType = msgContent.imageMessage.mimetype || 'image/jpeg';
        text = mediaCaption || '';
        shouldFetchMedia = true;
      } else if (msgContent?.videoMessage) {
        messageType = 'video';
        mediaCaption = msgContent.videoMessage.caption || '';
        mediaMimeType = msgContent.videoMessage.mimetype || 'video/mp4';
        text = mediaCaption || '[Video]';
        shouldFetchMedia = true;
      } else if (msgContent?.audioMessage || msgContent?.pttMessage) {
        messageType = 'audio';
        const am = msgContent.audioMessage || msgContent.pttMessage;
        mediaMimeType = am?.mimetype || 'audio/ogg';
        text = '[Audio]';
        shouldFetchMedia = true;
      } else if (msgContent?.documentMessage) {
        messageType = 'document';
        text = msgContent.documentMessage.title || msgContent.documentMessage.fileName || '[Documento]';
        mediaMimeType = msgContent.documentMessage.mimetype;
        shouldFetchMedia = true;
      } else if (msgContent?.stickerMessage) {
        messageType = 'sticker';
        text = '[Figurinha]';
        mediaMimeType = msgContent.stickerMessage?.mimetype || 'image/webp';
        shouldFetchMedia = true;
      } else if (msgContent?.locationMessage) {
        messageType = 'location';
        const { degreesLatitude, degreesLongitude } = msgContent.locationMessage;
        text = [Localizacao: , ];
      } else if (msgContent?.contactMessage) {
        messageType = 'contact';
        text = [Contato: ];
      } else {
        // Unknown type - skip silently
        return res.status(200).json({ ok: true, skipped: 'unknown message type' });
      }

      if (shouldFetchMedia) {
        try {
          const messageId = key?.id;
          if (messageId) {
            const mediaResp = await fetch(
              ${EVOLUTION_URL}/chat/getBase64FromMediaMessage/,
              {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { key } })
              }
            );
            if (mediaResp.ok) {
              const mediaData = await mediaResp.json();
              if (mediaData?.base64) {
                const mimeType = mediaData.mimetype || mediaMimeType;
                mediaUrl = data:;base64,;
              }
            }
          }
        } catch (mediaErr) {
          console.warn('Could not fetch media:', mediaErr.message);
        }
      }

      const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

      // Upsert the chat record
      const { data: chatData } = await supabase
        .from('whatsapp_chats')
        .upsert({
          remote_jid: remoteJid,
          phone_number: phone,
          push_name: pushName,
          last_message: messageType !== 'text' ? `[${messageType}] ${text}`.trim() : text,
          unread_count: fromMe ? 0 : 1,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'remote_jid',
          ignoreDuplicates: false
        })
        .select('id, profile_pic_url')
        .single();

      // Async fetch profile pic if missing
      if (chatData && !chatData.profile_pic_url) {
        fetch(${EVOLUTION_URL}/chat/fetchProfilePictureUrl/, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ number: phone })
        })
        .then(res => res.json())
        .then(async picData => {
          const pic = picData?.profilePictureUrl || picData?.picture;
          if (pic) {
            await supabase.from('whatsapp_chats').update({ profile_pic_url: pic }).eq('id', chatData.id);
          }
        })
        .catch(err => console.error('Webhook pic fetch error:', err));
      }

      if (!chatData) {
        console.error('Failed to upsert chat');
        return res.status(200).json({ ok: true, error: 'chat upsert failed' });
      }

      // Insert the message
      const messageId = key?.id;
      await supabase
        .from('whatsapp_messages')
        .upsert({
          chat_id: chatData.id,
          remote_jid: remoteJid,
          message_id: messageId,
          from_me: fromMe,
          sender_name: fromMe ? 'Lume Acr\u00EDlicos' : pushName || phone,
          text,
          message_type: messageType,
          media_url: mediaUrl,
          media_caption: mediaCaption,
          media_mime_type: mediaMimeType,
          timestamp: typeof messageTimestamp === 'number' ? messageTimestamp * 1000 : Date.now()
        }, {
          onConflict: 'message_id',
          ignoreDuplicates: true
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, skipped: `unhandled event: ${event}` });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

