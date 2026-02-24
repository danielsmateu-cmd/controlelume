import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Calendar, User, AlignLeft, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const PESSOAS = [
    { id: 'juliana', label: 'Juliana', color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
    { id: 'daniel', label: 'Daniel', color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    { id: 'bruno', label: 'Bruno', color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
];

const STORAGE_KEY = 'tarefas_data';

const getStatusInfo = (dataFinal) => {
    if (!dataFinal) return { label: 'Sem prazo', icon: Clock, color: 'text-gray-400' };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const prazo = new Date(dataFinal + 'T00:00:00');
    const diff = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Atrasada', icon: AlertTriangle, color: 'text-red-500' };
    if (diff === 0) return { label: 'Vence hoje', icon: AlertTriangle, color: 'text-amber-500' };
    if (diff <= 3) return { label: `${diff}d restante${diff > 1 ? 's' : ''}`, icon: Clock, color: 'text-amber-500' };
    return { label: `${diff} dias`, icon: Clock, color: 'text-gray-400' };
};

const TarefaPessoa = ({ pessoa }) => {
    const [tarefas, setTarefas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ cliente: '', descricao: '', dataFinal: '' });

    // Carregar do localStorage
    useEffect(() => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        setTarefas(all[pessoa.id] || []);
    }, [pessoa.id]);

    const salvar = (novas) => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        all[pessoa.id] = novas;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        setTarefas(novas);
    };

    const handleAdd = () => {
        if (!form.cliente.trim() && !form.descricao.trim()) return;
        const nova = {
            id: Date.now(),
            cliente: form.cliente.trim(),
            descricao: form.descricao.trim(),
            dataFinal: form.dataFinal,
            concluida: false,
            criadaEm: new Date().toISOString(),
        };
        salvar([...tarefas, nova]);
        setForm({ cliente: '', descricao: '', dataFinal: '' });
        setShowForm(false);
    };

    const handleDelete = (id) => {
        salvar(tarefas.filter(t => t.id !== id));
    };

    const handleToggle = (id) => {
        salvar(tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t));
    };

    const pendentes = tarefas.filter(t => !t.concluida);
    const concluidas = tarefas.filter(t => t.concluida);

    return (
        <div className={clsx("rounded-2xl border overflow-hidden", pessoa.border)}>
            {/* Header da pessoa */}
            <div className={`bg-gradient-to-r ${pessoa.color} p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white font-black text-sm">{pessoa.label[0]}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-base">{pessoa.label}</h3>
                        <p className="text-white/70 text-xs">{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                >
                    <Plus size={14} />
                    Nova tarefa
                </button>
            </div>

            {/* Formulário de nova tarefa */}
            {showForm && (
                <div className={clsx("p-4 border-b", pessoa.bg, pessoa.border)}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                                <User size={10} className="inline mr-1" />Nome do Cliente
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Maria Silva"
                                value={form.cliente}
                                onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                                <AlignLeft size={10} className="inline mr-1" />Descrição
                            </label>
                            <textarea
                                placeholder="Descreva a tarefa..."
                                value={form.descricao}
                                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                                rows={2}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                                <Calendar size={10} className="inline mr-1" />Data Final
                            </label>
                            <input
                                type="date"
                                value={form.dataFinal}
                                onChange={e => setForm(f => ({ ...f, dataFinal: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={handleAdd}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r ${pessoa.color} hover:opacity-90 transition-opacity`}
                            >
                                Adicionar Tarefa
                            </button>
                            <button
                                onClick={() => { setShowForm(false); setForm({ cliente: '', descricao: '', dataFinal: '' }); }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de tarefas */}
            <div className="divide-y divide-gray-50 bg-white">
                {tarefas.length === 0 && (
                    <div className="py-8 text-center">
                        <ClipboardList size={28} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-xs text-gray-400">Nenhuma tarefa ainda</p>
                    </div>
                )}

                {/* Pendentes */}
                {pendentes.map(tarefa => {
                    const status = getStatusInfo(tarefa.dataFinal);
                    const StatusIcon = status.icon;
                    return (
                        <div key={tarefa.id} className="p-4 flex gap-3 hover:bg-gray-50 transition-colors group">
                            <button
                                onClick={() => handleToggle(tarefa.id)}
                                className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-indigo-500 transition-colors flex items-center justify-center"
                            />
                            <div className="flex-1 min-w-0">
                                {tarefa.cliente && (
                                    <div className={clsx("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5", pessoa.badge)}>
                                        <User size={9} />
                                        {tarefa.cliente}
                                    </div>
                                )}
                                <p className="text-sm text-gray-800 font-medium leading-snug">{tarefa.descricao}</p>
                                {tarefa.dataFinal && (
                                    <div className={clsx("flex items-center gap-1 text-[11px] mt-1.5 font-semibold", status.color)}>
                                        <StatusIcon size={11} />
                                        {new Date(tarefa.dataFinal + 'T00:00:00').toLocaleDateString('pt-BR')} · {status.label}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(tarefa.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    );
                })}

                {/* Concluídas */}
                {concluidas.length > 0 && (
                    <>
                        <div className="px-4 py-2 bg-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Concluídas ({concluidas.length})</p>
                        </div>
                        {concluidas.map(tarefa => (
                            <div key={tarefa.id} className="p-4 flex gap-3 hover:bg-gray-50 transition-colors group opacity-50">
                                <button
                                    onClick={() => handleToggle(tarefa.id)}
                                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                                >
                                    <CheckCircle2 size={14} className="text-white" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    {tarefa.cliente && (
                                        <span className="text-[10px] font-bold text-gray-400 mr-2">{tarefa.cliente} ·</span>
                                    )}
                                    <span className="text-sm text-gray-500 line-through">{tarefa.descricao}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(tarefa.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

const Tarefas = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="text-indigo-600" size={24} />
                    Tarefas
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Organize as tarefas por responsável</p>
            </div>

            <div className="space-y-5">
                {PESSOAS.map(pessoa => (
                    <TarefaPessoa key={pessoa.id} pessoa={pessoa} />
                ))}
            </div>
        </div>
    );
};

export default Tarefas;
