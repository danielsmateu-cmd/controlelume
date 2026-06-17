import React, { useState, useEffect } from 'react';
import { Factory, ChevronDown, ChevronUp, User, Package, Calendar, Pencil, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const PESSOAS = [
    { id: 'juliana', label: 'Juliana', accent: 'bg-pink-500' },
    { id: 'daniel', label: 'Daniel', accent: 'bg-blue-500' },
    { id: 'bruno', label: 'Bruno', accent: 'bg-amber-500' },
    { id: 'marcio', label: 'Márcio', accent: 'bg-teal-500' },
];

const ProducaoCardObs = ({ budgetId, initialObs, onUpdateObs, readOnly }) => {
    const [tempObs, setTempObs] = useState(initialObs);

    useEffect(() => {
        setTempObs(initialObs);
    }, [initialObs]);

    return (
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observações</p>
            <textarea
                className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${readOnly ? 'cursor-default' : ''}`}
                rows={2}
                placeholder={readOnly ? "Sem observações" : "Anotações internas de produção..."}
                value={tempObs}
                onChange={e => setTempObs(e.target.value)}
                onBlur={() => {
                    if (tempObs !== initialObs) {
                        onUpdateObs(budgetId, tempObs);
                    }
                }}
                readOnly={readOnly}
            />
        </div>
    );
};

const ProducaoCard = ({ budget, onUpdateItemStatus, onUpdateObs, onUpdateDeliveryDate, onUpdateFinishedBy, readOnly }) => {
    const [expanded, setExpanded] = useState(false);

    const totalItens = budget.items?.length || 0;
    const concluidos = budget.items?.reduce((acc, item) => {
        return acc + (item.concluido ? 1 : 0);
    }, 0) || 0;

    const progresso = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;

    const getProgressColor = () => {
        if (progresso === 100) return 'bg-green-500';
        if (progresso >= 50) return 'bg-blue-500';
        return 'bg-amber-500';
    };

    const deliveryDate = budget.deliveryDate;

    const getDeliveryAlert = () => {
        if (!deliveryDate) return null;
        const today = new Date();
        today.setHours(0,0,0,0);
        const delivery = new Date(deliveryDate + 'T00:00:00');
        const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'overdue';
        if (diffDays <= 3) return 'urgent';
        if (diffDays <= 7) return 'warning';
        return 'ok';
    };

    const deliveryAlert = getDeliveryAlert();
    const deliveryAlertColors = {
        overdue: 'bg-red-100 text-red-700 border-red-200',
        urgent:  'bg-orange-100 text-orange-700 border-orange-200',
        warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        ok:      'bg-green-100 text-green-700 border-green-200',
    };

    const [isEditingDate, setIsEditingDate] = useState(false);
    const [tempDate, setTempDate] = useState(deliveryDate || '');

    useEffect(() => {
        setTempDate(deliveryDate || '');
    }, [deliveryDate]);

    const finishedBy = budget.clientData?.finishedBy;
    const [isEditingFinishedBy, setIsEditingFinishedBy] = useState(false);
    const [tempFinishedBy, setTempFinishedBy] = useState(finishedBy || '');

    useEffect(() => {
        setTempFinishedBy(finishedBy || '');
    }, [finishedBy]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <User size={14} className="text-indigo-500 flex-shrink-0" />
                            <span className="font-bold text-gray-800 truncate">{budget.clientData?.name}</span>
                            {budget.status === 'Faturado' && (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-wide">Faturado</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                Pedido: {new Date(budget.date).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="flex items-center gap-1">
                                <Package size={12} />
                                {budget.items?.length} {budget.items?.length === 1 ? 'item' : 'itens'}
                            </span>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {/* Bloco de Data de Entrega */}
                            {isEditingDate ? (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="date"
                                        value={tempDate}
                                        onChange={e => setTempDate(e.target.value)}
                                        className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            onUpdateDeliveryDate(budget.id, tempDate);
                                            setIsEditingDate(false);
                                        }}
                                        className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold px-2.5 py-1"
                                    >
                                        Salvar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingDate(false);
                                            setTempDate(deliveryDate || '');
                                        }}
                                        className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition-colors text-xs font-bold px-2.5 py-1"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    {deliveryDate ? (
                                        <div className={clsx(
                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold',
                                            deliveryAlertColors[deliveryAlert]
                                        )}>
                                            <Calendar size={11} />
                                            Entrega: {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                            {deliveryAlert === 'overdue' && <span className="ml-1">⚠ Atrasado</span>}
                                            {deliveryAlert === 'urgent'  && <span className="ml-1">🔴 Urgente</span>}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsEditingDate(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all"
                                        >
                                            <Calendar size={11} />
                                            + Adicionar Entrega
                                        </button>
                                    )}
                                    
                                    {deliveryDate && !readOnly && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsEditingDate(true);
                                            }}
                                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Editar data de entrega"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Bloco de Responsável pela Finalização */}
                            {(progresso === 100 || finishedBy) && (
                                isEditingFinishedBy ? (
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            placeholder="Quem finalizou?"
                                            value={tempFinishedBy}
                                            onChange={e => setTempFinishedBy(e.target.value)}
                                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none w-36"
                                        />
                                        <button
                                            onClick={() => {
                                                onUpdateFinishedBy(budget.id, tempFinishedBy);
                                                setIsEditingFinishedBy(false);
                                            }}
                                            className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-bold px-2.5 py-1"
                                        >
                                            Salvar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingFinishedBy(false);
                                                setTempFinishedBy(finishedBy || '');
                                            }}
                                            className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition-colors text-xs font-bold px-2.5 py-1"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        {finishedBy ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold animate-fade-in">
                                                <CheckCircle2 size={11} className="text-emerald-600" />
                                                Finalizado por: {finishedBy}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingFinishedBy(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all"
                                            >
                                                <User size={11} />
                                                + Quem finalizou?
                                            </button>
                                        )}
                                        
                                        {finishedBy && !readOnly && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingFinishedBy(true);
                                                }}
                                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                title="Editar responsável pela finalização"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-700">{progresso}%</div>
                            <div className="text-[10px] text-gray-400">{concluidos}/{totalItens} {totalItens === 1 ? 'item' : 'itens'}</div>
                        </div>
                        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                </div>

                <div className="mt-3">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                            className={clsx("h-2 rounded-full transition-all duration-500", getProgressColor())}
                            style={{ width: `${progresso}%` }}
                        />
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                    {/* Itens do pedido - em amarelo e clicáveis para concluir */}
                    {budget.items?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Itens do Pedido (Clique para alternar pronto)</p>
                            <div className="grid grid-cols-1 gap-2">
                                {budget.items.map((item, i) => {
                                    const isConcluido = !!item.concluido;
                                    return (
                                        <button
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!readOnly) onUpdateItemStatus(budget.id, i, !isConcluido);
                                            }}
                                            disabled={readOnly}
                                            className={clsx(
                                                "w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 shadow-sm",
                                                isConcluido
                                                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-800 line-through opacity-70"
                                                    : "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-950 font-medium"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={clsx(
                                                    "w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center flex-shrink-0 transition-colors",
                                                    isConcluido ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900 border border-amber-300"
                                                )}>
                                                    {item.quantity}x
                                                </span>
                                                <span className="text-sm">{item.name}</span>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isConcluido ? (
                                                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg uppercase tracking-wider border border-emerald-200">Pronto</span>
                                                ) : (
                                                    <span className="text-[10px] font-extrabold bg-amber-200 text-amber-900 px-2 py-1 rounded-lg uppercase tracking-wider border border-amber-300">Pendente</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Observações */}
                    <ProducaoCardObs
                        budgetId={budget.id}
                        initialObs={budget.clientData?.productionObs || ''}
                        onUpdateObs={onUpdateObs}
                        readOnly={readOnly}
                    />
                </div>
            )}
        </div>
    );
};

const Producao = ({ readOnly }) => {
    const [budgetsAprovados, setBudgetsAprovados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewTab, setViewTab] = useState('pendentes'); // 'pendentes' ou 'finalizados'
    const [completionModal, setCompletionModal] = useState(null);

    useEffect(() => {
        api.getBudgets().then(data => {
            if (data) setBudgetsAprovados(data.filter(b => b.status === 'Aprovado' || b.status === 'Faturado'));
            setLoading(false);
        });
    }, []);

    const handleUpdateItemStatus = async (budgetId, itemIndex, isConcluido) => {
        const budget = budgetsAprovados.find(b => b.id === budgetId);
        if (!budget) return;

        const updatedItems = (budget.items || []).map((item, idx) => 
            idx === itemIndex ? { ...item, concluido: isConcluido } : item
        );

        // Se está concluindo e isso finaliza o orçamento completo, intercepta com modal
        const previouslyConcluido = isBudgetConcluido(budget);
        const nowConcluido = isBudgetConcluido({ ...budget, items: updatedItems });

        if (nowConcluido && !previouslyConcluido) {
            setCompletionModal({
                budgetId,
                itemIndex,
                isConcluido,
                clientName: budget.clientData?.name || 'Cliente Sem Nome',
                finishedBy: budget.clientData?.finishedBy || '',
                updatedItems
            });
            return;
        }

        // Atualização local imediata
        setBudgetsAprovados(prev => prev.map(b => 
            b.id === budgetId ? { ...b, items: updatedItems } : b
        ));

        // Sincroniza com banco
        const success = await api.updateBudget(budgetId, { items: updatedItems });
        if (!success) {
            alert("Erro ao salvar status do item no banco de dados.");
            // Reverte em caso de falha
            setBudgetsAprovados(prev => prev.map(b => 
                b.id === budgetId ? { ...b, items: budget.items } : b
            ));
        }
    };

    const handleConfirmCompletion = async (budgetId, itemIndex, isConcluido, finishedBy) => {
        const budget = budgetsAprovados.find(b => b.id === budgetId);
        if (!budget) return;

        const updatedItems = (budget.items || []).map((item, idx) => 
            idx === itemIndex ? { ...item, concluido: isConcluido } : item
        );

        const updatedClientData = {
            ...(budget.clientData || {}),
            finishedBy: finishedBy || ''
        };

        // Atualização local imediata
        setBudgetsAprovados(prev => prev.map(b => 
            b.id === budgetId ? { ...b, items: updatedItems, clientData: updatedClientData } : b
        ));

        // Sincroniza com banco
        const success = await api.updateBudget(budgetId, { 
            items: updatedItems,
            clientData: updatedClientData 
        });

        if (!success) {
            alert("Erro ao salvar finalização no banco de dados.");
            // Reverte
            setBudgetsAprovados(prev => prev.map(b => 
                b.id === budgetId ? { ...b, items: budget.items, clientData: budget.clientData } : b
            ));
        }
    };

    const handleUpdateFinishedBy = async (budgetId, finishedBy) => {
        const budget = budgetsAprovados.find(b => b.id === budgetId);
        if (!budget) return;

        const updatedClientData = {
            ...(budget.clientData || {}),
            finishedBy: finishedBy || ''
        };

        // Atualização local imediata
        setBudgetsAprovados(prev => prev.map(b => 
            b.id === budgetId ? { ...b, clientData: updatedClientData } : b
        ));

        // Sincroniza com banco
        const success = await api.updateBudget(budgetId, { clientData: updatedClientData });
        if (!success) {
            alert("Erro ao salvar responsável pela finalização no banco de dados.");
            // Reverte em caso de falha
            setBudgetsAprovados(prev => prev.map(b => 
                b.id === budgetId ? { ...b, clientData: budget.clientData } : b
            ));
        }
    };

    const handleUpdateObs = async (budgetId, obs) => {
        const budget = budgetsAprovados.find(b => b.id === budgetId);
        if (!budget) return;

        const updatedClientData = {
            ...(budget.clientData || {}),
            productionObs: obs
        };

        // Atualização local imediata
        setBudgetsAprovados(prev => prev.map(b => 
            b.id === budgetId ? { ...b, clientData: updatedClientData } : b
        ));

        // Sincroniza com banco
        const success = await api.updateBudget(budgetId, { clientData: updatedClientData });
        if (!success) {
            alert("Erro ao salvar anotações no banco de dados.");
            // Revert em caso de falha
            setBudgetsAprovados(prev => prev.map(b => 
                b.id === budgetId ? { ...b, clientData: budget.clientData } : b
            ));
        }
    };

    const handleUpdateDeliveryDate = async (budgetId, date) => {
        const budget = budgetsAprovados.find(b => b.id === budgetId);
        if (!budget) return;

        const updatedClientData = {
            ...(budget.clientData || {}),
            deliveryDate: date
        };

        // Atualização local imediata
        setBudgetsAprovados(prev => prev.map(b => b.id === budgetId ? { 
            ...b, 
            deliveryDate: date,
            clientData: updatedClientData
        } : b));

        // Sincroniza com banco
        const success = await api.updateBudget(budgetId, { 
            deliveryDate: date,
            clientData: updatedClientData
        });
        if (!success) {
            alert("Erro ao salvar data de entrega no banco de dados.");
            // Revert em caso de falha
            setBudgetsAprovados(prev => prev.map(b => b.id === budgetId ? { 
                ...b, 
                deliveryDate: budget.deliveryDate,
                clientData: budget.clientData
            } : b));
        }
    };

    const isBudgetConcluido = (b) => {
        const totalItens = b.items?.length || 0;
        if (totalItens === 0) return true;
        const concluidosCount = b.items.reduce((acc, item) => {
            return acc + (item.concluido ? 1 : 0);
        }, 0);
        return concluidosCount === totalItens;
    };

    const budgetsPendentes = budgetsAprovados.filter(b => !isBudgetConcluido(b));
    const budgetsFinalizados = budgetsAprovados.filter(b => isBudgetConcluido(b));

    const totalConcluidosCount = budgetsFinalizados.length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Factory className="text-indigo-600" size={24} />
                        Produção
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Orçamentos aprovados em produção</p>
                </div>
                <div className="flex gap-3">
                    <div className="text-center px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="text-xl font-black text-indigo-600">{budgetsAprovados.length}</div>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase">Total em produção</div>
                    </div>
                    <div className="text-center px-4 py-2 bg-green-50 rounded-xl border border-green-100">
                        <div className="text-xl font-black text-green-600">{totalConcluidosCount}</div>
                        <div className="text-[10px] text-green-400 font-bold uppercase">Concluídos</div>
                    </div>
                </div>
            </div>

            {!loading && budgetsAprovados.length > 0 && (
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setViewTab('pendentes')}
                        className={clsx(
                            "py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2",
                            viewTab === 'pendentes'
                                ? "border-indigo-600 text-indigo-600 font-extrabold"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        A Produzir
                        <span className={clsx(
                            "text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors",
                            viewTab === 'pendentes' ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                        )}>
                            {budgetsPendentes.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setViewTab('finalizados')}
                        className={clsx(
                            "py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2",
                            viewTab === 'finalizados'
                                ? "border-green-600 text-green-600 font-extrabold"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Finalizados
                        <span className={clsx(
                            "text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors",
                            viewTab === 'finalizados' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        )}>
                            {budgetsFinalizados.length}
                        </span>
                    </button>
                </div>
            )}

            {loading ? (
                <div className="text-center py-16 text-gray-400">
                    <Factory size={40} className="mx-auto mb-3 opacity-20 animate-pulse" />
                    <p>Carregando...</p>
                </div>
            ) : budgetsAprovados.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <Factory size={48} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-500 font-medium">Nenhum orçamento aprovado ainda.</p>
                    <p className="text-sm text-gray-400 mt-1">Aprove um orçamento na tela de <strong>Orçamentos</strong> para ele aparecer aqui.</p>
                </div>
            ) : viewTab === 'pendentes' && budgetsPendentes.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <Factory size={48} className="mx-auto mb-4 text-emerald-200" />
                    <p className="text-gray-500 font-medium">Todos os itens de produção foram finalizados! 🎉</p>
                    <p className="text-sm text-gray-400 mt-1">Veja a lista de itens concluídos clicando na aba <strong>Finalizados</strong> acima.</p>
                </div>
            ) : viewTab === 'finalizados' && budgetsFinalizados.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <Factory size={48} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-500 font-medium">Nenhum item finalizado ainda.</p>
                    <p className="text-sm text-gray-400 mt-1">Marque os itens dos pedidos em produção como concluídos para finalizá-los.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {(viewTab === 'pendentes' ? budgetsPendentes : budgetsFinalizados).map(budget => (
                        <ProducaoCard
                            key={budget.id}
                            budget={budget}
                            onUpdateItemStatus={handleUpdateItemStatus}
                            onUpdateObs={handleUpdateObs}
                            onUpdateDeliveryDate={handleUpdateDeliveryDate}
                            onUpdateFinishedBy={handleUpdateFinishedBy}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            )}

            {/* Modal de Confirmação de Finalização */}
            {completionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all duration-300">
                        {/* Modal Header */}
                        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Finalizar Produção</h3>
                                <p className="text-xs text-slate-500">Todos os itens serão concluídos</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                Você está finalizando a produção do cliente <strong className="text-slate-800">{completionModal.clientName}</strong>.
                            </p>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Quem finalizou?
                                </label>
                                <input
                                    type="text"
                                    value={completionModal.finishedBy}
                                    onChange={e => setCompletionModal(prev => ({ ...prev, finishedBy: e.target.value }))}
                                    placeholder="Nome do responsável"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
                                    autoFocus
                                />
                                {/* Sugestões rápidas de PESSOAS */}
                                <div className="flex gap-1.5 mt-2">
                                    {PESSOAS.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setCompletionModal(prev => ({ ...prev, finishedBy: p.label }))}
                                            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setCompletionModal(null)}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl text-sm font-semibold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    await handleConfirmCompletion(
                                        completionModal.budgetId,
                                        completionModal.itemIndex,
                                        completionModal.isConcluido,
                                        completionModal.finishedBy
                                    );
                                    setCompletionModal(null);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-emerald-200"
                            >
                                Confirmar e Finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Producao;
