import React, { useState, useEffect } from 'react';
import { Factory, ChevronDown, ChevronUp, User, Package, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const ProducaoCard = ({ budget, producaoData, onUpdateItemStatus, onUpdateObs, readOnly }) => {
    const [expanded, setExpanded] = useState(false);
    const itemsStatus = producaoData?.items || {};

    const totalItens = budget.items?.length || 0;
    const concluidos = budget.items?.reduce((acc, _, index) => {
        return acc + (itemsStatus[index] === 'concluido' ? 1 : 0);
    }, 0) || 0;

    const progresso = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;

    const getProgressColor = () => {
        if (progresso === 100) return 'bg-green-500';
        if (progresso >= 50) return 'bg-blue-500';
        return 'bg-amber-500';
    };

    const getDeliveryAlert = () => {
        if (!budget.deliveryDate) return null;
        const today = new Date();
        today.setHours(0,0,0,0);
        const delivery = new Date(budget.deliveryDate + 'T00:00:00');
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
                        {budget.deliveryDate && (
                            <div className={clsx(
                                'inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-xs font-bold',
                                deliveryAlertColors[deliveryAlert]
                            )}>
                                <Calendar size={11} />
                                Entrega: {new Date(budget.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                {deliveryAlert === 'overdue' && <span className="ml-1">⚠ Atrasado</span>}
                                {deliveryAlert === 'urgent'  && <span className="ml-1">🔴 Urgente</span>}
                            </div>
                        )}
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
                                    const isConcluido = itemsStatus[i] === 'concluido';
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
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observações</p>
                        <textarea
                            className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${readOnly ? 'cursor-default' : ''}`}
                            rows={2}
                            placeholder={readOnly ? "Sem observações" : "Anotações internas de produção..."}
                            value={producaoData?.obs || ''}
                            onChange={e => onUpdateObs(budget.id, e.target.value)}
                            readOnly={readOnly}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const Producao = ({ readOnly }) => {
    const [budgetsAprovados, setBudgetsAprovados] = useState([]);
    const [producaoData, setProducaoData] = useState(() => {
        const saved = localStorage.getItem('producao_data');
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getBudgets().then(data => {
            if (data) setBudgetsAprovados(data.filter(b => b.status === 'Aprovado' || b.status === 'Faturado'));
            setLoading(false);
        });
    }, []);

    const handleUpdateItemStatus = (budgetId, itemIndex, isConcluido) => {
        setProducaoData(prev => {
            const budgetData = prev[budgetId] || {};
            const itemsStatus = { ...(budgetData.items || {}) };
            if (isConcluido) {
                itemsStatus[itemIndex] = 'concluido';
            } else {
                delete itemsStatus[itemIndex];
            }
            const updated = {
                ...prev,
                [budgetId]: {
                    ...budgetData,
                    items: itemsStatus
                }
            };
            localStorage.setItem('producao_data', JSON.stringify(updated));
            return updated;
        });
    };

    const handleUpdateObs = (budgetId, obs) => {
        setProducaoData(prev => {
            const updated = {
                ...prev,
                [budgetId]: {
                    ...(prev[budgetId] || {}),
                    obs
                }
            };
            localStorage.setItem('producao_data', JSON.stringify(updated));
            return updated;
        });
    };

    const totalConcluidos = budgetsAprovados.filter(b => {
        const itemsStatus = producaoData[b.id]?.items || {};
        const totalItens = b.items?.length || 0;
        if (totalItens === 0) return true;
        const concluidosCount = b.items.reduce((acc, _, index) => {
            return acc + (itemsStatus[index] === 'concluido' ? 1 : 0);
        }, 0);
        return concluidosCount === totalItens;
    }).length;

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
                        <div className="text-[10px] text-indigo-400 font-bold uppercase">Em produção</div>
                    </div>
                    <div className="text-center px-4 py-2 bg-green-50 rounded-xl border border-green-100">
                        <div className="text-xl font-black text-green-600">{totalConcluidos}</div>
                        <div className="text-[10px] text-green-400 font-bold uppercase">Concluídos</div>
                    </div>
                </div>
            </div>

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
            ) : (
                <div className="space-y-4">
                    {budgetsAprovados.map(budget => (
                        <ProducaoCard
                            key={budget.id}
                            budget={budget}
                            producaoData={producaoData[budget.id]}
                            onUpdateItemStatus={handleUpdateItemStatus}
                            onUpdateObs={handleUpdateObs}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Producao;
