import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Send, CheckCircle2, Phone, FileText, RefreshCw, MessageSquare, ExternalLink, User } from 'lucide-react';
import clsx from 'clsx';
import { whatsappService } from '../services/whatsappService';
import { supabase } from '../lib/supabase';

const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 13 && clean.startsWith('55')) {
        return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 12 && clean.startsWith('55')) {
        return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    if (clean.length === 11) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return phone;
};

const normalizeBrPhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
};

const buildDefaultBudgetMessage = (cData, items, total) => {
    const clientName = cData?.name || 'Cliente';
    const installationVal = parseFloat(cData?.installationValue) || 0;
    const itemsSummary = (items || [])
        .map(item => `• *${item.quantity}x ${(item.name || '').trim()}* (R$ ${(item.unitPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un)`)
        .join('\n');

    const subtotalPix = (items || []).reduce((sum, item) => sum + (Math.round((item.unitPrice || 0) * 0.9 * 100) / 100 * item.quantity), 0);
    const installationPix = Math.round(installationVal * 0.9 * 100) / 100;
    const totalPix = subtotalPix + installationPix;
    const signalPix = totalPix / 2;
    const cardInstallment = (total || 0) / 6;

    return `Olá, *${clientName}*!
Segue o orçamento da *LUME Acrílicos & Design*:

*Itens do Orçamento:*
${itemsSummary}
${installationVal > 0 ? `🛠️ *Instalação:* R$ ${installationVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}
*Valor Total:* R$ ${(total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

*Condições de Pagamento:*
💵 *À Vista (PIX com 10% de desconto):* R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   ↳ Sinal de 50% (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) + Saldo na Retirada (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})

💳 *Cartão de Crédito (Sem Juros):* 6x de R$ ${cardInstallment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cData?.hasBoleto ? `\n📄 *Boleto Bancário (Faturado):* R$ ${(total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cData.boletoDdl ? ` (${cData.boletoDdl} DDL)` : ''}` : ''}

⏱️ *Prazo de Produção:* 10 dias úteis (a partir da aprovação do sinal).

📍 *Retirada:*
${installationVal > 0
        ? `Os pedidos devem ser retirados no endereço:\nRua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba – SP\nCEP: 13.347-458`
        : `Entrega e instalação não inclusas, os pedidos devem ser retirados no endereço:\nRua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba – SP\nCEP: 13.347-458\n*Não fazemos instalação.*`
    }`;
};

const SendBudgetWhatsAppModal = ({
    isOpen,
    onClose,
    budgetPayload,
    clientesCadastrados = [],
    currentUserName = 'Atendente',
    onGeneratePdf,
    onGoToWhatsApp
}) => {
    const [chats, setChats] = useState([]);
    const [loadingChats, setLoadingChats] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState(null); // { id?, name, phone, remote_jid?, chatObj?, source }
    const [messageText, setMessageText] = useState('');
    const [includePdfLink, setIncludePdfLink] = useState(true);
    const [signMessage, setSignMessage] = useState(true);
    const [sendingStep, setSendingStep] = useState(''); // '' | 'pdf' | 'sending' | 'done'
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!isOpen || !budgetPayload) return;

        const { clientData, items, total } = budgetPayload;
        setMessageText(buildDefaultBudgetMessage(clientData, items, total));
        setIncludePdfLink(true);
        setSignMessage(true);
        setSendingStep('');
        setErrorMsg('');
        setSearchQuery('');
        setSelectedContact(null);

        const loadContacts = async () => {
            setLoadingChats(true);
            try {
                const waChats = await whatsappService.getChats();
                setChats(waChats || []);

                // Tenta pré-selecionar automaticamente o contato correspondente ao orçamento
                const targetPhone = normalizeBrPhone(clientData?.phone);
                const targetName = (clientData?.name || '').trim().toLowerCase();

                let autoMatch = null;
                if (targetPhone && targetPhone.length >= 10) {
                    const last8 = targetPhone.slice(-8);
                    const matchedChat = (waChats || []).find(c =>
                        (c.phone_number || '').replace(/\D/g, '').endsWith(last8)
                    );
                    if (matchedChat) {
                        autoMatch = {
                            id: matchedChat.id,
                            name: matchedChat.push_name || formatPhoneDisplay(matchedChat.phone_number),
                            phone: matchedChat.phone_number,
                            remote_jid: matchedChat.remote_jid,
                            chatObj: matchedChat,
                            source: 'whatsapp'
                        };
                    } else {
                        autoMatch = {
                            name: clientData?.name || formatPhoneDisplay(targetPhone),
                            phone: targetPhone,
                            source: 'orcamento'
                        };
                    }
                } else if (targetName.length >= 3) {
                    const matchedChat = (waChats || []).find(c =>
                        (c.push_name || '').toLowerCase().includes(targetName)
                    );
                    if (matchedChat) {
                        autoMatch = {
                            id: matchedChat.id,
                            name: matchedChat.push_name || formatPhoneDisplay(matchedChat.phone_number),
                            phone: matchedChat.phone_number,
                            remote_jid: matchedChat.remote_jid,
                            chatObj: matchedChat,
                            source: 'whatsapp'
                        };
                    }
                }

                if (autoMatch) setSelectedContact(autoMatch);
            } catch (err) {
                console.error('Erro ao carregar contatos do WhatsApp:', err);
            } finally {
                setLoadingChats(false);
            }
        };

        loadContacts();
    }, [isOpen, budgetPayload]);

    // Lista unificada: conversas do WhatsApp + clientes cadastrados que não estão no WhatsApp
    const allContacts = useMemo(() => {
        const list = [];
        const seenLast8 = new Set();

        (chats || []).forEach(c => {
            const clean = String(c.phone_number || '').replace(/\D/g, '');
            if (!clean) return;
            const last8 = clean.slice(-8);
            seenLast8.add(last8);
            list.push({
                key: `wa_${c.id}`,
                id: c.id,
                name: c.push_name || formatPhoneDisplay(clean),
                phone: clean,
                remote_jid: c.remote_jid,
                profile_pic_url: c.profile_pic_url,
                last_message: c.last_message,
                chatObj: c,
                source: 'whatsapp'
            });
        });

        (clientesCadastrados || []).forEach((cli, idx) => {
            const clean = normalizeBrPhone(cli.phone);
            if (!clean || clean.length < 10) return;
            const last8 = clean.slice(-8);
            if (seenLast8.has(last8)) return;
            seenLast8.add(last8);
            list.push({
                key: `cli_${cli.id || idx}`,
                name: cli.name || formatPhoneDisplay(clean),
                phone: clean,
                source: 'cliente'
            });
        });

        return list;
    }, [chats, clientesCadastrados]);

    const filteredContacts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        const qDigits = q.replace(/\D/g, '');
        if (!q) return allContacts.slice(0, 50);
        return allContacts.filter(c => {
            const matchName = (c.name || '').toLowerCase().includes(q);
            const matchPhone = qDigits.length >= 3 && (c.phone || '').includes(qDigits);
            return matchName || matchPhone;
        }).slice(0, 50);
    }, [allContacts, searchQuery]);

    const typedDigits = searchQuery.replace(/\D/g, '');
    const canUseTypedNumber = typedDigits.length >= 10 && typedDigits.length <= 13;

    if (!isOpen || !budgetPayload) return null;

    const handleSendDirect = async () => {
        if (!selectedContact || !selectedContact.phone) {
            setErrorMsg('Selecione um contato ou digite um número de WhatsApp válido.');
            return;
        }
        if (!messageText.trim()) {
            setErrorMsg('A mensagem não pode estar vazia.');
            return;
        }

        setErrorMsg('');
        let finalMessage = messageText.trim();

        try {
            if (includePdfLink && onGeneratePdf) {
                setSendingStep('pdf');
                const pdfUrl = await onGeneratePdf();
                if (pdfUrl) {
                    finalMessage += `\n\n📄 *Visualize ou baixe o PDF completo aqui:*\n${pdfUrl}`;
                }
            }

            setSendingStep('sending');
            const normalizedPhone = normalizeBrPhone(selectedContact.phone);
            let targetChat = selectedContact.chatObj;

            // Se ainda não existe conversa no WhatsApp do sistema, busca ou cria agora
            if (!targetChat) {
                const remoteJid = `${normalizedPhone}@s.whatsapp.net`;
                const { data: existingChat } = await supabase
                    .from('whatsapp_chats')
                    .select('*')
                    .or(`remote_jid.eq.${remoteJid},phone_number.eq.${normalizedPhone}`)
                    .maybeSingle();

                if (existingChat) {
                    targetChat = existingChat;
                } else {
                    const { data: createdChat, error: createErr } = await supabase
                        .from('whatsapp_chats')
                        .insert([{
                            remote_jid: remoteJid,
                            phone_number: normalizedPhone,
                            push_name: selectedContact.name || formatPhoneDisplay(normalizedPhone),
                            status: 'em_atendimento',
                            assigned_to: currentUserName,
                            last_message: 'Orçamento enviado',
                            updated_at: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (createErr) throw createErr;
                    targetChat = createdChat;
                }
            }

            await whatsappService.sendMessage(
                targetChat,
                finalMessage,
                signMessage ? currentUserName : null
            );

            setSendingStep('done');
        } catch (err) {
            console.error('Erro ao enviar orçamento pelo WhatsApp do sistema:', err);
            setErrorMsg(err?.message || 'Erro ao enviar orçamento. Tente novamente.');
            setSendingStep('');
        }
    };

    const handleFallbackWhatsAppWeb = async () => {
        let finalMessage = messageText.trim();
        const waWindow = window.open('about:blank', '_blank');
        try {
            if (includePdfLink && onGeneratePdf) {
                setSendingStep('pdf');
                const pdfUrl = await onGeneratePdf();
                if (pdfUrl) {
                    finalMessage += `\n\n📄 *Visualize ou baixe o PDF completo aqui:*\n${pdfUrl}`;
                }
            }
            const phoneParam = selectedContact?.phone ? `phone=${normalizeBrPhone(selectedContact.phone)}&` : '';
            const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(finalMessage)}`;
            if (waWindow && !waWindow.closed) {
                waWindow.location.href = waUrl;
            } else {
                window.open(waUrl, '_blank');
            }
            setSendingStep('');
            onClose();
        } catch (err) {
            if (waWindow && !waWindow.closed) waWindow.close();
            setErrorMsg(err?.message || 'Erro ao gerar PDF para WhatsApp Web.');
            setSendingStep('');
        }
    };

    const isBusy = sendingStep === 'pdf' || sendingStep === 'sending';

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !isBusy && onClose()}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/15 rounded-xl">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold leading-tight">Enviar Orçamento pelo WhatsApp do Sistema</h3>
                            <p className="text-[11px] text-emerald-100">
                                Escolha o contato ou digite o número — envia direto pela central sem abrir WhatsApp Web.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo */}
                {sendingStep === 'done' ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-gray-800">Orçamento enviado com sucesso!</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                Enviado para <strong className="text-gray-800">{selectedContact?.name}</strong> ({formatPhoneDisplay(selectedContact?.phone)}) e registrado na conversa do WhatsApp do sistema.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            {onGoToWhatsApp && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onGoToWhatsApp();
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Abrir WhatsApp do Sistema
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-y-auto flex-1">
                        {/* Coluna Esquerda: Seleção de Contato */}
                        <div className="p-4 flex flex-col gap-3 min-h-[340px] max-h-[60vh]">
                            <div>
                                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1.5">
                                    1. Escolha o Contato ou Número
                                </label>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar nome ou digitar telefone com DDD..."
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Contato atualmente selecionado */}
                            {selectedContact && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold uppercase text-emerald-600 block">Destinatário selecionado</span>
                                        <p className="text-xs font-bold text-gray-800 truncate">{selectedContact.name}</p>
                                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {formatPhoneDisplay(selectedContact.phone)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedContact(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                                        title="Trocar destinatário"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Opção de usar o número digitado manualmente */}
                            {canUseTypedNumber && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const norm = normalizeBrPhone(typedDigits);
                                        setSelectedContact({
                                            name: budgetPayload.clientData?.name || formatPhoneDisplay(norm),
                                            phone: norm,
                                            source: 'manual'
                                        });
                                    }}
                                    className="w-full p-2.5 text-left rounded-xl border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-center gap-2 text-xs"
                                >
                                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-bold text-emerald-700 block">Usar número digitado</span>
                                        <span className="text-[11px] text-gray-600">{formatPhoneDisplay(normalizeBrPhone(typedDigits))}</span>
                                    </div>
                                </button>
                            )}

                            {/* Lista de contatos */}
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                                {loadingChats ? (
                                    <div className="py-10 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                                        Carregando contatos do WhatsApp...
                                    </div>
                                ) : filteredContacts.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-gray-400">
                                        Nenhum contato encontrado. Você pode digitar o número com DDD acima.
                                    </div>
                                ) : (
                                    filteredContacts.map(c => {
                                        const isSelected = selectedContact?.phone === c.phone;
                                        return (
                                            <button
                                                key={c.key}
                                                type="button"
                                                onClick={() => setSelectedContact(c)}
                                                className={clsx(
                                                    "w-full p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5",
                                                    isSelected
                                                        ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300"
                                                        : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                                                )}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                                                    {c.profile_pic_url ? (
                                                        <img src={c.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-xs font-bold text-gray-800 truncate">{c.name}</span>
                                                        <span className={clsx(
                                                            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0",
                                                            c.source === 'whatsapp'
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-indigo-100 text-indigo-700"
                                                        )}>
                                                            {c.source === 'whatsapp' ? 'WhatsApp' : 'Cliente'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10.5px] text-gray-500 block truncate">
                                                        {formatPhoneDisplay(c.phone)}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Coluna Direita: Mensagem & Opções */}
                        <div className="p-4 flex flex-col gap-3">
                            <label className="block text-[11px] font-bold uppercase text-gray-500">
                                2. Mensagem do Orçamento (editável)
                            </label>
                            <textarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                rows={11}
                                disabled={isBusy}
                                className="w-full flex-1 p-3 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-sans leading-relaxed bg-gray-50/60"
                            />

                            <div className="space-y-1.5 pt-1">
                                <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includePdfLink}
                                        onChange={(e) => setIncludePdfLink(e.target.checked)}
                                        disabled={isBusy}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                    Gerar e anexar link do PDF completo do orçamento
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={signMessage}
                                        onChange={(e) => setSignMessage(e.target.checked)}
                                        disabled={isBusy}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    Assinar mensagem com meu nome ({currentUserName})
                                </label>
                            </div>

                            {errorMsg && (
                                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                                    {errorMsg}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Rodapé */}
                {sendingStep !== 'done' && (
                    <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={handleFallbackWhatsAppWeb}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir no WhatsApp Web (alternativo)
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-200/70 hover:bg-gray-200 transition-colors disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isBusy || !selectedContact}
                                onClick={handleSendDirect}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isBusy ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        {sendingStep === 'pdf' ? 'Gerando PDF...' : 'Enviando...'}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Enviar pelo WhatsApp do Sistema
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SendBudgetWhatsAppModal;
