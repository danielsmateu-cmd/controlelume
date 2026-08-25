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

  // Buscar mensagens de um chat específico (por chat_id OU remote_jid)
  async getMessages(chat) {
    if (!chat) return [];
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`chat_id.eq.${chat.id},remote_jid.eq.${chat.remote_jid}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching whatsapp_messages:', err);
      return [];
    }
  },

  // Enviar mensagem para o cliente
  async sendMessage(chat, text, senderName = 'Atendente', mediaBase64 = null, mediaName = null, mediaType = null) {
    try {
      const cleanNumber = chat.phone_number || chat.remote_jid.replace('@s.whatsapp.net', '');

      // Formatar mensagem para incluir o nome do atendente no topo em negrito
      const formattedText = senderName ? `*${senderName}:*\n${text}` : text;

      // 1. Enviar mensagem via Vercel Backend (Proxy) para evitar Mixed Content
      let sentDirectly = false;
      try {
        const payload = {
          number: cleanNumber,
          text: formattedText
        };
        if (mediaBase64) {
          payload.mediaBase64 = mediaBase64;
          payload.mediaName = mediaName;
          payload.mediaType = mediaType;
        }

        const response = await fetch(`/api/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          sentDirectly = true;
          console.log('Mensagem enviada com sucesso via proxy Vercel.');
        } else {
          console.error('Falha no envio via proxy:', await response.text());
        }
      } catch (directErr) {
        console.error('Erro na requisição de envio:', directErr);
      }

      // 2. Registrar no Supabase (O frontend cadastra a mensagem para histórico)
      const newMsgObj = {
        chat_id: chat.id,
        remote_jid: chat.remote_jid,
        from_me: true,
        sender_name: senderName,
        text: formattedText,
        timestamp: Date.now(),
        sent_to_evolution: sentDirectly // Marca se o envio real funcionou
      };

      if (mediaBase64) {
        newMsgObj.message_type = mediaType === 'document' ? 'document' : 'image';
        newMsgObj.media_url = mediaBase64;
        newMsgObj.media_caption = formattedText;
        newMsgObj.text = formattedText;
      }

      const { data: newMsg, error: msgErr } = await supabase
        .from('whatsapp_messages')
        .insert([newMsgObj])
        .select()
        .single();

      if (msgErr) console.error('Error inserting msg in Supabase:', msgErr);

      // 3. Atualizar resumo na conversa
      await supabase
        .from('whatsapp_chats')
        .update({
          last_message: formattedText,
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
          status: 'em_atendimento',
          assigned_to: userName,
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

  // Atualizar Status da Conversa (em_atendimento, aguardando_retorno, finalizado)
  async updateStatus(chatId, newStatus) {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating chat status:', err);
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

  // Transferir conversa diretamente para um atendente específico
  async transferToUser(chatId, userName) {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          assigned_to: userName,
          status: 'em_atendimento',
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error transferring chat to user:', err);
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

