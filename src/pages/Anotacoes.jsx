import React, { useState, useEffect } from 'react';
import { Factory, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, User, Package, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const ETAPAS = [
    { id: 'arte_final', label: 'Arte Final' },
    { id: 'projeto_final', label: 'Projeto Final' },
    { id: 'corte', label: 'Corte' },
    { id: 'montagem', label: 'Montagem' },
    { id: 'entrega', label: 'Pronto para Entrega' },
];

const STATUS_ETAPA = {
    pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock },
    em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle },
    concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
};

const ProducaoCard = ({ budget, producaoData, onUpdateEtapa }) => {
    const [expanded, setExpanded] = useState(false);
    const etapas = producaoData?.etapas || {};

    const totalEtapas = ETAPAS.length;
    const concluidas = ETAPAS.filter(e => etapas[e.id] === 'concluido').length;
    const progresso = Math.round((concluidas / totalEtapas) * 100);

    const getProgressColor = () => {
        if (progresso === 100) return 'bg-green-500';
        if (progresso >= 50) return 'bg-blue-500';
        return 'bg-amber-500';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <User size={14} className="text-indigo-500 flex-shrink-0" />
                            <span className="font-bold text-gray-800 truncate">{budget.clientData?.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(budget.date).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="flex items-center gap-1">
                                <Package size={12} />
                                {budget.items?.length} {budget.items?.length === 1 ? 'item' : 'itens'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-700">{progresso}%</div>
                            <div className="text-[10px] text-gray-400">{concluidas}/{totalEtapas} etapas</div>
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
                    {/* Itens do pedido - sem valores */}
                    {budget.items?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Itens do Pedido</p>
                            <div className="space-y-1">
                                {budget.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50">
                                        <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                            {item.quantity}x
                                        </span>
                                        <span className="text-gray-700 font-medium">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Etapas */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Etapas de Produção</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ETAPAS.map(etapa => {
                                const statusAtual = etapas[etapa.id] || 'pendente';
                                const statusInfo = STATUS_ETAPA[statusAtual];
                                const Icon = statusInfo.icon;

                                return (
                                    <div key={etapa.id} className={clsx("rounded-xl border p-3 flex items-center justify-between", statusInfo.color)}>
                                        <div className="flex items-center gap-2">
                                            <Icon size={14} />
                                            <span className="text-xs font-semibold">{etapa.label}</span>
                                        </div>
                                        <select
                                            value={statusAtual}
                                            onChange={e => onUpdateEtapa(budget.id, etapa.id, e.target.value)}
                                            className="text-[10px] font-bold bg-transparent border-none outline-none cursor-pointer ml-1"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <option value="pendente">Pendente</option>
                                            <option value="em_andamento">Em andamento</option>
                                            <option value="concluido">Concluído</option>
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Observações */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observações</p>
                        <textarea
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            rows={2}
                            placeholder="Anotações internas de produção..."
                            value={producaoData?.obs || ''}
                            onChange={e => onUpdateEtapa(budget.id, '__obs__', e.target.value)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const Producao = () => {
    const [budgetsAprovados, setBudgetsAprovados] = useState([]);
    const [producaoData, setProducaoData] = useState(() => {
        const saved = localStorage.getItem('producao_data');
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getBudgets().then(data => {
            if (data) setBudgetsAprovados(data.filter(b => b.status === 'Aprovado'));
            setLoading(false);
        });
    }, []);

    const handleUpdateEtapa = (budgetId, etapaId, valor) => {
        setProducaoData(prev => {
            const updated = {
                ...prev,
                [budgetId]: {
                    ...prev[budgetId],
                    ...(etapaId === '__obs__'
                        ? { obs: valor }
                        : { etapas: { ...(prev[budgetId]?.etapas || {}), [etapaId]: valor } }
                    )
                }
            };
            localStorage.setItem('producao_data', JSON.stringify(updated));
            return updated;
        });
    };

    const totalConcluidos = budgetsAprovados.filter(b => {
        const etapas = producaoData[b.id]?.etapas || {};
        return ETAPAS.every(e => etapas[e.id] === 'concluido');
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
                            onUpdateEtapa={handleUpdateEtapa}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Producao;
