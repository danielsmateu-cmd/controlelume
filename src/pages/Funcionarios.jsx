import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Save, X, Search, CalendarDays, Users, Bus, Clock, Check, Printer, Zap } from 'lucide-react';
import clsx from 'clsx';

function Funcionarios() {
    const { canEdit, canView } = useAuth();
    
    // UI State
    const [activeTab, setActiveTab] = useState('cadastro'); // 'cadastro' | 'ponto'
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [funcionarios, setFuncionarios] = useState([]);
    
    // Cadastro State
    const [isEditingFunc, setIsEditingFunc] = useState(false);
    const [currentFunc, setCurrentFunc] = useState(null);
    const [funcForm, setFuncForm] = useState({ nome: '', cargo: '', valor_vt_diario: 0, valor_hora: 0, ativo: true });
    const [searchFunc, setSearchFunc] = useState('');

    // Ponto State
    const [selectedFuncId, setSelectedFuncId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [registros, setRegistros] = useState([]);
    const [savingPonto, setSavingPonto] = useState(false);

    // Auto-fill state
    const [defaultTimes, setDefaultTimes] = useState(() => {
        const saved = localStorage.getItem('lume_ponto_default_times');
        return saved ? JSON.parse(saved) : { entrada: '08:00', inicio_descanso: '12:00', fim_descanso: '13:00', saida: '17:00' };
    });

    useEffect(() => {
        localStorage.setItem('lume_ponto_default_times', JSON.stringify(defaultTimes));
    }, [defaultTimes]);

    useEffect(() => {
        loadFuncionarios();
    }, []);

    useEffect(() => {
        if (activeTab === 'ponto' && selectedFuncId) {
            loadRegistros();
        }
    }, [activeTab, selectedFuncId, selectedMonth, selectedYear]);

    const loadFuncionarios = async () => {
        setIsLoading(true);
        const data = await api.getFuncionarios();
        setFuncionarios(data || []);
        if (data && data.length > 0 && !selectedFuncId) {
            setSelectedFuncId(data[0].id);
        }
        setIsLoading(false);
    };

    const loadRegistros = async () => {
        setIsLoading(true);
        const data = await api.getRegistrosPonto(selectedFuncId, selectedYear, selectedMonth);
        setRegistros(data || []);
        setIsLoading(false);
    };

    const handleSaveFuncionario = async (e) => {
        e.preventDefault();
        if (!canEdit) return alert('Sem permissão!');
        if (!funcForm.nome) return alert('Nome é obrigatório');

        setIsLoading(true);
        try {
            await api.saveFuncionario({
                ...(isEditingFunc ? { id: currentFunc.id } : {}),
                nome: funcForm.nome,
                cargo: funcForm.cargo,
                valor_vt_diario: parseFloat(funcForm.valor_vt_diario) || 0,
                valor_hora: parseFloat(funcForm.valor_hora) || 0,
                ativo: funcForm.ativo
            });
            await loadFuncionarios();
            setIsEditingFunc(false);
            setFuncForm({ nome: '', cargo: '', valor_vt_diario: 0, valor_hora: 0, ativo: true });
        } catch (err) {
            alert('Erro ao salvar funcionário');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditFuncClick = (func) => {
        setCurrentFunc(func);
        setFuncForm({
            nome: func.nome,
            cargo: func.cargo,
            valor_vt_diario: func.valor_vt_diario,
            valor_hora: func.valor_hora || 0,
            ativo: func.ativo
        });
        setIsEditingFunc(true);
    };

    const toggleFuncAtivo = async (func) => {
        if (!canEdit) return;
        try {
            await api.saveFuncionario({ ...func, ativo: !func.ativo });
            loadFuncionarios();
        } catch (err) {
            alert('Erro ao atualizar status');
        }
    };

    const handlePontoChange = async (dateStr, field, value) => {
        if (!canEdit) return;
        
        // Find existing record or create optimistic one
        const existing = registros.find(r => r.data === dateStr) || {
            funcionario_id: selectedFuncId,
            data: dateStr,
            horario_entrada: null,
            inicio_descanso: null,
            fim_descanso: null,
            horario_saida: null,
            recebeu_vt: false,
            observacoes: ''
        };

        const updated = { ...existing, [field]: value };
        
        // Optimistic update in UI
        setRegistros(prev => {
            const idx = prev.findIndex(r => r.data === dateStr);
            if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = updated;
                return copy;
            }
            return [...prev, updated];
        });

        // Save to DB
        try {
            setSavingPonto(true);
            const saved = await api.upsertRegistroPonto(updated);
            // Re-update with real DB data just in case
            setRegistros(prev => {
                const idx = prev.findIndex(r => r.data === dateStr);
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = saved;
                    return copy;
                }
                return [...prev, saved];
            });
        } catch (err) {
            alert('Erro ao salvar registro.');
            loadRegistros(); // revert
        } finally {
            setSavingPonto(false);
        }
    };

    const handleFillDay = async (dateStr) => {
        if (!canEdit) return;
        
        const existing = registros.find(r => r.data === dateStr) || {
            funcionario_id: selectedFuncId,
            data: dateStr,
            recebeu_vt: false,
            observacoes: ''
        };

        const updated = {
            ...existing,
            horario_entrada: defaultTimes.entrada,
            inicio_descanso: defaultTimes.inicio_descanso,
            fim_descanso: defaultTimes.fim_descanso,
            horario_saida: defaultTimes.saida,
        };

        // Optimistic
        setRegistros(prev => {
            const idx = prev.findIndex(r => r.data === dateStr);
            if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = updated;
                return copy;
            }
            return [...prev, updated];
        });

        try {
            setSavingPonto(true);
            const saved = await api.upsertRegistroPonto(updated);
            setRegistros(prev => {
                const idx = prev.findIndex(r => r.data === dateStr);
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = saved;
                    return copy;
                }
                return [...prev, saved];
            });
        } catch (err) {
            alert('Erro ao preencher o dia.');
            loadRegistros();
        } finally {
            setSavingPonto(false);
        }
    };

    const handleFillMonth = async () => {
        if (!canEdit) return;
        const confirm = window.confirm('Deseja preencher automaticamente todos os dias ÚTEIS vazios com o horário padrão?');
        if (!confirm) return;

        setSavingPonto(true);
        try {
            const updates = [];
            
            // Generate days for selected month (same logic as below)
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const daysArrayTemp = Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const d = new Date(selectedYear, selectedMonth - 1, day);
                return {
                    dateStr: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    isWeekend: d.getDay() === 0 || d.getDay() === 6
                };
            });

            for (const day of daysArrayTemp) {
                if (day.isWeekend) continue; // Skip weekends
                const r = registros.find(reg => reg.data === day.dateStr);
                // If it's completely empty (no checkins)
                if (!r || (!r.horario_entrada && !r.horario_saida)) {
                    const existing = r || {
                        funcionario_id: selectedFuncId,
                        data: day.dateStr,
                        recebeu_vt: false,
                        observacoes: ''
                    };
                    const updated = {
                        ...existing,
                        horario_entrada: defaultTimes.entrada,
                        inicio_descanso: defaultTimes.inicio_descanso,
                        fim_descanso: defaultTimes.fim_descanso,
                        horario_saida: defaultTimes.saida,
                    };
                    updates.push(api.upsertRegistroPonto(updated));
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                await loadRegistros(); // refresh all
            } else {
                alert('Nenhum dia útil vazio encontrado para preencher.');
            }
        } catch (err) {
            alert('Erro ao preencher o mês em lote.');
            loadRegistros();
        } finally {
            setSavingPonto(false);
        }
    };

    // --- Helpers ---
    const calculateHours = (start, breakStart, breakEnd, end) => {
        if (!start || !end) return 0;
        
        const parseMinutes = (timeStr) => {
            if (!timeStr) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        let startMin = parseMinutes(start);
        let endMin = parseMinutes(end);
        let breakStartMin = parseMinutes(breakStart);
        let breakEndMin = parseMinutes(breakEnd);
        
        if (endMin < startMin) endMin += 24 * 60;
        
        let totalWorked = endMin - startMin;
        
        // Subtract break if present
        if (breakStartMin !== null && breakEndMin !== null) {
            if (breakEndMin < breakStartMin) breakEndMin += 24 * 60; // if break crosses midnight
            let breakDuration = breakEndMin - breakStartMin;
            if (breakDuration > 0) {
                totalWorked -= breakDuration;
            }
        }
        
        return totalWorked > 0 ? totalWorked / 60 : 0;
    };

    const formatHours = (decimalHours) => {
        if (!decimalHours) return '-';
        const h = Math.floor(decimalHours);
        const m = Math.round((decimalHours - h) * 60);
        return `${h}h ${m > 0 ? String(m).padStart(2, '0') + 'm' : ''}`;
    };

    // Generate days for selected month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const d = new Date(selectedYear, selectedMonth - 1, day);
        return {
            dateStr: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNum: day,
            weekDay: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    });

    const selectedFunc = funcionarios.find(f => f.id === selectedFuncId);
    
    // Calculations for the month
    let totalDaysWorked = 0;
    let totalHoursWorked = 0;
    let totalVTPaid = 0;
    
    if (selectedFunc) {
        daysArray.forEach(d => {
            const r = registros.find(reg => reg.data === d.dateStr);
            if (r) {
                const hrs = calculateHours(r.horario_entrada, r.inicio_descanso, r.fim_descanso, r.horario_saida);
                if (hrs > 0) {
                    totalDaysWorked++;
                    totalHoursWorked += hrs;
                }
                
                // Usually VT is paid if there are hours worked, OR if specifically marked
                // Let's assume if 'recebeu_vt' is true, OR if they worked. 
                // Let's use `recebeu_vt` checkbox to explicitly track if VT was due/credited.
                if (r.recebeu_vt) {
                    totalVTPaid += selectedFunc.valor_vt_diario;
                }
            }
        });
    }

    const totalSalaryPaid = totalHoursWorked * (selectedFunc?.valor_hora || 0);

    const filteredFts = funcionarios.filter(f => f.nome.toLowerCase().includes(searchFunc.toLowerCase()));

    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        Gestão de Funcionários
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie cadastros, ponto e vales-transporte.</p>
                </div>
                
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 print:hidden">
                    <button 
                        onClick={() => setActiveTab('cadastro')}
                        className={clsx("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'cadastro' ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50")}
                    >
                        Cadastro
                    </button>
                    <button 
                        onClick={() => setActiveTab('ponto')}
                        className={clsx("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'ponto' ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50")}
                    >
                        Controle de Ponto
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
                {activeTab === 'cadastro' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form Column */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    {isEditingFunc ? <Edit2 size={18} className="text-amber-500" /> : <Plus size={18} className="text-indigo-600" />}
                                    {isEditingFunc ? 'Editar Funcionário' : 'Novo Funcionário'}
                                </h3>
                                <form onSubmit={handleSaveFuncionario} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                        <input 
                                            type="text" 
                                            value={funcForm.nome} 
                                            onChange={e => setFuncForm({...funcForm, nome: e.target.value})}
                                            className="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            required
                                            disabled={!canEdit}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Função</label>
                                        <input 
                                            type="text" 
                                            value={funcForm.cargo} 
                                            onChange={e => setFuncForm({...funcForm, cargo: e.target.value})}
                                            className="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            disabled={!canEdit}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor do VT Diário (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                min="0"
                                                value={funcForm.valor_vt_diario} 
                                                onChange={e => setFuncForm({...funcForm, valor_vt_diario: e.target.value})}
                                                className="w-full text-sm pl-9 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                                disabled={!canEdit}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Hora Trabalhada (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                min="0"
                                                value={funcForm.valor_hora} 
                                                onChange={e => setFuncForm({...funcForm, valor_hora: e.target.value})}
                                                className="w-full text-sm pl-9 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                                disabled={!canEdit}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input 
                                            type="checkbox"
                                            id="ativo-chk"
                                            checked={funcForm.ativo}
                                            onChange={e => setFuncForm({...funcForm, ativo: e.target.checked})}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            disabled={!canEdit}
                                        />
                                        <label htmlFor="ativo-chk" className="text-sm font-medium text-gray-700">Funcionário Ativo</label>
                                    </div>
                                    <div className="pt-4 flex gap-2">
                                        {isEditingFunc && (
                                            <button 
                                                type="button"
                                                onClick={() => { setIsEditingFunc(false); setFuncForm({ nome: '', cargo: '', valor_vt_diario: 0, valor_hora: 0, ativo: true }); }}
                                                className="flex-1 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button 
                                            type="submit"
                                            disabled={!canEdit || isLoading}
                                            className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Save size={16} />
                                            {isEditingFunc ? 'Atualizar' : 'Salvar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* List Column */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-800">Funcionários Cadastrados</h3>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            value={searchFunc}
                                            onChange={e => setSearchFunc(e.target.value)}
                                            className="w-48 pl-9 pr-4 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 bg-white uppercase border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Nome</th>
                                                <th className="px-6 py-3 font-medium">Cargo</th>
                                                <th className="px-6 py-3 font-medium text-center">Valor Hora</th>
                                                <th className="px-6 py-3 font-medium text-center">VT Diário</th>
                                                <th className="px-6 py-3 font-medium text-center">Status</th>
                                                <th className="px-6 py-3 font-medium text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredFts.length === 0 ? (
                                                <tr><td colSpan={5} className="p-6 text-center text-gray-500">Nenhum funcionário encontrado.</td></tr>
                                            ) : (
                                                filteredFts.map(f => (
                                                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-gray-800">{f.nome}</td>
                                                        <td className="px-6 py-4 text-gray-600">{f.cargo || '-'}</td>
                                                        <td className="px-6 py-4 text-center font-medium text-blue-600">
                                                            R$ {parseFloat(f.valor_hora || 0).toFixed(2).replace('.', ',')}
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-medium text-emerald-600">
                                                            R$ {parseFloat(f.valor_vt_diario).toFixed(2).replace('.', ',')}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={clsx("px-2 py-1 text-[10px] font-bold rounded-full uppercase", f.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                                                {f.ativo ? 'Ativo' : 'Inativo'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button onClick={() => toggleFuncAtivo(f)} className={clsx("p-1.5 rounded transition-colors", f.ativo ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")} title={f.ativo ? "Desativar" : "Ativar"} disabled={!canEdit}>
                                                                    {f.ativo ? <X size={16} /> : <Check size={16} />}
                                                                </button>
                                                                <button onClick={() => handleEditFuncClick(f)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Editar" disabled={!canEdit}>
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ponto' && (
                    <div className="space-y-6 max-w-6xl mx-auto print:max-w-none print:m-0 print:space-y-0">
                        
                        {/* Ponto Top Controls */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="flex-1 sm:w-64">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Funcionário</label>
                                    <select
                                        value={selectedFuncId}
                                        onChange={e => setSelectedFuncId(e.target.value)}
                                        className="w-full text-sm font-medium text-gray-800 border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="" disabled>Selecione um funcionário</option>
                                        {funcionarios.filter(f => f.ativo).map(f => (
                                            <option key={f.id} value={f.id}>{f.nome}</option>
                                        ))}
                                        {funcionarios.filter(f => !f.ativo).length > 0 && (
                                            <optgroup label="Inativos">
                                                {funcionarios.filter(f => !f.ativo).map(f => (
                                                    <option key={f.id} value={f.id}>{f.nome} (Inativo)</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex-1 sm:w-32">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mês</label>
                                    <select
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{new Date(2000, m-1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 sm:w-24">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ano</label>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {[2024, 2025, 2026, 2027].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {selectedFuncId && (
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm"
                                >
                                    <Printer size={16} />
                                    Imprimir Folha
                                </button>
                            )}
                        </div>

                        {selectedFuncId ? (
                            <>
                                {/* Bloco de Preenchimento Rápido */}
                                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100 shadow-sm print:hidden">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                                                <Zap size={16} className="text-indigo-600" />
                                                Preenchimento Rápido
                                            </h3>
                                            <p className="text-xs text-indigo-700/70 mt-0.5">Defina o horário padrão abaixo e use o raio ⚡ na tabela para preencher os dias mais rápido.</p>
                                        </div>
                                        {canEdit && (
                                            <button 
                                                onClick={handleFillMonth}
                                                disabled={savingPonto}
                                                className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded shadow-sm text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                                            >
                                                <CalendarDays size={14} />
                                                Preencher Dias Vazios do Mês
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Entrada</label>
                                            <input type="time" value={defaultTimes.entrada} onChange={e => setDefaultTimes(prev => ({...prev, entrada: e.target.value}))} className="w-full p-1.5 text-sm font-mono border border-indigo-200 rounded text-indigo-900 bg-white focus:ring-2 focus:ring-indigo-400 outline-none" />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-[10px] font-bold text-orange-800 uppercase mb-1">Saída (Pausa)</label>
                                            <input type="time" value={defaultTimes.inicio_descanso} onChange={e => setDefaultTimes(prev => ({...prev, inicio_descanso: e.target.value}))} className="w-full p-1.5 text-sm font-mono border border-orange-200 rounded text-orange-900 bg-white focus:ring-2 focus:ring-orange-400 outline-none" />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-[10px] font-bold text-orange-800 uppercase mb-1">Retorno</label>
                                            <input type="time" value={defaultTimes.fim_descanso} onChange={e => setDefaultTimes(prev => ({...prev, fim_descanso: e.target.value}))} className="w-full p-1.5 text-sm font-mono border border-orange-200 rounded text-orange-900 bg-white focus:ring-2 focus:ring-orange-400 outline-none" />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Saída</label>
                                            <input type="time" value={defaultTimes.saida} onChange={e => setDefaultTimes(prev => ({...prev, saida: e.target.value}))} className="w-full p-1.5 text-sm font-mono border border-indigo-200 rounded text-indigo-900 bg-white focus:ring-2 focus:ring-indigo-400 outline-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo Financeiro */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                            <CalendarDays size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Dias Trabalhados</p>
                                            <p className="text-2xl font-bold text-gray-800">{totalDaysWorked}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Horas Acumuladas</p>
                                            <p className="text-2xl font-bold text-gray-800">{formatHours(totalHoursWorked)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 z-0"></div>
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 z-10">
                                            <span className="font-bold text-xl">R$</span>
                                        </div>
                                        <div className="z-10">
                                            <p className="text-sm font-medium text-blue-800">Total Salário (Mês)</p>
                                            <p className="text-2xl font-bold text-blue-700">R$ {totalSalaryPaid.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 z-0"></div>
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 z-10">
                                            <Bus size={24} />
                                        </div>
                                        <div className="z-10">
                                            <p className="text-sm font-medium text-emerald-800">Total VT (Mês)</p>
                                            <p className="text-2xl font-bold text-emerald-700">R$ {totalVTPaid.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Grade de Ponto */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-[11px] text-gray-500 bg-gray-50 uppercase border-b border-gray-200">
                                                <tr>
                                                    <th className="px-2 py-3 font-semibold text-center w-8 print:hidden"></th>
                                                    <th className="px-4 py-3 font-semibold text-center w-20">Data</th>
                                                    <th className="px-4 py-3 font-semibold w-24">Dia</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-28">Entrada</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-28">Saída (Pausa)</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-28">Retorno</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-28">Saída</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-24">Total H.</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-24">Recebeu VT?</th>
                                                    <th className="px-4 py-3 font-semibold">Observações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {daysArray.map((day) => {
                                                    const reg = registros.find(r => r.data === day.dateStr) || {};
                                                    const hrs = calculateHours(reg.horario_entrada, reg.inicio_descanso, reg.fim_descanso, reg.horario_saida);
                                                    
                                                    return (
                                                        <tr key={day.dateStr} className={clsx("hover:bg-slate-50 transition-colors", day.isWeekend && "bg-gray-50/50")}>
                                                            <td className="px-2 py-2 text-center border-r border-gray-100 print:hidden">
                                                                <button 
                                                                    onClick={() => handleFillDay(day.dateStr)}
                                                                    disabled={!canEdit || savingPonto}
                                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                                                                    title="Preencher com o horário padrão"
                                                                >
                                                                    <Zap size={14} className={clsx((reg.horario_entrada && reg.horario_saida) && "text-indigo-400")} />
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-mono font-medium text-gray-700 border-r border-gray-100">
                                                                {String(day.dayNum).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}
                                                            </td>
                                                            <td className={clsx("px-4 py-2 text-xs font-semibold uppercase tracking-wider", day.isWeekend ? "text-amber-600" : "text-gray-500")}>
                                                                {day.weekDay}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input 
                                                                    type="time" 
                                                                    value={reg.horario_entrada || ''}
                                                                    onChange={e => handlePontoChange(day.dateStr, 'horario_entrada', e.target.value)}
                                                                    className="w-full p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono text-indigo-900 bg-indigo-50/30"
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input 
                                                                    type="time" 
                                                                    value={reg.inicio_descanso || ''}
                                                                    onChange={e => handlePontoChange(day.dateStr, 'inicio_descanso', e.target.value)}
                                                                    className="w-full p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono text-orange-900 bg-orange-50/30"
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input 
                                                                    type="time" 
                                                                    value={reg.fim_descanso || ''}
                                                                    onChange={e => handlePontoChange(day.dateStr, 'fim_descanso', e.target.value)}
                                                                    className="w-full p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono text-orange-900 bg-orange-50/30"
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input 
                                                                    type="time" 
                                                                    value={reg.horario_saida || ''}
                                                                    onChange={e => handlePontoChange(day.dateStr, 'horario_saida', e.target.value)}
                                                                    className="w-full p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono text-indigo-900 bg-indigo-50/30"
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                                    {formatHours(hrs)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <label className="flex items-center justify-center gap-2 cursor-pointer">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={reg.recebeu_vt || false}
                                                                        onChange={e => handlePontoChange(day.dateStr, 'recebeu_vt', e.target.checked)}
                                                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                                                        disabled={!canEdit}
                                                                    />
                                                                    <span className="text-xs font-medium text-gray-600">Sim</span>
                                                                </label>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Adicionar nota..."
                                                                    value={reg.observacoes || ''}
                                                                    onChange={e => handlePontoChange(day.dateStr, 'observacoes', e.target.value)}
                                                                    className="w-full p-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-transparent"
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Printable Area - Visible only on Print */}
                                <div className="hidden print:block font-sans text-gray-900 bg-white min-h-screen">
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl font-bold uppercase tracking-wider">Folha de Ponto Mensal</h2>
                                        <p className="text-lg mt-1">{String(selectedMonth).padStart(2, '0')} / {selectedYear}</p>
                                    </div>

                                    <div className="mb-6 grid grid-cols-2 gap-4 border border-gray-400 p-4 rounded-lg bg-gray-50">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Nome do Funcionário</p>
                                            <p className="text-lg font-semibold">{selectedFunc.nome}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Cargo / Função</p>
                                            <p className="text-lg font-semibold">{selectedFunc.cargo || 'Não informado'}</p>
                                        </div>
                                    </div>

                                    <table className="w-full border-collapse border border-gray-400 text-sm mb-6">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border border-gray-400 px-2 py-2 w-16 text-center">Data</th>
                                                <th className="border border-gray-400 px-2 py-2 w-20">Dia</th>
                                                <th className="border border-gray-400 px-2 py-2 text-center">Entrada</th>
                                                <th className="border border-gray-400 px-2 py-2 text-center">Pausa (Saída)</th>
                                                <th className="border border-gray-400 px-2 py-2 text-center">Pausa (Retorno)</th>
                                                <th className="border border-gray-400 px-2 py-2 text-center">Saída</th>
                                                <th className="border border-gray-400 px-2 py-2 text-center w-24">Total H.</th>
                                                <th className="border border-gray-400 px-2 py-2">Observações</th>
                                                <th className="border border-gray-400 px-2 py-2 w-24">Assinatura</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {daysArray.map((day) => {
                                                const reg = registros.find(r => r.data === day.dateStr) || {};
                                                const hrs = calculateHours(reg.horario_entrada, reg.inicio_descanso, reg.fim_descanso, reg.horario_saida);
                                                return (
                                                    <tr key={day.dateStr} className={clsx(day.isWeekend && "bg-gray-50")}>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-mono">
                                                            {String(day.dayNum).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-xs uppercase">
                                                            {day.weekDay}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-mono">
                                                            {reg.horario_entrada || ''}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-mono text-gray-500">
                                                            {reg.inicio_descanso || ''}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-mono text-gray-500">
                                                            {reg.fim_descanso || ''}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-mono">
                                                            {reg.horario_saida || ''}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-center font-bold">
                                                            {formatHours(hrs)}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5 text-xs">
                                                            {reg.observacoes || ''}
                                                        </td>
                                                        <td className="border border-gray-400 px-2 py-1.5"></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-100 font-bold">
                                                <td colSpan={6} className="border border-gray-400 px-2 py-2 text-right">TOTAL ACUMULADO NO MÊS:</td>
                                                <td className="border border-gray-400 px-2 py-2 text-center">{formatHours(totalHoursWorked)}</td>
                                                <td colSpan={2} className="border border-gray-400 px-2 py-2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    <div className="mt-16 flex justify-between gap-12 px-8">
                                        <div className="flex-1 text-center">
                                            <div className="border-t border-gray-800 pt-2 font-bold uppercase text-sm">
                                                Assinatura do Funcionário
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">{selectedFunc.nome}</div>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <div className="border-t border-gray-800 pt-2 font-bold uppercase text-sm">
                                                Assinatura do Empregador
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">Responsável / Gerência</div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 text-center text-xs text-gray-400">
                                        Documento gerado pelo sistema em {new Date().toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm text-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                    <Users size={32} />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum funcionário selecionado</h3>
                                <p className="text-gray-500 text-sm">Selecione um funcionário acima para visualizar e editar o controle de ponto mensal.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Saving indicator */}
            {savingPonto && (
                <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse z-50">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                    Salvando ponto...
                </div>
            )}
        </div>
    );
}

export default Funcionarios;
