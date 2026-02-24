import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Saida = ({ expenses, setExpenses, readOnly = false }) => {
    const [activeTab, setActiveTab] = useState('fixos');

    const fixedCategories = ['ENERGIA', 'AGUA', 'INTERNET', 'DAS', 'CONTADOR', 'IPTU', 'FAXINA', 'DARE', 'FUNCIONARIO'];

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    const [extrasForm, setExtrasForm] = useState({ description: '', value: '', date: new Date().toISOString().split('T')[0] });
    const [mercadoForm, setMercadoForm] = useState({ description: '', value: '', date: new Date().toISOString().split('T')[0] });
    const [fornecedoresForm, setFornecedoresForm] = useState({
        description: '', value: '', date: new Date().toISOString().split('T')[0],
        installments: 1, installmentDates: [new Date().toISOString().split('T')[0]]
    });
    const [retiradaForm, setRetiradaForm] = useState({ value: '', date: new Date().toISOString().split('T')[0], people: [] });

    const withdrawalPeople = ['Juliana', 'Daniel', 'Bruno', 'Outros'];

    const toggleExpenseStatus = (id) => setExpenses(expenses.map(exp => exp.id === id ? { ...exp, paid: !exp.paid } : exp));
    const updateExpenseField = (id, field, value) => setExpenses(expenses.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));

    const handleAddExtra = (e) => {
        e.preventDefault();
        setExpenses([{ id: Date.now(), type: 'fixos_extra', month: selectedMonth, year: selectedYear, description: extrasForm.description, amount: parseFloat(extrasForm.value), date: extrasForm.date }, ...expenses]);
        setExtrasForm({ ...extrasForm, description: '', value: '' });
    };

    const handleAddMercado = (e) => {
        e.preventDefault();
        setExpenses([{ id: Date.now(), type: 'mercado', description: mercadoForm.description, amount: parseFloat(mercadoForm.value), date: mercadoForm.date, year: new Date(mercadoForm.date + 'T00:00:00').getUTCFullYear() }, ...expenses]);
        setMercadoForm({ ...mercadoForm, description: '', value: '' });
    };

    const handleAddFornecedores = (e) => {
        e.preventDefault();
        const totalValue = parseFloat(fornecedoresForm.value);
        const numInstallments = parseInt(fornecedoresForm.installments);
        const installmentValue = totalValue / numInstallments;
        const newExpenses = fornecedoresForm.installmentDates.map((date, index) => {
            const installmentDate = new Date(date);
            return { id: Date.now() + index, type: 'fornecedores', month: installmentDate.getUTCMonth(), year: installmentDate.getUTCFullYear(), description: numInstallments > 1 ? `${fornecedoresForm.description} (${index + 1}/${numInstallments})` : fornecedoresForm.description, amount: installmentValue, date, dueDate: date, paid: false };
        });
        setExpenses([...newExpenses, ...expenses]);
        setFornecedoresForm({ ...fornecedoresForm, description: '', value: '', installments: 1, installmentDates: [new Date().toISOString().split('T')[0]] });
    };

    const handleAddRetirada = (e) => {
        e.preventDefault();
        if (retiradaForm.people.length === 0) { alert('Selecione pelo menos uma pessoa para a retirada.'); return; }
        const newExpenses = retiradaForm.people.map((person, index) => ({ id: Date.now() + index, type: 'retirada', description: `Retirada: ${person}`, amount: parseFloat(retiradaForm.value), date: retiradaForm.date, year: new Date(retiradaForm.date + 'T00:00:00').getUTCFullYear(), people: [person] }));
        setExpenses([...newExpenses, ...expenses]);
        setRetiradaForm({ ...retiradaForm, value: '', people: [] });
    };

    const toggleRetiradaPerson = (person) => {
        setRetiradaForm(prev => {
            const newPeople = prev.people.includes(person) ? prev.people.filter(p => p !== person) : [...prev.people, person];
            return { ...prev, people: newPeople };
        });
    };

    const handleDelete = (id) => { if (window.confirm('Tem certeza que deseja excluir esta despesa?')) setExpenses(expenses.filter(e => e.id !== id)); };

    const filteredExpenses = expenses.filter(e => {
        if (activeTab === 'fixos') return e.type === 'fixos' ? (e.month === selectedMonth && e.year === selectedYear) : (e.type === 'fixos_extra' && e.month === selectedMonth && e.year === selectedYear);
        if (activeTab === 'fornecedores') return e.type === 'fornecedores' && e.month === selectedMonth && e.year === selectedYear;
        if (activeTab === 'mercado' || activeTab === 'retirada') return e.type === activeTab && new Date(e.date + 'T00:00:00').getUTCFullYear() === selectedYear;
        return e.type === activeTab;
    });

    /* ---------- Componentes internos ---------- */
    const Input = ({ className = '', ...props }) => (
        <input className={clsx("input-field", className)} {...props} />
    );

    const StatusBadge = ({ paid, onClick, disabled }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                "px-3 py-0.5 rounded-full text-[10px] font-bold border transition-colors",
                disabled ? "cursor-default" : "cursor-pointer",
                paid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
            )}
        >
            {paid ? 'PAGO' : 'PENDENTE'}
        </button>
    );

    const ExpenseList = () => (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mt-6" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,.06)' }}>
            <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                    <tr>
                        <th className="th-cell">Descrição / Categoria</th>
                        <th className="th-cell">Vencimento</th>
                        <th className="th-cell text-right">Valor</th>
                        <th className="th-cell text-center">Status</th>
                        {!readOnly && <th className="th-cell text-right">Ações</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="td-cell">
                                {expense.category
                                    ? <span className="font-semibold text-indigo-600">{expense.category}</span>
                                    : <span className="text-slate-800">{expense.description}</span>}
                                {expense.type === 'fixos_extra' && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Extra</span>}
                                {expense.month !== undefined && <span className="ml-2 text-[10px] text-slate-400">({months[expense.month]})</span>}
                            </td>
                            <td className="td-cell">
                                {activeTab === 'fornecedores' ? (
                                    <input
                                        type="date"
                                        value={expense.dueDate || ''}
                                        onChange={(e) => updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                        className={clsx(
                                            "px-2 py-1 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none",
                                            expense.paid ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-white"
                                        )}
                                    />
                                ) : (
                                    <span className="text-slate-500 text-sm">{expense.date ? new Date(expense.date).toLocaleDateString('pt-BR') : '—'}</span>
                                )}
                            </td>
                            <td className="td-cell text-right font-semibold text-red-600 mono-num">
                                − {fmt(expense.amount)}
                            </td>
                            <td className="td-cell text-center">
                                {activeTab === 'fornecedores' && (
                                    <StatusBadge paid={expense.paid} onClick={() => toggleExpenseStatus(expense.id)} />
                                )}
                            </td>
                            {!readOnly && (
                                <td className="td-cell text-right">
                                    <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                        <tr><td colSpan="5" className="td-cell text-center text-slate-400 py-10">Nenhuma despesa registrada nesta categoria.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const tabs = [
        { id: 'fixos', label: 'Gastos Fixos' },
        { id: 'mercado', label: 'Mercado' },
        { id: 'fornecedores', label: 'Fornecedores' },
        { id: 'retirada', label: 'Retirada' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Saída / Despesas</h2>
                    {readOnly && (
                        <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                            👁️ Somente Visualização
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ano:</span>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-white text-indigo-600 border border-b-white border-slate-200 -mb-px shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white p-5 rounded-xl border border-slate-100" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,.06)' }}>

                {/* GASTOS FIXOS */}
                {activeTab === 'fixos' && (
                    <div className="space-y-5">
                        {/* Month pills */}
                        <div className="flex gap-1.5 flex-wrap pb-2 border-b border-slate-100">
                            {months.map((month, index) => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonth(index)}
                                    className={clsx(
                                        "px-3 py-1 text-xs font-medium rounded-full transition-all",
                                        selectedMonth === index
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-500 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600"
                                    )}
                                >
                                    {month.substring(0, 3)}
                                </button>
                            ))}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-700">Gastos Fixos — {months[selectedMonth]}</h3>
                                <span className={clsx(
                                    "text-[10px] font-bold px-2.5 py-1 rounded-full",
                                    expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth && e.paid).length === fixedCategories.length
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                )}>
                                    {expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth && e.paid).length}/{fixedCategories.length} Pagos
                                </span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="border-b border-slate-100 bg-slate-50/60">
                                    <tr>
                                        <th className="th-cell">Categoria</th>
                                        <th className="th-cell">Vencimento</th>
                                        <th className="th-cell">Valor (R$)</th>
                                        <th className="th-cell text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth).map(expense => (
                                        <tr key={expense.id} className="hover:bg-slate-50/60">
                                            <td className="td-cell font-semibold text-indigo-600">{expense.category}</td>
                                            <td className="td-cell">
                                                <input
                                                    type="date" value={expense.dueDate || ''}
                                                    onChange={(e) => !readOnly && updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                                    readOnly={readOnly} disabled={readOnly}
                                                    className={clsx(
                                                        "px-2 py-1 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none",
                                                        expense.paid ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-white",
                                                        readOnly && "cursor-default"
                                                    )}
                                                />
                                            </td>
                                            <td className="td-cell">
                                                <input
                                                    type="number" step="0.01"
                                                    value={expense.amount || ''}
                                                    onChange={(e) => !readOnly && updateExpenseField(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                                                    readOnly={readOnly} disabled={readOnly}
                                                    className="w-28 input-field mono-num"
                                                    placeholder="0,00"
                                                />
                                            </td>
                                            <td className="td-cell text-center">
                                                <StatusBadge paid={expense.paid} onClick={() => !readOnly && toggleExpenseStatus(expense.id)} disabled={readOnly} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!readOnly && (
                            <div className="border-t border-slate-100 pt-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Adicionar Gasto Extra</h3>
                                <form onSubmit={handleAddExtra} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição</label>
                                        <Input type="text" required value={extrasForm.description} onChange={(e) => setExtrasForm({ ...extrasForm, description: e.target.value })} placeholder="Ex: Manutenção Ar" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor (R$)</label>
                                        <Input type="number" step="0.01" required value={extrasForm.value} onChange={(e) => setExtrasForm({ ...extrasForm, value: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Data</label>
                                        <Input type="date" required value={extrasForm.date} onChange={(e) => setExtrasForm({ ...extrasForm, date: e.target.value })} />
                                    </div>
                                    <button type="submit" className="btn-primary">
                                        <Plus size={15} /> Adicionar Extra
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* MERCADO */}
                {activeTab === 'mercado' && (
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Adicionar Gasto de Mercado</h3>
                        {!readOnly && (
                            <form onSubmit={handleAddMercado} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div className="md:col-span-1">
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição</label>
                                    <Input type="text" required value={mercadoForm.description} onChange={(e) => setMercadoForm({ ...mercadoForm, description: e.target.value })} placeholder="Ex: Compras Atacadão" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor (R$)</label>
                                    <Input type="number" step="0.01" required value={mercadoForm.value} onChange={(e) => setMercadoForm({ ...mercadoForm, value: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Data</label>
                                    <Input type="date" required value={mercadoForm.date} onChange={(e) => setMercadoForm({ ...mercadoForm, date: e.target.value })} />
                                </div>
                                <button type="submit" className="btn-primary">
                                    <Plus size={15} /> Adicionar
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* FORNECEDORES */}
                {activeTab === 'fornecedores' && (
                    <div className="space-y-5">
                        {/* Month pills */}
                        <div className="flex gap-1.5 flex-wrap pb-2 border-b border-slate-100">
                            {months.map((month, index) => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonth(index)}
                                    className={clsx(
                                        "px-3 py-1 text-xs font-medium rounded-full transition-all",
                                        selectedMonth === index
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-500 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600"
                                    )}
                                >
                                    {month.substring(0, 3)}
                                </button>
                            ))}
                        </div>

                        {/* Totais */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Total Pago — {months[selectedMonth]}</p>
                                <p className="text-xl font-black text-emerald-700 mono-num">
                                    {fmt(expenses.filter(e => e.type === 'fornecedores' && e.month === selectedMonth && e.paid).reduce((acc, curr) => acc + curr.amount, 0))}
                                </p>
                            </div>
                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Total Pendente — {months[selectedMonth]}</p>
                                <p className="text-xl font-black text-red-700 mono-num">
                                    {fmt(expenses.filter(e => e.type === 'fornecedores' && e.month === selectedMonth && !e.paid).reduce((acc, curr) => acc + curr.amount, 0))}
                                </p>
                            </div>
                            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Pendente Geral</p>
                                <p className="text-xl font-black text-white mono-num">
                                    {fmt(expenses.filter(e => e.type === 'fornecedores' && !e.paid).reduce((acc, curr) => acc + curr.amount, 0))}
                                </p>
                            </div>
                        </div>

                        {!readOnly && (
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Adicionar Pagamento a Fornecedor</h3>
                                <form onSubmit={handleAddFornecedores} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-4">
                                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição / Fornecedor</label>
                                            <Input type="text" required value={fornecedoresForm.description} onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, description: e.target.value })} placeholder="Ex: Tecidos Ltda" />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor Total (R$)</label>
                                            <Input type="number" step="0.01" required value={fornecedoresForm.value} onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, value: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Parcelas</label>
                                            <select
                                                value={fornecedoresForm.installments}
                                                onChange={(e) => {
                                                    const n = parseInt(e.target.value);
                                                    setFornecedoresForm({ ...fornecedoresForm, installments: n, installmentDates: Array(n).fill(fornecedoresForm.date) });
                                                }}
                                                className="input-field"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <button type="submit" className="btn-primary w-full">
                                                <Plus size={15} /> Adicionar Pagamento
                                            </button>
                                        </div>
                                    </div>

                                    {fornecedoresForm.installments > 1 && (
                                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Vencimento das Parcelas</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {fornecedoresForm.installmentDates.map((date, index) => (
                                                    <div key={index}>
                                                        <label className="block text-[9px] text-slate-400 mb-0.5">{index + 1}ª Parcela</label>
                                                        <input
                                                            type="date" required value={date}
                                                            onChange={(e) => {
                                                                const newDates = [...fornecedoresForm.installmentDates];
                                                                newDates[index] = e.target.value;
                                                                setFornecedoresForm({ ...fornecedoresForm, installmentDates: newDates });
                                                            }}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* RETIRADA */}
                {activeTab === 'retirada' && (
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Registrar Retirada</h3>
                        {!readOnly && (
                            <form onSubmit={handleAddRetirada} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor Total (R$)</label>
                                        <Input type="number" step="0.01" required value={retiradaForm.value} onChange={(e) => setRetiradaForm({ ...retiradaForm, value: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Data</label>
                                        <Input type="date" required value={retiradaForm.date} onChange={(e) => setRetiradaForm({ ...retiradaForm, date: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-2">Retirada para:</label>
                                    <div className="flex flex-wrap gap-4">
                                        {withdrawalPeople.map(person => (
                                            <label key={person} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    checked={retiradaForm.people.includes(person)}
                                                    onChange={() => toggleRetiradaPerson(person)}
                                                />
                                                <span className="text-sm text-slate-700 font-medium">{person}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary">
                                    <Plus size={15} /> Registrar Retirada
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            <ExpenseList />
        </div>
    );
};

export default Saida;
