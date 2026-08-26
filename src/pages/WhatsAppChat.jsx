import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Search, Send, UserCheck, CheckCircle2, 
  Clock, User, RefreshCw, Filter, CheckCheck, ArrowRightLeft,
  AlertCircle, Building, Phone, ChevronRight, Download, Paperclip, X
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../data/users';

const SETORES = [
  { id: 'vendas', label: 'Vendas / Orçamentos', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'projetos', label: 'Projetos', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'pedidos', label: 'Dúvidas de Pedidos', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'financeiro', label: 'Financeiro', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'outros', label: 'Outros', color: 'bg-gray-100 text-gray-800 border-gray-200' }
];

export default function WhatsAppChat() {
  const { currentUser, usersList } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const userDisplayName = currentUser?.name || currentUser?.login || '';
  const [filterTab, setFilterTab] = useState('todas'); // 'aguardando', 'todas', 'finalizados'
  const [attendantFilter, setAttendantFilter] = useState(userDisplayName || 'todos');
  const [subFilter, setSubFilter] = useState('em_atendimento'); // 'em_atendimento', 'aguardando_retorno', 'finalizado'
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTab, setTransferTab] = useState('setor'); // 'setor' or 'usuario'


  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const openMediaInNewTab = (dataUrl) => {
    if (!dataUrl) return;
    if (dataUrl.startsWith('http')) {
      window.open(dataUrl, '_blank');
      return;
    }
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Error opening media:', err);
      // Fallback
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<img src="${dataUrl}" style="max-width: 100%;" />`);
      }
    }
  };

  // 1. Carregar Chats
 Iniciais
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

  // Lazy fetch profile pic if missing
  useEffect(() => {
    if (activeChat && !activeChat.profile_pic_url) {
      const cleanPhone = activeChat.phone_number || (activeChat.remote_jid ? activeChat.remote_jid.replace('@s.whatsapp.net', '').replace('@c.us', '') : '');
      fetch('/api/whatsapp-profile-pic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: activeChat.id, phone_number: cleanPhone })
      }).catch(err => console.error('Erro ao buscar foto:', err));
    }
  }, [activeChat?.id, activeChat?.profile_pic_url]);

  // 3. Carregar e Inscrever em Mensagens do Chat Ativo
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      const data = await whatsappService.getMessages(activeChat);
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
          filter: `remote_jid=eq.${activeChat.remote_jid}` 
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
  }, [activeChat?.id, activeChat?.remote_jid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        setSelectedFile(file);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Enviar Mensagem
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedFile) || !activeChat || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      let mediaBase64 = null;
      let mediaName = null;
      let mediaType = null;

      if (selectedFile) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        reader.readAsDataURL(selectedFile);
        const fullBase64 = await base64Promise;
        mediaBase64 = fullBase64.split(',')[1];
        mediaName = selectedFile.name;
        mediaType = selectedFile.type.startsWith('image') ? 'image' : 'document';
      }

      await whatsappService.sendMessage(activeChat, textToSend, currentUser?.name || 'Atendente', mediaBase64, mediaName, mediaType);
      
      removeFile();
      const refreshed = await whatsappService.getMessages(activeChat);
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

  // Alterar Status Direto
  const handleSetStatus = async (newStatus) => {
    if (!activeChat) return;
    const success = await whatsappService.updateStatus(activeChat.id, newStatus);
    if (success) {
      setActiveChat({ ...activeChat, status: newStatus });
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

  // Transferir para Atendente específico
  const handleTransferToUser = async (userName) => {
    if (!activeChat) return;
    const success = await whatsappService.transferToUser(activeChat.id, userName);
    if (success) {
      setActiveChat({ ...activeChat, assigned_to: userName, status: 'em_atendimento' });
      setTransferModalOpen(false);
      fetchChats();
    }
  };


  const whatsappUsers = (usersList || []).filter(u => {
    const permissions = u.customPermissions || ROLE_PERMISSIONS[u.role] || {};
    return permissions.visibleTabs?.includes('whatsapp');
  });

  // Filtragem de Conversas
  const filteredChats = chats.filter((chat) => {
    const matchesSearch = 
      (chat.push_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.phone_number || '').includes(searchQuery);

    if (!matchesSearch) return false;

    // 1ª Linha: Filtros de Categoria (Aguardando / Todas / Fim)
    if (filterTab === 'aguardando') {
      // Ignora sub-filtros de status, pois devem estar obrigatoriamente aguardando
      if (chat.status !== 'aguardando_atendente' && chat.status !== 'triagem' && chat.status) return false;
    } else if (filterTab === 'finalizados') {
      if (chat.status !== 'finalizado') return false;
      // 3ª Linha: Atendentes (aplica em Fim)
      if (attendantFilter !== 'todos' && chat.assigned_to !== attendantFilter) return false;
    } else {
      // filterTab === 'todas'
      // 2ª Linha: Sub-Filtros de Atendimento
      if (subFilter === 'em_atendimento' && chat.status !== 'em_atendimento') return false;
      if (subFilter === 'aguardando_retorno' && chat.status !== 'aguardando_retorno') return false;
      if (subFilter === 'finalizado' && chat.status !== 'finalizado') return false;

      // 3ª Linha: Atendentes
      if (attendantFilter !== 'todos' && chat.assigned_to !== attendantFilter) return false;
    }

    return true;
  });

  const unreadCounts = {
    aguardando: 0,
    todas: 0,
    attendants: {}
  };

  chats.forEach(chat => {
    const unread = chat.unread_count || 0;
    if (unread > 0 && chat.status !== 'finalizado') {
      unreadCounts.todas += unread;
      
      if (chat.status === 'aguardando_atendente' || chat.status === 'triagem' || !chat.status) {
        unreadCounts.aguardando += unread;
      }
      
      if (chat.assigned_to) {
        unreadCounts.attendants[chat.assigned_to] = (unreadCounts.attendants[chat.assigned_to] || 0) + unread;
      }
    }
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
        return { label: 'Em Atendimento', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold' };
      case 'aguardando_retorno':
        return { label: 'Aguardando Retorno', color: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold' };
      case 'finalizado':
        return { label: 'Finalizado', color: 'bg-gray-100 text-gray-600 border-gray-200' };
      default:
        return { label: status || 'Novo', color: 'bg-gray-50 text-gray-600' };
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm m-4">
      {/* ================= COLUNA ESQUERDA: LISTA DE CONVERSAS ================= */}
      <div className="w-80 md:w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header Esquerdo */}
        <div className="p-4 border-b border-gray-100 space-y-2.5">
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

          {/* 1ª LINHA DE ABAS (Filtros Principais) */}
          <div className="flex p-1 bg-gray-100/80 rounded-xl text-xs font-medium text-gray-600 gap-1">
            <button
              onClick={() => { setFilterTab('aguardando'); setSubFilter('em_atendimento'); setAttendantFilter('todos'); }}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center relative',
                filterTab === 'aguardando'
                  ? 'bg-white text-red-600 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Aguardando
              {unreadCounts.aguardando > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                  {unreadCounts.aguardando}
                </span>
              )}
            </button>
            <button
              onClick={() => { setFilterTab('todas'); setSubFilter('em_atendimento'); }}
              className={clsx(
                'flex-1 py-1.5 rounded-lg transition-all text-center relative',
                filterTab === 'todas'
                  ? 'bg-white text-gray-900 font-bold shadow-sm'
                  : 'hover:text-gray-900'
              )}
            >
              Todas
              {unreadCounts.todas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                  {unreadCounts.todas}
                </span>
              )}
            </button>
            <button
              onClick={() => { setFilterTab('finalizados'); setSubFilter('finalizado'); }}
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

          {/* 2ª LINHA DE ABAS (Sub-Status de Atendimento) */}
          <div className="flex p-0.5 bg-slate-100/90 rounded-lg text-[11px] font-medium text-gray-500 gap-0.5 border border-slate-200/60">
            <button
              onClick={() => setSubFilter('em_atendimento')}
              className={clsx(
                'flex-1 py-1 rounded-md transition-all text-center leading-tight',
                subFilter === 'em_atendimento'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'hover:text-emerald-700'
              )}
            >
              Em Atendimento
            </button>
            <button
              onClick={() => setSubFilter('aguardando_retorno')}
              className={clsx(
                'flex-1 py-1 rounded-md transition-all text-center leading-tight',
                subFilter === 'aguardando_retorno'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'hover:text-amber-700'
              )}
            >
              Aguard. Retorno
            </button>
            <button
              onClick={() => setSubFilter('finalizado')}
              className={clsx(
                'flex-1 py-1 rounded-md transition-all text-center leading-tight',
                subFilter === 'finalizado'
                  ? 'bg-gray-700 text-white font-bold shadow-xs'
                  : 'hover:text-gray-900'
              )}
            >
              Finalizadas
            </button>
          </div>

          {/* 3ª LINHA DE ABAS (Atendentes) */}
          <div className="flex px-1 pb-1 gap-1 overflow-x-auto no-scrollbar items-center">
            <button
              onClick={() => setAttendantFilter('todos')}
              className={clsx(
                'px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border',
                attendantFilter === 'todos'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              Todos Atendentes
            </button>
            {whatsappUsers.map((u) => {
              const displayName = u.name || u.login;
              const isActive = attendantFilter === displayName;
              const hasUnread = unreadCounts.attendants[displayName] > 0;
              return (
                <button
                  key={u.id || u.login}
                  onClick={() => setAttendantFilter(displayName)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 relative',
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {displayName}
                  {hasUnread && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full shadow-sm animate-pulse">
                      {unreadCounts.attendants[displayName]}
                    </span>
                  )}
                </button>
              );
            })}
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
                      : chat.unread_count > 0
                        ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400'
                        : 'hover:bg-gray-50/80 border-transparent'
                  )}
                >
                    {/* Avatar (Foto ou Inicial) */}
                    {chat.profile_pic_url ? (
                      <img 
                        src={chat.profile_pic_url} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm border border-gray-100"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div className={clsx(
                      "w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-sm",
                      chat.profile_pic_url ? "hidden" : "flex"
                    )}>
                      {String(chat.push_name || chat.phone_number || 'C').charAt(0).toUpperCase()}
                    </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="font-semibold text-gray-900 text-xs truncate">
                        {chat.push_name || chat.phone_number}
                      </h3>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {(() => { try { const d = new Date(chat.updated_at); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch(e) { return ''; } })()}
                      </span>
                    </div>

                    <p className={clsx("text-[11px] truncate mb-1.5", chat.unread_count > 0 ? "text-gray-800 font-bold" : "text-gray-500")}>
                      {chat.last_message || 'Sem mensagens'}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {chat.unread_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-yellow-400 bg-yellow-200 text-yellow-900 shadow-sm animate-pulse">
                          Nova Mensagem
                        </span>
                      )}
                      <span className={clsx('px-1.5 py-0.5 rounded-md text-[9px] font-semibold border', statusBadge.color)}>
                        {statusBadge.label}
                      </span>
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
              {activeChat.profile_pic_url ? (
                <img 
                  src={activeChat.profile_pic_url} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-100"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div className={clsx(
                "w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center text-sm shadow-sm",
                activeChat.profile_pic_url ? "hidden" : "flex"
              )}>
                {String(activeChat.push_name || activeChat.phone_number || 'C').charAt(0).toUpperCase()}
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
              {(() => {
                const currentUserLogin = currentUser?.name || currentUser?.login || '';
                const isOwnedByOther = activeChat.assigned_to && activeChat.assigned_to !== currentUserLogin;
                const canAssign = isOwnedByOther || (activeChat.status !== 'em_atendimento' && activeChat.status !== 'aguardando_retorno');
                const canInteract = !isOwnedByOther && activeChat.status !== 'finalizado';

                return (
                  <>
                    {canAssign && (
                      <button
                        onClick={handleAssign}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {activeChat.status === 'finalizado' ? 'Reabrir Atendimento' : 'Puxar Atendimento'}
                      </button>
                    )}

                    {canInteract && (
                      <>
                        {activeChat.status === 'em_atendimento' ? (
                          <button
                            onClick={() => handleSetStatus('aguardando_retorno')}
                            title="Marcar que enviou orçamento/resposta e aguarda cliente"
                            className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Aguardando Retorno
                          </button>
                        ) : activeChat.status === 'aguardando_retorno' ? (
                          <button
                            onClick={() => handleSetStatus('em_atendimento')}
                            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Em Atendimento
                          </button>
                        ) : null}

                        <button
                          onClick={() => setTransferModalOpen(true)}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                          Transferir
                        </button>

                        <button
                          onClick={handleClose}
                          className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                          Finalizar
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
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
                const msgType = msg.message_type || 'text';
                const hasText = msg.text && msg.text.trim() !== '';

                const handleDownload = (base64Url, defaultName) => {
                  const link = document.createElement('a');
                  link.href = base64Url;
                  link.download = defaultName;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                };

                const renderContent = () => {
                  if (msgType === 'image' && msg.media_url) {
                    return (
                      <div className="space-y-1.5 relative group">
                        <img
                          src={msg.media_url}
                          alt="Imagem"
                          className="max-w-[240px] rounded-xl object-cover cursor-pointer"
                          onClick={() => openMediaInNewTab(msg.media_url)}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.media_url, `imagem_${msg.id || Date.now()}.jpeg`);
                          }}
                          className="absolute top-2 right-2 bg-gray-900/60 hover:bg-gray-900/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Baixar imagem"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {msg.media_caption && (
                          <p className="text-xs mt-1 whitespace-pre-wrap leading-relaxed">{msg.media_caption}</p>
                        )}
                      </div>
                    );
                  }
                  if (msgType === 'image' && !msg.media_url) {
                    return (
                      <div className="flex items-center gap-2 text-xs opacity-70 italic">
                        <span>🖼️</span>
                        <span>{msg.media_caption || 'Imagem recebida'}</span>
                      </div>
                    );
                  }
                  if (msgType === 'audio') {
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span>??</span>
                            <span className="text-xs italic opacity-80">Mensagem de voz</span>
                          </div>
                          {msg.media_url && (
                            <audio src={msg.media_url} controls className="h-8 max-w-[200px]" />
                          )}
                        </div>
                      );
                    }
                  if (msgType === 'video') {
                      return (
                        <div className="flex flex-col gap-2">
                          {msg.media_url ? (
                            <video src={msg.media_url} controls className="max-w-[240px] rounded-lg" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>??</span>
                              <span className="text-xs">{msg.media_caption || 'Video'}</span>
                            </div>
                          )}
                          {msg.media_caption && <span className="text-xs">{msg.media_caption}</span>}
                        </div>
                      );
                    }
                  if (msgType === 'document') {
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span>??</span>
                            <span className="text-xs font-semibold break-all">{msg.text || 'Documento'}</span>
                          </div>
                          {msg.media_url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(msg.media_url, msg.text || 'documento'); }}
                              className="self-start text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Baixar
                            </button>
                          )}
                        </div>
                      );
                    }
                  if (msgType === 'sticker') {
                    if (msg.media_url) {
                      return (
                        <img
                          src={msg.media_url}
                          alt="Figurinha"
                          className="w-32 h-32 object-contain drop-shadow-md cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => openMediaInNewTab(msg.media_url)}
                        />
                      );
                    }
                    return <span className="text-2xl text-gray-400 italic">🧸 Figurinha (Sem imagem)</span>;
                  }
                  // Default: text
                  return <span className="whitespace-pre-wrap leading-relaxed">{msg.text || '—'}</span>;
                };

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
                        'p-3 rounded-2xl text-xs shadow-sm',
                        isMe
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                      )}
                    >
                      {renderContent()}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 px-1">
                      {isMe && <span className="font-semibold text-emerald-700">{msg.sender_name || 'Atendente'} • </span>}
                      <span>{(() => { try { const d = new Date(msg.created_at || msg.timestamp); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } })()}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Banner se Finalizado ou de Outro Atendente */}
          {(() => {
            const currentUserLogin = currentUser?.name || currentUser?.login || '';
            const isOwnedByOther = activeChat.assigned_to && activeChat.assigned_to !== currentUserLogin;

            if (activeChat.status === 'finalizado') {
              return (
                <div className="p-3 bg-gray-100 text-center text-xs text-gray-500 font-medium border-t border-gray-200">
                  Esta conversa foi finalizada. Para enviar uma mensagem, reabra o atendimento (botão acima).
                </div>
              );
            }
            
            if (isOwnedByOther) {
              return (
                <div className="p-3 bg-amber-50 text-center text-xs text-amber-700 font-medium border-t border-amber-200">
                  Este chat está sendo atendido por {activeChat.assigned_to}. Assuma o atendimento (botão acima) para enviar mensagens.
                </div>
              );
            }

            return (
              <form onSubmit={handleSendMessage} className="flex flex-col bg-white border-t border-gray-200 relative">
                {selectedFile && (
                  <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-700">
                    <span className="font-semibold truncate max-w-[80%]">Anexo: {selectedFile.name}</span>
                    <button type="button" onClick={removeFile} className="text-indigo-400 hover:text-indigo-800 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="p-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                    title="Anexar Imagem ou PDF"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    accept="image/*,application/pdf"
                  />

                  <input
                    type="text"
                    placeholder="Digite sua resposta..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onPaste={handlePaste}
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
    
                  <button
                    type="submit"
                    disabled={(!inputMessage.trim() && !selectedFile) || sending}
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
                </div>
              </form>
            );
          })()}
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

      {/* MODAL DE TRANSFERÊNCIA */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                Transferir Atendimento
              </h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Listagem de Usuários */}
            <div className="space-y-2">
                <p className="text-xs text-gray-500">Passe o chat diretamente para um atendente — ele assumirá imediatamente:</p>
                {(usersList || [])
                  .filter(u => u.name || u.login)
                  .map((user) => {
                    const displayName = user.name || user.login;
                    const isCurrentAttendant = activeChat?.assigned_to === displayName;
                    return (
                      <button
                        key={user.id || user.login}
                        onClick={() => handleTransferToUser(displayName)}
                        disabled={isCurrentAttendant}
                        className={clsx(
                          'w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between gap-2',
                          isCurrentAttendant
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                            : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-800'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{displayName}</div>
                            {user.login && user.name && <div className="text-[10px] text-gray-400 font-normal">@{user.login}</div>}
                          </div>
                        </div>
                        {isCurrentAttendant ? (
                          <span className="text-[10px] text-emerald-600 font-bold">Atual</span>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                {(!usersList || usersList.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário cadastrado no sistema.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}












