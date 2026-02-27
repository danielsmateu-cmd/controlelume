import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Calendar, User, AlignLeft, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const PESSOAS = [
    { id: 'juliana', label: 'Juliana', accent: 'bg-pink-500' },
    { id: 'daniel', label: 'Daniel', accent: 'bg-blue-500' },
    { id: 'bruno', label: 'Bruno', accent: 'bg-amber-500' },
];

const getPrazoInfo = (dataFinal) => {
    if (!dataFinal) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const partes = dataFinal.split('-');
    const prazo = new Date(partes[0], partes[1] - 1, partes[2]);
    const diff = Math.ceil((prazo - hoje) / 86400000);
    if (diff < 0) return { label: 'Atrasada', color: 'text-red-500', icon: AlertTriangle };
    if (diff === 0) return { label: 'Vence hoje', color: 'text-amber-500', icon: AlertTriangle };
    if (diff <= 3) return { label: `${diff}d`, color: 'text-amber-500', icon: Clock };
    return { label: `${diff} dias`, color: 'text-gray-400', icon: Clock };
};

const EMPTY_FORM = { cliente: '', descricao: '', dataFinal: '' };

const PessoaPanel = ({ pessoa, tarefas, onAdd, onToggle, onRemove, loadingSave }) => {
    const [open, setOpen] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const handleAdd = async () => {
        if (!form.cliente.trim() && !form.descricao.trim()) return;
        await onAdd(form);
        setForm(EMPTY_FORM);
        setShowForm(false);
    };

    const toggle = (id, concluida) => onToggle(id, concluida);
    const remove = (id) => onRemove(id);

    const pendentes = tarefas.filter(t => !t.concluida);
    const concluidas = tarefas.filter(t => t.concluida);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabeçalho clicável */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", pessoa.accent)} />
                    <span className="font-semibold text-gray-800 text-base">{pessoa.label}</span>
                    {pendentes.length > 0 && (
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {pendentes.length}
                        </span>
                    )}
                </div>
                {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {/* Conteúdo expandido */}
            {open && (
                <div className="border-t border-gray-100">
                    {/* Formulário */}
                    {showForm ? (
                        <div className="p-5 space-y-3 bg-gray-50 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Nome do cliente"
                                value={form.cliente}
                                onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                disabled={loadingSave}
                            />
                            <textarea
                                placeholder="Descrição da tarefa"
                                value={form.descricao}
                                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                                rows={2}
                                disabled={loadingSave}
                            />
                            <input
                                type="date"
                                value={form.dataFinal}
                                onChange={e => setForm(f => ({ ...f, dataFinal: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                disabled={loadingSave}
                            />
                            <div className="flex gap-2">
                                <button disabled={loadingSave} onClick={handleAdd} className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                    Adicionar
                                </button>
                                <button disabled={loadingSave} onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="px-4 py-2 rounded-xl text-sm text-gray-500 bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 py-2 border-b border-gray-50">
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1.5 transition-colors"
                            >
                                <Plus size={14} /> Nova tarefa
                            </button>
                        </div>
                    )}

                    {/* Lista */}
                    {tarefas.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-sm text-gray-400">Sem tarefas ainda</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {pendentes.map(t => {
                                const prazo = getPrazoInfo(t.dataFinal);
                                const PrazoIcon = prazo?.icon;
                                const dataFormatted = t.dataFinal ? new Date(t.dataFinal + 'T12:00:00').toLocaleDateString('pt-BR') : '';

                                return (
                                    <div key={t.id} className="px-5 py-3.5 flex gap-3 items-start group hover:bg-gray-50 transition-colors">
                                        <button
                                            onClick={() => toggle(t.id, t.concluida)}
                                            disabled={loadingSave}
                                            className="mt-0.5 flex-shrink-0 w-4.5 h-4.5 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-indigo-500 transition-colors disabled:opacity-50"
                                        />
                                        <div className="flex-1 min-w-0">
                                            {t.cliente && <p className="text-xs font-semibold text-gray-400 mb-0.5">{t.cliente}</p>}
                                            <p className="text-sm text-gray-800 leading-snug break-words whitespace-pre-wrap">{t.descricao}</p>
                                            {prazo && (
                                                <div className={clsx("flex items-center gap-1 text-[11px] mt-1 font-medium", prazo.color)}>
                                                    <PrazoIcon size={11} />
                                                    {dataFormatted} · {prazo.label}
                                                </div>
                                            )}
                                        </div>
                                        <button disabled={loadingSave} onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all mt-0.5 flex-shrink-0 disabled:opacity-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}

                            {concluidas.length > 0 && (
                                <>
                                    <div className="px-5 py-2 bg-gray-50">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Concluídas</p>
                                    </div>
                                    {concluidas.map(t => (
                                        <div key={t.id} className="px-5 py-3 flex gap-3 items-start group hover:bg-gray-50 transition-colors opacity-40">
                                            <button disabled={loadingSave} onClick={() => toggle(t.id, t.concluida)} className="mt-0.5 w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                                                <CheckCircle2 size={12} className="text-white" />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                {t.cliente && <p className="text-xs text-gray-400 mb-0.5">{t.cliente}</p>}
                                                <p className="text-sm text-gray-500 line-through break-words whitespace-pre-wrap">{t.descricao}</p>
                                            </div>
                                            <button disabled={loadingSave} onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all mt-0.5 flex-shrink-0 disabled:opacity-50">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const Tarefas = () => {
    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSave, setLoadingSave] = useState(false);

    useEffect(() => {
        const load = async () => {
            let data = await api.getTarefas();

            // Migrar tarefas perdidas no localStorage para o Supabase
            const oldLocal = localStorage.getItem('tarefas');
            if (oldLocal) {
                try {
                    const parsedLocal = JSON.parse(oldLocal);
                    if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
                        for (const t of parsedLocal) {
                            // Ignora se estiver repetida (simples check de descrição)
                            if (!data.some(d => d.descricao === t.descricao)) {
                                const payload = {
                                    cliente: t.cliente || '',
                                    descricao: t.descricao || '',
                                    dataFinal: t.dataFinal || ''
                                };
                                const result = await api.addTarefa(payload, t.pessoa_id || 'bruno');
                                if (result && t.concluida) {
                                    await api.updateTarefa(result.id, { concluida: true });
                                }
                            }
                        }
                    }
                    localStorage.removeItem('tarefas');
                    data = await api.getTarefas(); // Recarrega com os migrados
                } catch (e) {
                    console.error("Erro na migração de tarefas:", e);
                }
            }

            setTarefas(data);
            setLoading(false);
        };
        load();
    }, []);

    const handleAddTarefa = async (novaTarefa, pessoaId) => {
        setLoadingSave(true);
        const result = await api.addTarefa(novaTarefa, pessoaId);
        if (result) {
            setTarefas(prev => [...prev, result]);
        }
        setLoadingSave(false);
    };

    const handleToggleTarefa = async (id, isConcluida) => {
        setLoadingSave(true);
        const success = await api.updateTarefa(id, { concluida: !isConcluida });
        if (success) {
            setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida: !isConcluida } : t));
        }
        setLoadingSave(false);
    };

    const handleRemoveTarefa = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta tarefa?")) return;
        setLoadingSave(true);
        const success = await api.deleteTarefa(id);
        if (success) {
            setTarefas(prev => prev.filter(t => t.id !== id));
        }
        setLoadingSave(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <p className="mt-4 text-sm text-gray-500 font-medium animate-pulse">Carregando tarefas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="text-indigo-600" size={24} />
                    Tarefas
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Toque no nome para ver as tarefas</p>
            </div>
            <div className="space-y-3">
                {PESSOAS.map(p => (
                    <PessoaPanel
                        key={p.id}
                        pessoa={p}
                        tarefas={tarefas.filter(t => t.pessoa_id === p.id)}
                        onAdd={(t) => handleAddTarefa(t, p.id)}
                        onToggle={handleToggleTarefa}
                        onRemove={handleRemoveTarefa}
                        loadingSave={loadingSave}
                    />
                ))}
            </div>
        </div>
    );
};

export default Tarefas;
