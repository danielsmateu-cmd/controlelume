import { createClient } from '@supabase/supabase-js';

const EVOLUTION_URL = 'http://169.58.132.151:8080';
const API_KEY = 'LumeSecretKey2026!';
const INSTANCE = 'whatsapp-vendas';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone_number, chat_id } = req.body;
    if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });

    const response = await fetch(${EVOLUTION_URL}/chat/fetchProfilePictureUrl/ + INSTANCE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({ number: phone_number })
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Evolution API error' });
    }

    const data = await response.json();
    const profilePicUrl = data?.profilePictureUrl || data?.picture || null;
    
    if (chat_id && profilePicUrl) {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
      );
      await supabase.from('whatsapp_chats').update({ profile_pic_url: profilePicUrl }).eq('id', chat_id);
    }
    
    return res.status(200).json({ profilePicUrl });
  } catch (error) {
    console.error('Error fetching profile pic:', error);
    return res.status(500).json({ error: error.message });
  }
}
