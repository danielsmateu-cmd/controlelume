import React, { useState, useEffect, useMemo } from 'react';
import {
    GitBranch,
    Palette,
    PenTool,
    Factory,
    ArrowRight,
    ArrowLeft,
    Clock,
    User,
    Calendar,
    CheckCircle2,
    Search,
    RefreshCw,
    X,
    Package,
    AlertTriangle,
    History,
    Pencil
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = [
    {
        id: 'finalizar_arte',
        title: 'Finalizar Arte',
        subtitle: 'Aguardando criação / fechamento da arte',
        actionLabel: 'Arte Finalizada → Projeto',
        completedLabel: 'Arte Finalizada',
        icon: Palette,
        headerBg: 'bg-purple-600',
        lightBg: 'bg-purple-50/70',
        border: 'border-purple-200',
        badge: 'bg-purple-100 text-purple-700 border-purple-200',
        button: 'bg-purple-600 hover:bg-purple-700 text-white',
        nextStage: 'finalizar_corte',
        prevStage: null
    },
    {
        id: 'finalizar_corte',
        title: 'Finalizar Projeto',
        subtitle: 'Arte pronta — aguardando fechamento do projeto',
        actionLabel: 'Projeto Finalizado → Fila Produção',
        completedLabel: 'Projeto Finalizado',
        icon: PenTool,
        headerBg: 'bg-sky-600',
        lightBg: 'bg-sky-50/70',
        border: 'border-sky-200',
        badge: 'bg-sky-100 text-sky-700 border-sky-200',
        button: 'bg-sky-600 hover:bg-sky-700 text-white',
        nextStage: 'fila_producao',
        prevStage: 'finalizar_arte'
    },
    {
        id: 'fila_producao',
        title: 'Em Fila de Produção',
        subtitle: 'Projeto concluído — liberado para produção',
        actionLabel: 'Abrir na Produção',
        completedLabel: 'Em Fila de Produção',
        icon: Factory,
        headerBg: 'bg-amber-600',
        lightBg: 'bg-amber-50/70',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        button: 'bg-amber-600 hover:bg-amber-700 text-white',
        nextStage: null,
        prevStage: 'finalizar_corte'
    },
    {
        id: 'finalizados_producao',
        title: 'Finalizados na Produção',
        subtitle: 'Pedidos concluídos na aba Produção',
        actionLabel: 'Ver na Produção',
        completedLabel: 'Finalizado na Produção',
        icon: CheckCircle2,
        headerBg: 'bg-emerald-600',
        lightBg: 'bg-emerald-50/70',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        nextStage: null,
        prevStage: null
    }
];

const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatDateShort = (dateStr) => {
    if (!dateStr) return null;
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(clean + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const getDeliveryStatus = (deliveryDate) => {
    if (!deliveryDate) return null;
    const clean = deliveryDate.includes('T') ? deliveryDate.split('T')[0] : deliveryDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(clean + 'T00:00:00');
    if (isNaN(target.getTime())) return null;
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { type: 'overdue', label: `Atrasado (${Math.abs(diffDays)}d)`, cls: 'bg-red-100 text-red-700 border-red-200' };
    if (diffDays === 0) return { type: 'urgent', label: 'Entrega Hoje', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (diffDays <= 3) return { type: 'urgent', label: `Entrega ${formatDateShort(clean)}`, cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    return { type: 'ok', label: `Entrega ${formatDateShort(clean)}`, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
};

const isOrderFinishedInProduction = (budget) => {
    const items = budget.items || [];
    if (items.length > 0 && items.every(i => i.concluido)) return true;
    return false;
};

const Processos = ({ readOnly = false, setActiveTab }) => {
    const { currentUser } = useAuth();
    const currentUserName = currentUser?.name || currentUser?.login || 'Usuário';

    const [budgets, setBudgets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllFinished, setShowAllFinished] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const [deliveryModal, setDeliveryModal] = useState(null); // { budget, date }
    const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
    const [tempDeliveryDate, setTempDeliveryDate] = useState('');

    const loadBudgets = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await api.getBudgets();
            setBudgets(data || []);
        } catch (err) {
            console.error('Erro ao carregar processos:', err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBudgets();

        const channel = supabase
            .channel('processos_budgets_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
                loadBudgets(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filtra apenas orçamentos Aprovados / Faturados
    const processOrders = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();

        return budgets
            .filter(b => b.status === 'Aprovado' || b.status === 'Faturado')
            .filter(b => {
                if (!q) return true;
                const nameMatch = (b.clientData?.name || '').toLowerCase().includes(q);
                const idMatch = String(b.id).includes(q);
                const itemMatch = (b.items || []).some(i => (i.name || '').toLowerCase().includes(q));
                return nameMatch || idMatch || itemMatch;
            })
            .sort((a, b) => {
                // Ordena por data de entrega mais próxima primeiro, depois por mais recente
                const dA = a.deliveryDate ? new Date(a.deliveryDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                const dB = b.deliveryDate ? new Date(b.deliveryDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                if (dA !== dB) return dA - dB;
                return new Date(b.date) - new Date(a.date);
            });
    }, [budgets, searchQuery]);

    const getOrderStage = (budget) => {
        if (isOrderFinishedInProduction(budget)) return 'finalizados_producao';
        const st = budget.clientData?.processo?.stage;
        if (st && STAGES.some(s => s.id === st)) return st;
        return 'finalizar_arte';
    };

    const handleMoveStage = async (budget, targetStageId, isRollback = false, confirmedDeliveryDate = null) => {
        if (readOnly || !budget || !targetStageId) return;

        // Ao sair de Finalizar Projeto para Em Fila de Produção, exige/confirma Data de Entrega
        if (!isRollback && targetStageId === 'fila_producao' && !confirmedDeliveryDate) {
            const existingDate = budget.deliveryDate
                ? (budget.deliveryDate.includes('T') ? budget.deliveryDate.split('T')[0] : budget.deliveryDate)
                : '';
            setDeliveryModal({ budget, date: existingDate });
            return;
        }

        const currentStageObj = STAGES.find(s => s.id === getOrderStage(budget));
        const targetStageObj = STAGES.find(s => s.id === targetStageId);
        if (!targetStageObj) return;

        setUpdatingId(budget.id);
        try {
            const nowIso = new Date().toISOString();
            const existingProcesso = budget.clientData?.processo || {
                stage: 'finalizar_arte',
                history: budget.clientData?.approvedBy
                    ? [{
                        stage: 'aprovado',
                        label: `Orçamento ${budget.status}`,
                        user: budget.clientData.approvedBy,
                        at: budget.clientData.approvedAt || budget.date
                    }]
                    : []
            };

            const actionLabel = isRollback
                ? `Retornou para ${targetStageObj.title}`
                : `${currentStageObj?.completedLabel || 'Etapa concluída'} → ${targetStageObj.title}${confirmedDeliveryDate ? ` (Entrega: ${formatDateShort(confirmedDeliveryDate)})` : ''}`;

            const newStepLog = {
                stage: targetStageId,
                fromStage: currentStageObj?.id || null,
                label: actionLabel,
                user: currentUserName,
                at: nowIso,
                isRollback
            };

            const nextStagesMeta = {
                ...(existingProcesso.stages || {})
            };

            if (!isRollback && currentStageObj?.id === 'finalizar_arte' && targetStageId === 'finalizar_corte') {
                nextStagesMeta.arteFinalizada = { user: currentUserName, at: nowIso };
            } else if (!isRollback && currentStageObj?.id === 'finalizar_corte' && targetStageId === 'fila_producao') {
                nextStagesMeta.corteFinalizado = { user: currentUserName, at: nowIso };
            }

            const nextProcesso = {
                ...existingProcesso,
                stage: targetStageId,
                stages: nextStagesMeta,
                history: [...(existingProcesso.history || []), newStepLog]
            };

            const finalDeliveryDate = confirmedDeliveryDate || budget.deliveryDate || null;

            const updatedClientData = {
                ...(budget.clientData || {}),
                ...(confirmedDeliveryDate ? { deliveryDate: confirmedDeliveryDate } : {}),
                processo: nextProcesso
            };

            await api.updateBudget(budget.id, {
                ...(confirmedDeliveryDate ? { deliveryDate: confirmedDeliveryDate } : {}),
                clientData: updatedClientData
            });

            setBudgets(prev => prev.map(b =>
                b.id === budget.id
                    ? { ...b, deliveryDate: finalDeliveryDate, clientData: updatedClientData }
                    : b
            ));

            if (selectedBudget?.id === budget.id) {
                setSelectedBudget({ ...budget, deliveryDate: finalDeliveryDate, clientData: updatedClientData });
            }
        } catch (err) {
            console.error('Erro ao mover etapa do processo:', err);
            alert('Não foi possível atualizar a etapa do pedido. Tente novamente.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUpdateDeliveryDate = async (budget, newDate) => {
        if (readOnly || !budget) return;
        setUpdatingId(budget.id);
        try {
            const nowIso = new Date().toISOString();
            const existingProcesso = budget.clientData?.processo || {
                stage: getOrderStage(budget),
                history: []
            };
            const nextProcesso = {
                ...existingProcesso,
                history: [
                    ...(existingProcesso.history || []),
                    {
                        stage: getOrderStage(budget),
                        label: newDate
                            ? `Data de entrega alterada para ${formatDateShort(newDate)}`
                            : 'Data de entrega removida',
                        user: currentUserName,
                        at: nowIso
                    }
                ]
            };
            const updatedClientData = {
                ...(budget.clientData || {}),
                deliveryDate: newDate || null,
                processo: nextProcesso
            };

            await api.updateBudget(budget.id, {
                deliveryDate: newDate || null,
                clientData: updatedClientData
            });

            setBudgets(prev => prev.map(b =>
                b.id === budget.id
                    ? { ...b, deliveryDate: newDate || null, clientData: updatedClientData }
                    : b
            ));
            if (selectedBudget?.id === budget.id) {
                setSelectedBudget({ ...budget, deliveryDate: newDate || null, clientData: updatedClientData });
            }
            setEditingDeliveryDate(false);
        } catch (err) {
            console.error('Erro ao alterar data de entrega:', err);
            alert('Não foi possível salvar a data de entrega.');
        } finally {
            setUpdatingId(null);
        }
    };

    const groupedByStage = useMemo(() => {
        const map = {
            finalizar_arte: [],
            finalizar_corte: [],
            fila_producao: [],
            finalizados_producao: []
        };
        processOrders.forEach(order => {
            const st = getOrderStage(order);
            if (map[st]) map[st].push(order);
        });
        // Ordena finalizados do mais recente para o mais antigo
        map.finalizados_producao.sort((a, b) => {
            const tA = new Date(a.clientData?.finishedAt || a.clientData?.processo?.stages?.producaoFinalizada?.at || a.clientData?.updatedAt || a.date || 0).getTime();
            const tB = new Date(b.clientData?.finishedAt || b.clientData?.processo?.stages?.producaoFinalizada?.at || b.clientData?.updatedAt || b.date || 0).getTime();
            return tB - tA;
        });
        return map;
    }, [processOrders]);

    return (
        <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <GitBranch className="w-6 h-6 text-indigo-600" />
                        Processos de Produção
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Acompanhe cada pedido aprovado desde a arte até a fila de produção, com registro de responsável e horário.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Busca */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar cliente, item ou #ID..."
                            className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-56"
                        />
                    </div>

                    <button
                        onClick={() => loadBudgets()}
                        className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-colors"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Colunas Kanban */}
            {isLoading ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                    Carregando pedidos em processo...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                    {STAGES.map((stage) => {
                        const StageIcon = stage.icon;
                        const allItems = groupedByStage[stage.id] || [];
                        const isFinishedCol = stage.id === 'finalizados_producao';
                        const items = (isFinishedCol && !showAllFinished && !searchQuery.trim())
                            ? allItems.slice(0, 15)
                            : allItems;

                        return (
                            <div
                                key={stage.id}
                                className={clsx(
                                    "rounded-2xl border overflow-hidden flex flex-col min-h-[420px]",
                                    stage.lightBg,
                                    stage.border
                                )}
                            >
                                {/* Cabeçalho da Coluna */}
                                <div className={clsx("px-4 py-3 text-white flex items-center justify-between", stage.headerBg)}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 bg-white/20 rounded-lg">
                                            <StageIcon className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm uppercase tracking-wide leading-tight">{stage.title}</h3>
                                            <p className="text-[10px] text-white/80 leading-tight">{stage.subtitle}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-extrabold">
                                        {allItems.length}
                                    </span>
                                </div>

                                {/* Lista de Pedidos */}
                                <div className="p-3 space-y-3 flex-1">
                                    {items.length === 0 ? (
                                        <div className="py-10 text-center text-xs text-gray-400 italic">
                                            Nenhum pedido nesta etapa
                                        </div>
                                    ) : (
                                        items.map((budget) => {
                                            const delivery = getDeliveryStatus(budget.deliveryDate);
                                            const processo = budget.clientData?.processo || {};
                                            const arteMeta = processo.stages?.arteFinalizada;
                                            const corteMeta = processo.stages?.corteFinalizado;
                                            const approvedBy = budget.clientData?.approvedBy || budget.clientData?.updatedBy;
                                            const approvedAt = budget.clientData?.approvedAt || budget.clientData?.updatedAt || budget.date;
                                            const finishedProd = isOrderFinishedInProduction(budget);
                                            const totalItens = budget.items?.length || 0;
                                            const concluidosProd = (budget.items || []).filter(i => i.concluido).length;
                                            const isBusy = updatingId === budget.id;

                                            return (
                                                <div
                                                    key={budget.id}
                                                    onClick={() => {
                                                        setEditingDeliveryDate(false);
                                                        setSelectedBudget(budget);
                                                    }}
                                                    className="bg-white rounded-xl border border-gray-200/90 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer overflow-hidden"
                                                >
                                                    <div className="p-3.5 space-y-2.5">
                                                        {/* Topo do Card: Cliente + Prazo */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-bold text-gray-400">#{budget.id}</span>
                                                                    {finishedProd && (
                                                                        <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.2 rounded">
                                                                            Concluído
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 className="font-bold text-gray-800 text-sm truncate" title={budget.clientData?.name}>
                                                                    {budget.clientData?.name || 'Cliente sem nome'}
                                                                </h4>
                                                            </div>
                                                            {delivery && (
                                                                <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1", delivery.cls)}>
                                                                    {delivery.type === 'overdue' && <AlertTriangle className="w-3 h-3" />}
                                                                    {delivery.label}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Itens resumidos */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {(budget.items || []).slice(0, 3).map((item, idx) => (
                                                                <span
                                                                    key={item.id || idx}
                                                                    className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 px-2 py-0.5 rounded border border-slate-200/70 text-[11px]"
                                                                >
                                                                    <strong className="text-indigo-600">{item.quantity}x</strong>
                                                                    <span className="truncate max-w-[140px]">{item.name}</span>
                                                                </span>
                                                            ))}
                                                            {(budget.items?.length || 0) > 3 && (
                                                                <span className="text-[10px] font-semibold text-gray-400 px-1.5 py-0.5">
                                                                    +{budget.items.length - 3} item(ns)
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Trilha de Responsáveis / Datas */}
                                                        <div className="pt-2 border-t border-gray-100 space-y-1 text-[10.5px] text-gray-500">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                                                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                                    Aprovado: {approvedBy || '—'}
                                                                </span>
                                                                <span className="text-gray-400 shrink-0">{formatDateTime(approvedAt)}</span>
                                                            </div>

                                                            {arteMeta && (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="flex items-center gap-1 text-purple-700 font-semibold">
                                                                        <Palette className="w-3 h-3 shrink-0" />
                                                                        Arte: {arteMeta.user}
                                                                    </span>
                                                                    <span className="text-gray-400 shrink-0">{formatDateTime(arteMeta.at)}</span>
                                                                </div>
                                                            )}

                                                            {corteMeta && (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="flex items-center gap-1 text-sky-700 font-semibold">
                                                                        <PenTool className="w-3 h-3 shrink-0" />
                                                                        Projeto: {corteMeta.user}
                                                                    </span>
                                                                    <span className="text-gray-400 shrink-0">{formatDateTime(corteMeta.at)}</span>
                                                                </div>
                                                            )}

                                                            {finishedProd && (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                                                                        <Factory className="w-3 h-3 shrink-0" />
                                                                        Produção: {processo.stages?.producaoFinalizada?.user || budget.clientData?.finishedBy || 'Concluído'}
                                                                    </span>
                                                                    <span className="text-gray-400 shrink-0">
                                                                        {formatDateTime(processo.stages?.producaoFinalizada?.at || budget.clientData?.finishedAt)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Progresso na Produção (se já estiver na fila) */}
                                                        {stage.id === 'fila_producao' && totalItens > 0 && (
                                                            <div className="pt-1">
                                                                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                                                    <span>Progresso na Produção</span>
                                                                    <span className="font-bold">{concluidosProd}/{totalItens} itens</span>
                                                                </div>
                                                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-emerald-500 transition-all"
                                                                        style={{ width: `${Math.round((concluidosProd / totalItens) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Rodapé de Ação Rápida */}
                                                    {!readOnly && stage.nextStage && (
                                                        <div className="px-3.5 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                                            {stage.prevStage ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={isBusy}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveStage(budget, stage.prevStage, true);
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
                                                                    title="Voltar para etapa anterior"
                                                                >
                                                                    <ArrowLeft className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : <span />}

                                                            <button
                                                                type="button"
                                                                disabled={isBusy}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMoveStage(budget, stage.nextStage, false);
                                                                }}
                                                                className={clsx(
                                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50",
                                                                    stage.button
                                                                )}
                                                            >
                                                                <span>{isBusy ? 'Movendo...' : stage.actionLabel}</span>
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {stage.id === 'fila_producao' && (
                                                        <div className="px-3.5 py-2 bg-amber-50/50 border-t border-amber-100 flex items-center justify-between gap-2">
                                                            {!readOnly && stage.prevStage ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={isBusy}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveStage(budget, stage.prevStage, true);
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                                                                    title="Voltar para Finalizar Projeto"
                                                                >
                                                                    <ArrowLeft className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : <span />}

                                                            {setActiveTab && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveTab('contas');
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs"
                                                                >
                                                                    <Factory className="w-3.5 h-3.5" />
                                                                    <span>Ver na Produção</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}

                                    {isFinishedCol && !searchQuery.trim() && allItems.length > 15 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllFinished(v => !v)}
                                            className="w-full py-2 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-colors"
                                        >
                                            {showAllFinished
                                                ? 'Mostrar apenas os 15 mais recentes'
                                                : `Mostrar todos os ${allItems.length} finalizados`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Detalhes e Histórico do Pedido */}
            {selectedBudget && (() => {
                const currentStageId = getOrderStage(selectedBudget);
                const currentStageObj = STAGES.find(s => s.id === currentStageId);
                const history = selectedBudget.clientData?.processo?.history || [];
                const delivery = getDeliveryStatus(selectedBudget.deliveryDate);
                const isBusy = updatingId === selectedBudget.id;

                return (
                    <div
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
                        onClick={() => setSelectedBudget(null)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[88vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header Modal */}
                            <div className={clsx("px-5 py-4 text-white flex items-center justify-between", currentStageObj?.headerBg || 'bg-indigo-600')}>
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-white/80 font-semibold">
                                        <span>Pedido #{selectedBudget.id}</span>
                                        <span>•</span>
                                        <span>Etapa: {currentStageObj?.title}</span>
                                    </div>
                                    <h3 className="text-lg font-bold mt-0.5">{selectedBudget.clientData?.name || 'Cliente sem nome'}</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedBudget(null)}
                                    className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body Modal */}
                            <div className="p-5 overflow-y-auto space-y-5 flex-1">
                                {/* Info Rápida */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Aprovado por</span>
                                        <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                                            <User className="w-3.5 h-3.5 text-emerald-600" />
                                            {selectedBudget.clientData?.approvedBy || selectedBudget.clientData?.updatedBy || '—'}
                                        </span>
                                        <span className="text-[11px] text-gray-500 block mt-0.5">
                                            {formatDateTime(selectedBudget.clientData?.approvedAt || selectedBudget.clientData?.updatedAt || selectedBudget.date)}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Previsão de Entrega</span>
                                            {!readOnly && !editingDeliveryDate && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const clean = selectedBudget.deliveryDate
                                                            ? (selectedBudget.deliveryDate.includes('T') ? selectedBudget.deliveryDate.split('T')[0] : selectedBudget.deliveryDate)
                                                            : '';
                                                        setTempDeliveryDate(clean);
                                                        setEditingDeliveryDate(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                                    title="Alterar data de entrega"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                    Alterar
                                                </button>
                                            )}
                                        </div>

                                        {editingDeliveryDate ? (
                                            <div className="mt-1.5 space-y-1.5">
                                                <input
                                                    type="date"
                                                    value={tempDeliveryDate}
                                                    onChange={(e) => setTempDeliveryDate(e.target.value)}
                                                    className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => handleUpdateDeliveryDate(selectedBudget, tempDeliveryDate)}
                                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold"
                                                    >
                                                        {isBusy ? 'Salvando...' : 'Salvar'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingDeliveryDate(false)}
                                                        className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-[11px] font-bold"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                                    {selectedBudget.deliveryDate ? formatDateShort(selectedBudget.deliveryDate) : 'Não informada'}
                                                </span>
                                                {delivery && (
                                                    <span className={clsx("inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", delivery.cls)}>
                                                        {delivery.label}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Itens do Pedido */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" />
                                        Itens do Pedido ({selectedBudget.items?.length || 0})
                                    </h4>
                                    <div className="space-y-1.5">
                                        {(selectedBudget.items || []).map((item, idx) => (
                                            <div key={item.id || idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{item.quantity}x</span>
                                                    <span className="font-medium text-gray-800 truncate">{item.name}</span>
                                                </div>
                                                {item.concluido && (
                                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Pronto
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Observações de Produção se houver */}
                                {selectedBudget.clientData?.productionObs && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                                        <span className="font-bold block mb-1">Observações de Produção:</span>
                                        <p className="whitespace-pre-wrap">{selectedBudget.clientData.productionObs}</p>
                                    </div>
                                )}

                                {/* Histórico de Movimentações */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5" />
                                        Histórico do Processo
                                    </h4>
                                    {history.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">
                                            Pedido aprovado antes da ativação do histórico detalhado. Ao avançar a etapa, o registro será gravado automaticamente.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 border-l-2 border-indigo-100 pl-3 ml-1">
                                            {history.map((h, idx) => (
                                                <div key={idx} className="text-xs relative">
                                                    <span className={clsx(
                                                        "w-2.5 h-2.5 rounded-full absolute -left-[18px] top-1 border-2 border-white",
                                                        h.isRollback ? "bg-amber-400" : "bg-indigo-500"
                                                    )} />
                                                    <p className="font-bold text-gray-800">{h.label}</p>
                                                    <p className="text-[11px] text-gray-500 flex items-center gap-2">
                                                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {h.user}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(h.at)}</span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Ações Modal */}
                            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                {!readOnly && currentStageObj?.prevStage ? (
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => handleMoveStage(selectedBudget, currentStageObj.prevStage, true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/70 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Voltar Etapa
                                    </button>
                                ) : <span />}

                                <div className="flex items-center gap-2">
                                    {!readOnly && currentStageObj?.nextStage && (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleMoveStage(selectedBudget, currentStageObj.nextStage, false)}
                                            className={clsx(
                                                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95",
                                                currentStageObj.button
                                            )}
                                        >
                                            <span>{isBusy ? 'Salvando...' : currentStageObj.actionLabel}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}
                                    {currentStageId === 'fila_producao' && setActiveTab && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedBudget(null);
                                                setActiveTab('contas');
                                            }}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                        >
                                            <Factory className="w-4 h-4" />
                                            Ir para Produção
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal de Confirmação de Data de Entrega ao enviar para Fila de Produção */}
            {deliveryModal && (
                <div
                    className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setDeliveryModal(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 bg-sky-600 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-white/80 font-semibold uppercase tracking-wide">
                                    Enviar para Fila de Produção
                                </p>
                                <h3 className="text-base font-bold mt-0.5">
                                    #{deliveryModal.budget.id} — {deliveryModal.budget.clientData?.name || 'Cliente'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setDeliveryModal(null)}
                                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!deliveryModal.date) {
                                    alert('Informe a data de entrega antes de enviar para a Fila de Produção.');
                                    return;
                                }
                                const { budget, date } = deliveryModal;
                                setDeliveryModal(null);
                                await handleMoveStage(budget, 'fila_producao', false, date);
                            }}
                            className="p-5 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                                    Data de Entrega na Produção *
                                </label>
                                <input
                                    type="date"
                                    required
                                    autoFocus
                                    value={deliveryModal.date}
                                    onChange={(e) => setDeliveryModal({ ...deliveryModal, date: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                                <p className="text-[11px] text-gray-400 mt-1.5">
                                    Essa data será exibida na aba Produção (e poderá ser alterada posteriormente apenas aqui em Processos).
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setDeliveryModal(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingId === deliveryModal.budget.id}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all active:scale-95"
                                >
                                    <Factory className="w-4 h-4" />
                                    Confirmar e Enviar para Produção
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Processos;
