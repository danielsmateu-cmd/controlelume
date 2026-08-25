const body = $json.body || {};
const data = body.data || body;
const item = Array.isArray(data) ? data[0] : data;

if (!item || !item.key || !item.key.remoteJid) {
  return [{ json: { valid: false } }];
}

const key = item.key;
const remoteJid = key.remoteJid || '';
const number = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
const fromMe = !!key.fromMe;
const messageId = key.id || '';

let rawPushName = item.pushName || '';
let pushName = rawPushName;
if (fromMe || rawPushName === 'Lume Acrílicos' || rawPushName === 'Lume Acrilicos' || rawPushName === 'Você') {
  pushName = '';
}

const msgObj = item.message || {};

let messageType = 'text';
let mediaCaption = null;
let mediaMimeType = null;
let mediaBase64 = null;

if (msgObj.imageMessage) {
  messageType = 'image';
  mediaCaption = msgObj.imageMessage.caption || null;
  mediaMimeType = msgObj.imageMessage.mimetype || 'image/jpeg';
} else if (msgObj.videoMessage) {
  messageType = 'video';
  mediaCaption = msgObj.videoMessage.caption || null;
  mediaMimeType = msgObj.videoMessage.mimetype || 'video/mp4';
} else if (msgObj.audioMessage || msgObj.pttMessage) {
  messageType = 'audio';
  mediaMimeType = (msgObj.audioMessage || msgObj.pttMessage)?.mimetype || 'audio/ogg';
} else if (msgObj.documentMessage) {
  messageType = 'document';
  mediaCaption = msgObj.documentMessage.title || null;
  mediaMimeType = msgObj.documentMessage.mimetype || null;
} else if (msgObj.stickerMessage) {
  messageType = 'sticker';
}

if (messageType !== 'text' && !fromMe) {
  try {
    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: 'http://169.58.132.151:8080/chat/getBase64FromMediaMessage/whatsapp-vendas',
      headers: {
        'apikey': 'LumeSecretKey2026!',
        'Content-Type': 'application/json'
      },
      body: { message: { key: key } },
      json: true
    });
    if (response && response.base64) {
      mediaBase64 = 'data:' + (response.mimetype || mediaMimeType) + ';base64,' + response.base64;
    }
  } catch (err) {
    console.log('Erro ao buscar base64:', err.message);
  }
}

const messageText = msgObj.conversation || 
                    msgObj.extendedTextMessage?.text || 
                    mediaCaption || 
                    item.messageText || '';

return [{
  json: {
    valid: true,
    number,
    remoteJid,
    pushName: pushName || undefined,
    rawPushName: rawPushName || number,
    messageText,
    messageId,
    fromMe,
    stateKey: 'sessao:' + remoteJid,
    isGroup: remoteJid.includes('@g.us'),
    messageType,
    mediaCaption,
    mediaMimeType,
    mediaBase64,
    rawKey: key
  }
}];
