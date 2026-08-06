import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Search, Send, UserCheck, CheckCircle2, 
  Clock, User, RefreshCw, Filter, CheckCheck, ArrowRightLeft,
  AlertCircle, Building, Phone, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { useAuth } from '../context/AuthContext';

const SETORES = [
  { id: 'vendas', label: 'Vendas / Orçamentos', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'projetos', label: 'Projetos', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'pedidos', label: 'Dúvidas de Pedidos', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'financeiro', label: 'Financeiro', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'outros', label: 'Outros', color: 'bg-gray-100 text-gray-800 border-gray-200' }
];

export default function WhatsAppChat() {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('aguardando'); // 'aguardando', 'minhas', 'todas', 'finalizados'
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Carregar Chats Iniciais
  const fetchChats = async () => {
    setLoadingChats(true);
    const data = await whatsappService.getChats();
    setChats(data);
    setLoadingChats(false);
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // 2. Realtime Subscription para Chats e Mensagens
  useEffect(() => {
    // Inscrever-se em alterações na tabela whatsapp_chats
    const chatsChannel = supabase
      .channel('public:whatsapp_chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        (payload) => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
    };
  }, []);

  // 3. Carregar e Inscrever em Mensagens do Chat Ativo
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      const data = await whatsappService.getMessages(activeChat.id);
      setMessages(data);
      setLoadingMessages(false);
      scrollToBottom();
      whatsappService.markAsRead(activeChat.id);
    };

    loadMessages();

    // Inscrever em novas mensagens deste chat
    const messagesChannel = supabase
      .channel(`chat_messages:${activeChat.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'whatsapp_messages', 
          filter: `chat_id=eq.${activeChat.id}` 
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [activeChat?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enviar Mensagem
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      await whatsappService.sendMessage(activeChat, textToSend, currentUser?.name || 'Atendente');
      // Atualizar lista local de mensagens caso o realtime demore
      const refreshed = await whatsappService.getMessages(activeChat.id);
      setMessages(refreshed);
      scrollToBottom();
    } catch (err) {
      alert('Erro ao enviar mensagem via WhatsApp. Verifique se a API está online.');
    } finally {
      setSending(false);
    }
  };

  // Assumir Atendimento
  const handleAssign = async () => {
    if (!activeChat) return;
    const userName = currentUser?.name || currentUser?.login || 'Atendente';
    const success = await whatsappService.assignChat(activeChat.id, userName);
    if (success) {
      setActiveChat({ ...activeChat, assigned_to: userName, status: 'em_atendimento' });
      fetchChats();
    }
  };

  // Finalizar Atendimento
  const handleClose = async () => {
    if (!activeChat) return;
    if (window.confirm(`Deseja encerrar o atendimento de ${activeChat.push_name || activeChat.phone_number}?`)) {
      const success = await whatsappService.closeChat(activeChat.id);
      if (success) {
        setActiveChat({ ...activeChat, status: 'finalizado' });
        fetchChats();
      }
    }
  };

  // Transferir Setor
  const handleTransfer = async (newSetor) => {
    if (!activeChat) return;
    const success = await whatsappService.transferChat(activeChat.id, newSetor);
    if (success) {
      setActiveChat({ ...activeChat, setor: newSetor, status: 'aguardando_atendente', assigned_to: null });
      setTransferModalOpen(false);
      fetchChats();
    }
  };

  // Filtragem de Conversas
  const filteredChats = chats.filter((chat) => {
    const matchesSearch = 
      (chat.push_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.phone_number || '').includes(searchQuery);

    if (!matchesSearch) return false;

    const userLogin = currentUser?.name || currentUser?.login || '';

    if (filterTab === 'aguardando') {
      return chat.status === 'aguardando_atendente' || chat.status === 'triagem' || !chat.status;
    }
    if (filterTab === 'minhas') {
      return chat.status === 'em_atendimento' && chat.assigned_to === userLogin;
    }
    if (filterTab === 'finalizados') {
      return chat.status === 'finalizado';
    }
    return true; // 'todas'
  });

  const getSetorBadge = (setorId) => {
    const setor = SETORES.find((s) => s.id === setorId);
    return setor ? setor : { label: setorId || 'Geral', color: 'bg-gray-100 text-gray-700' };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'triagem':
        return { label: 'Bot / Triagem', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'aguardando_atendente':
        return { label: 'Aguardando', color: 'bg-red-50 text-red-700 border-red-200 font-bold animate-pulse' };
      case 'em_atendimento':
        return { label: 'Em Atendimento', color: 'bg-green-50 text-green-700 border-green-200' };
      case 'finalizado':
        return { label: 'Finalizado', color: 'bg-gray-100 text-gray-600 border-gray-200' };
      default:
        return { label: status, color: 'bg-gray-50 text-gray-600' };
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm m-4">
      {/* ================= COLUNA ESQUERDA: LISTA DE CONVERSAS ================= */}
      <div className="w-80 md:w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header Esquerdo */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-base leading-tight">WhatsApp Lume</h1>
                <p className="text-xs text-gray-500">Central de Atendimento</p>
              </div>
            </div>
            <button
              onClick={fetchChats}
              title="Atualizar conversas"
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Abas / Filtros */}
          <div className="flex p-1 bg-gray-100/80 rounded-xl text-xs font-medium text-gray-600 gap-1">
            <button
              onClick={() => setFilterTab('aguardando')}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center',
                filterTab === 'aguardando'
                  ? 'bg-white text-red-600 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Aguardando
            </button>
            <button
              onClick={() => setFilterTab('minhas')}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center',
                filterTab === 'minhas'
                  ? 'bg-white text-indigo-600 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Minhas
            </button>
            <button
              onClick={() => setFilterTab('todas')}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center',
                filterTab === 'todas'
                  ? 'bg-white text-gray-900 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterTab('finalizados')}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center',
                filterTab === 'finalizados'
                  ? 'bg-white text-gray-700 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Fim
            </button>
          </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loadingChats ? (
            <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              Carregando conversas...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs space-y-1">
              <MessageSquare className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
              <p className="font-semibold text-gray-600">Nenhuma conversa encontrada</p>
              <p className="text-[11px] text-gray-400">Nenhuma mensagem nesta aba no momento.</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = activeChat?.id === chat.id;
              const setorBadge = getSetorBadge(chat.setor);
              const statusBadge = getStatusBadge(chat.status);

              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={clsx(
                    'p-3.5 cursor-pointer transition-all flex items-start gap-3 relative border-l-4',
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-500'
                      : 'hover:bg-gray-50/80 border-transparent'
                  )}
                >
                  {/* Avatar com Inicial */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                    {(chat.push_name || chat.phone_number || 'C').charAt(0).toUpperCase()}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="font-semibold text-gray-900 text-xs truncate">
                        {chat.push_name || chat.phone_number}
                      </h3>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500 truncate mb-1.5">
                      {chat.last_message || 'Sem mensagens'}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={clsx('px-1.5 py-0.5 rounded-md text-[9px] font-semibold border', statusBadge.color)}>
                        {statusBadge.label}
                      </span>
                      {chat.setor && (
                        <span className={clsx('px-1.5 py-0.5 rounded-md text-[9px] font-medium border', setorBadge.color)}>
                          {setorBadge.label}
                        </span>
                      )}
                      {chat.assigned_to && (
                        <span className="text-[9px] text-gray-400 flex items-center gap-0.5 ml-auto">
                          <User className="w-2.5 h-2.5" />
                          {chat.assigned_to}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= COLUNA DIREITA: JANELA DE CHAT ================= */}
      {activeChat ? (
        <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
          {/* Header do Chat */}
          <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                {(activeChat.push_name || activeChat.phone_number || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 text-sm">
                    {activeChat.push_name || 'Cliente WhatsApp'}
                  </h2>
                  <span className="text-xs text-gray-400 font-medium">({activeChat.phone_number})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold border', getStatusBadge(activeChat.status).color)}>
                    {getStatusBadge(activeChat.status).label}
                  </span>
                  {activeChat.assigned_to && (
                    <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      Atendido por {activeChat.assigned_to}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-2">
              {activeChat.status !== 'em_atendimento' && activeChat.status !== 'finalizado' && (
                <button
                  onClick={handleAssign}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Assumir Chat
                </button>
              )}

              {activeChat.status !== 'finalizado' && (
                <>
                  <button
                    onClick={() => setTransferModalOpen(true)}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                    Transferir
                  </button>

                  <button
                    onClick={handleClose}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
                    Finalizar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Feed de Mensagens */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/40">
            {loadingMessages ? (
              <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                Carregando histórico...
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                Nenhuma mensagem registrada nesta conversa ainda.
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.from_me;
                return (
                  <div
                    key={msg.id}
                    className={clsx(
                      'flex flex-col max-w-[75%]',
                      isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                    )}
                  >
                    <div
                      className={clsx(
                        'p-3 rounded-2xl text-xs shadow-sm whitespace-pre-wrap leading-relaxed',
                        isMe
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                      )}
                    >
                      {msg.text}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 px-1">
                      {isMe && <span className="font-semibold text-emerald-700">{msg.sender_name || 'Atendente'} • </span>}
                      <span>{new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Banner se Finalizado */}
          {activeChat.status === 'finalizado' ? (
            <div className="p-3 bg-gray-100 text-center text-xs text-gray-500 font-medium border-t border-gray-200">
              Esta conversa foi finalizada. Para enviar uma mensagem, assuma o atendimento novamente.
            </div>
          ) : (
            /* Input de Mensagem */
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                placeholder="Digite sua resposta..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || sending}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Estado Vazio */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
            <MessageSquare className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h2 className="text-base font-bold text-gray-800 mb-1">Central de Atendimento WhatsApp Lume</h2>
          <p className="text-xs text-gray-500 max-w-sm">
            Selecione uma conversa na lista à esquerda para visualizar o histórico de mensagens e responder ao cliente em tempo real.
          </p>
        </div>
      )}

      {/* MODAL DE TRANSFERÊNCIA DE SETOR */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                Transferir Setor
              </h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Selecione o setor para onde deseja encaminhar este atendimento:
            </p>

            <div className="space-y-2">
              {SETORES.map((setor) => (
                <button
                  key={setor.id}
                  onClick={() => handleTransfer(setor.id)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-xs font-semibold text-gray-800 transition-all flex items-center justify-between"
                >
                  <span>{setor.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
