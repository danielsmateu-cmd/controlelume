import { supabase } from '../lib/supabase';

const EVOLUTION_URL = 'http://169.58.132.151:8080';
const API_KEY = 'LumeSecretKey2026!';
const INSTANCE = 'whatsapp-vendas';

export const whatsappService = {
  // Buscar todas as conversas
  async getChats() {
    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching whatsapp_chats:', err);
      return [];
    }
  },

  // Buscar mensagens de um chat específico
  async getMessages(chatId) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching whatsapp_messages:', err);
      return [];
    }
  },

  // Enviar mensagem para o cliente via Evolution API e registrar no Supabase
  async sendMessage(chat, text, senderName = 'Atendente') {
    try {
      const cleanNumber = chat.phone_number || chat.remote_jid.replace('@s.whatsapp.net', '');

      // 1. Enviar via Evolution API
      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: text
        })
      });

      if (!response.ok) {
        throw new Error(`Evolution API error: ${response.statusText}`);
      }

      const resData = await response.json();

      // 2. Registrar no Supabase
      const { data: newMsg, error: msgErr } = await supabase
        .from('whatsapp_messages')
        .insert([{
          chat_id: chat.id,
          remote_jid: chat.remote_jid,
          message_id: resData?.key?.id || null,
          from_me: true,
          sender_name: senderName,
          text: text,
          timestamp: Date.now()
        }])
        .select()
        .single();

      if (msgErr) console.error('Error inserting msg in Supabase:', msgErr);

      // 3. Atualizar resumo na conversa
      await supabase
        .from('whatsapp_chats')
        .update({
          last_message: text,
          updated_at: new Date().toISOString()
        })
        .eq('id', chat.id);

      return newMsg;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  },

  // Assumir atendimento da conversa
  async assignChat(chatId, userName) {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          assigned_to: userName,
          status: 'em_atendimento',
          unread_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error assigning chat:', err);
      return false;
    }
  },

  // Finalizar atendimento da conversa
  async closeChat(chatId) {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          status: 'finalizado',
          unread_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error closing chat:', err);
      return false;
    }
  },

  // Transferir conversa para outro setor
  async transferChat(chatId, newSetor) {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          setor: newSetor,
          status: 'aguardando_atendente',
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error transferring chat:', err);
      return false;
    }
  },

  // Zerar contador de não lidas
  async markAsRead(chatId) {
    try {
      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: 0 })
        .eq('id', chatId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }
};
