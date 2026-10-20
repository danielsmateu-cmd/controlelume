import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://veysoizitzprxznkdhqu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXNvaXppdHpwcnh6bmtkaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTQ1NDIsImV4cCI6MjA4NzE5MDU0Mn0.sLZ_evLuZZdxyDz87ITnt-uGdPNSXWODa9a12pfaypw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EVOLUTION_URL = 'http://169.58.132.151:8080';
const API_KEY = 'LumeSecretKey2026!';
const INSTANCE = 'whatsapp-vendas';

export default async function handler(req, res) {
  // Allow GET and POST
  const phone = (req.query?.phone || req.body?.phone || '').toString();
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    // 1. Query Evolution API for recent reaction messages
    const evoRes = await fetch(`${EVOLUTION_URL}/chat/findMessages/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        where: {
          messageType: 'reactionMessage'
        },
        limit: 100
      })
    });

    if (!evoRes.ok) {
      return res.status(200).json({ reactions: {} });
    }

    const evoData = await evoRes.json();
    const records = evoData.messages?.records || [];

    // Filter by phone if provided
    const relevantReactions = cleanPhone
      ? records.filter(r =>
          r.key?.remoteJid?.includes(cleanPhone) ||
          r.key?.remoteJidAlt?.includes(cleanPhone) ||
          r.message?.reactionMessage?.key?.remoteJid?.includes(cleanPhone)
        )
      : records;

    const reactionsMap = {};
    const deleteIds = [];
    const updates = [];

    for (const r of relevantReactions) {
      const reactionId = r.key?.id;
      const targetId = r.message?.reactionMessage?.key?.id;
      const emoji = r.message?.reactionMessage?.text || '';

      if (reactionId) {
        deleteIds.push(reactionId);
      }

      if (targetId) {
        reactionsMap[targetId] = emoji;
        if (emoji) {
          updates.push({ targetId, emoji });
        }
      }
    }

    // Background cleanup of empty reaction messages in Supabase
    if (deleteIds.length > 0) {
      supabase
        .from('whatsapp_messages')
        .delete()
        .in('message_id', deleteIds)
        .then(() => {})
        .catch(() => {});
    }

    // Attach reaction emoji to target messages in Supabase
    for (const up of updates) {
      supabase
        .from('whatsapp_messages')
        .update({ media_caption: up.emoji })
        .eq('message_id', up.targetId)
        .then(() => {})
        .catch(() => {});
    }

    return res.status(200).json({
      success: true,
      reactions: reactionsMap
    });
  } catch (err) {
    console.error('Error in whatsapp-reactions:', err);
    return res.status(200).json({ reactions: {}, error: err.message });
  }
}
