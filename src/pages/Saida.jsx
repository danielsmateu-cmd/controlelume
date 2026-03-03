import React, { useState } from 'react';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const Saida = ({ expenses, setExpenses, readOnly = false }) => {
    const [activeTab, setActiveTab] = useState('fixos');

    const fixedCategories = ['ENERGIA', 'AGUA', 'INTERNET', 'DAS', 'CONTADOR', 'IPTU', 'FAXINA', 'DARE', 'FUNCIONARIO'];

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    // Form States
    const [extrasForm, setExtrasForm] = useState({ description: '', value: '', date: new Date().toISOString().split('T')[0], allMonths: false });
    const [mercadoForm, setMercadoForm] = useState({ description: '', value: '', date: new Date().toISOString().split('T')[0] });
    const [fornecedoresForm, setFornecedoresForm] = useState({
        description: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
        installments: 1,
        installmentDates: [new Date().toISOString().split('T')[0]]
    });
    const [retiradaForm, setRetiradaForm] = useState({ value: '', date: new Date().toISOString().split('T')[0], people: [] });

    const withdrawalPeople = ['Juliana', 'Daniel', 'Bruno', 'Outros'];

    const [confirmingId, setConfirmingId] = useState(null);
    const [paymentDateStr, setPaymentDateStr] = useState('');

    const startPaymentConfirmation = (expense) => {
        if (expense.paid) {
            const confirmed = window.confirm(`Reverter pagamento de "${expense.description || expense.category}"?`);
            if (!confirmed) return;

            const updatedExpense = { ...expense, paid: false, paymentDate: null };
            setExpenses(expenses.map(e => e.id === expense.id ? updatedExpense : e));
            api.updateExpense(expense.id, { paid: false, paymentDate: null }).catch(err => console.error(err));
        } else {
            setConfirmingId(expense.id);
            const today = new Date();
            const d = String(today.getDate()).padStart(2, '0');
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const y = today.getFullYear();
            setPaymentDateStr(`${d}/${m}/${y}`);
        }
    };

    const handlePaymentDateChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);

        let formatted = val;
        if (val.length >= 5) {
            formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
        } else if (val.length >= 3) {
            formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
        }
        setPaymentDateStr(formatted);
    };

    const handlePaymentDateBlur = () => {
        let str = paymentDateStr.replace(/\D/g, '');
        if (!str) return;

        const currY = new Date().getFullYear().toString();
        const currM = String(new Date().getMonth() + 1).padStart(2, '0');

        if (str.length === 2) str = str + currM + currY;
        else if (str.length === 4) str = str + currY;
        else if (str.length === 6) str = str.slice(0, 4) + '20' + str.slice(4, 6);

        let formatted = str;
        if (str.length === 8) {
            formatted = `${str.slice(0, 2)}/${str.slice(2, 4)}/${str.slice(4, 8)}`;
        }
        setPaymentDateStr(formatted);
    };

    const finalizePayment = async (expenseId) => {
        const expense = expenses.find(e => e.id === expenseId);
        if (!expense) return;

        let str = paymentDateStr.replace(/\D/g, '');
        const currY = new Date().getFullYear().toString();
        const currM = String(new Date().getMonth() + 1).padStart(2, '0');

        if (str.length === 2) str = str + currM + currY;
        else if (str.length === 4) str = str + currY;
        else if (str.length === 6) str = str.slice(0, 4) + '20' + str.slice(4, 6);

        if (str.length !== 8) {
            alert("Data inválida. Use DD/MM/AAAA.");
            return;
        }

        const d = str.slice(0, 2);
        const m = str.slice(2, 4);
        const y = str.slice(4, 8);
        const isoDate = `${y}-${m}-${d}`;

        const pDate = new Date(isoDate);
        if (isNaN(pDate.getTime()) || isoDate.length !== 10) {
            alert("Data inválida. Verifique o valor inserido.");
            return;
        }

        const updatedExpense = { ...expense, paid: true, paymentDate: isoDate };
        setExpenses(expenses.map(e => e.id === expenseId ? updatedExpense : e));
        setConfirmingId(null);
        setPaymentDateStr('');

        try {
            await api.updateExpense(expenseId, { paid: true, paymentDate: isoDate });
        } catch (err) {
            console.error('Erro ao salvar no Supabase:', err);
        }
    };

    const handleDateKeyDown = (e, expenseId) => {
        if (e.key === 'Enter') finalizePayment(expenseId);
        if (e.key === 'Escape') setConfirmingId(null);
    };

    const updateExpenseField = (id, field, value) => {
        setExpenses(expenses.map(exp => {
            if (exp.id === id) {
                return { ...exp, [field]: value };
            }
            return exp;
        }));
    };

    const handleAddExtra = (e) => {
        e.preventDefault();

        const newExpenses = [];

        if (extrasForm.allMonths) {
            for (let i = 0; i < 12; i++) {
                const extraDate = new Date(extrasForm.date + 'T00:00:00');
                extraDate.setUTCMonth(i);

                newExpenses.push({
                    id: Date.now() + i, // prevent duplicate keys
                    type: 'fixos_extra',
                    month: i,
                    year: selectedYear,
                    description: extrasForm.description,
                    amount: parseFloat(extrasForm.value) || 0,
                    date: extraDate.toISOString().split('T')[0],
                    dueDate: extraDate.toISOString().split('T')[0],
                    paid: false
                });
            }
        } else {
            newExpenses.push({
                id: Date.now(),
                type: 'fixos_extra',
                month: selectedMonth,
                year: selectedYear,
                description: extrasForm.description,
                amount: parseFloat(extrasForm.value) || 0,
                date: extrasForm.date,
                dueDate: extrasForm.date,
                paid: false
            });
        }

        setExpenses([...newExpenses, ...expenses]);
        setExtrasForm({ ...extrasForm, description: '', value: '', allMonths: false });
    };

    const handleAddMercado = (e) => {
        e.preventDefault();
        const newExpense = {
            id: Date.now(),
            type: 'mercado',
            description: mercadoForm.description,
            amount: parseFloat(mercadoForm.value),
            date: mercadoForm.date,
            year: new Date(mercadoForm.date + 'T00:00:00').getUTCFullYear(),
            paid: true
        };
        setExpenses([newExpense, ...expenses]);
        setMercadoForm({ ...mercadoForm, description: '', value: '' });
    };

    const handleAddFornecedores = (e) => {
        e.preventDefault();
        const totalValue = parseFloat(fornecedoresForm.value);
        const numInstallments = parseInt(fornecedoresForm.installments);
        const installmentValue = totalValue; // O valor inserido é o da parcela individual

        const newExpenses = fornecedoresForm.installmentDates.map((date, index) => {
            const installmentDate = new Date(date + 'T00:00:00');
            const monthIndex = installmentDate.getUTCMonth();

            return {
                id: Date.now() + index,
                type: 'fornecedores',
                month: monthIndex,
                year: installmentDate.getUTCFullYear(),
                description: numInstallments > 1
                    ? `${fornecedoresForm.description} (${index + 1}/${numInstallments})`
                    : fornecedoresForm.description,
                amount: installmentValue,
                date: date,
                dueDate: date,
                paid: false
            };
        });

        setExpenses([...newExpenses, ...expenses]);
        setFornecedoresForm({
            ...fornecedoresForm,
            description: '',
            value: '',
            installments: 1,
            installmentDates: [new Date().toISOString().split('T')[0]]
        });
    };

    const handleAddRetirada = (e) => {
        e.preventDefault();
        if (retiradaForm.people.length === 0) {
            alert('Selecione pelo menos uma pessoa para a retirada.');
            return;
        }

        const newExpenses = retiradaForm.people.map((person, index) => ({
            id: Date.now() + index,
            type: 'retirada',
            description: `Retirada: ${person}`,
            amount: parseFloat(retiradaForm.value),
            date: retiradaForm.date,
            year: new Date(retiradaForm.date + 'T00:00:00').getUTCFullYear(),
            people: [person],
            paid: true
        }));

        setExpenses([...newExpenses, ...expenses]);
        setRetiradaForm({ ...retiradaForm, value: '', date: new Date().toISOString().split('T')[0], people: [] });
    };

    const toggleRetiradaPerson = (person) => {
        setRetiradaForm(prev => {
            const newPeople = prev.people.includes(person)
                ? prev.people.filter(p => p !== person)
                : [...prev.people, person];
            return { ...prev, people: newPeople };
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
            try {
                const success = await api.deleteExpense(id);
                if (!success) throw new Error("A API retornou false");
                setExpenses(expenses.filter(e => e.id !== id));
            } catch (err) {
                console.error('Erro ao excluir:', err);
                alert('Erro ao excluir do servidor. Tente novamente.');
            }
        }
    };

    const getDaysUntilDue = (dueDate, paid) => {
        if (!dueDate || paid) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate + 'T00:00:00');
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) return <span className="text-[10px] text-amber-600 font-medium ml-2 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">vence em {diffDays} dias</span>;
        if (diffDays === 0) return <span className="text-[10px] text-orange-600 font-medium ml-2 bg-orange-50 px-1.5 py-0.5 rounded whitespace-nowrap">vence hoje</span>;
        return <span className="text-[10px] text-red-600 font-medium ml-2 bg-red-50 px-1.5 py-0.5 rounded whitespace-nowrap">vencido há {Math.abs(diffDays)} dias</span>;
    };

    const filteredExpenses = expenses.filter(e => {
        if (activeTab === 'fixos') {
            return e.type === 'fixos' ? (e.month === selectedMonth && e.year === selectedYear) : (e.type === 'fixos_extra' && e.month === selectedMonth && e.year === selectedYear);
        }
        if (activeTab === 'fornecedores') {
            return e.type === 'fornecedores' && e.month === selectedMonth && e.year === selectedYear;
        }
        if (activeTab === 'mercado') {
            return e.type === activeTab && new Date(e.date + 'T00:00:00').getUTCMonth() === selectedMonth && new Date(e.date + 'T00:00:00').getUTCFullYear() === selectedYear;
        }
        if (activeTab === 'retirada') {
            return e.type === activeTab && new Date(e.date + 'T00:00:00').getUTCMonth() === selectedMonth && new Date(e.date + 'T00:00:00').getUTCFullYear() === selectedYear;
        }
        return e.type === activeTab;
    }).sort((a, b) => {
        if (activeTab === 'fornecedores') {
            const dA = a.dueDate || a.date;
            const dB = b.dueDate || b.date;
            let dateDiff = 0;
            if (dA && dB) {
                dateDiff = new Date(dA + 'T00:00:00') - new Date(dB + 'T00:00:00');
            } else if (dA) {
                dateDiff = -1;
            } else if (dB) {
                dateDiff = 1;
            }
            if (dateDiff !== 0) return dateDiff;

            const nameA = (a.category || a.description || '').toLowerCase();
            const nameB = (b.category || b.description || '').toLowerCase();
            return nameA.localeCompare(nameB);
        }
        return 0;
    });

    const ExpenseList = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase">Descrição/Categoria</th>
                        <th className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
                        <th className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Valor</th>
                        <th className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                        <th className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-6 py-2 text-sm text-gray-900">
                                {expense.category ? <span className="font-semibold text-indigo-600">{expense.category}</span> : expense.description}
                                {expense.type === 'fixos_extra' && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Extra</span>}
                                {expense.month !== undefined && <span className="ml-2 text-[10px] text-gray-400">({months[expense.month]})</span>}
                            </td>
                            <td className="px-6 py-2 text-sm text-gray-500">
                                {activeTab === 'fornecedores' ? (
                                    <div className="flex items-center">
                                        <input
                                            type="date"
                                            value={expense.dueDate || ''}
                                            onChange={(e) => updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                            className={`p-1 border rounded focus:ring-1 focus:ring-indigo-500 text-xs font-medium shrink-0 ${expense.paid ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'}`}
                                        />
                                        {getDaysUntilDue(expense.dueDate, expense.paid)}
                                    </div>
                                ) : (
                                    expense.date ? new Date(expense.date).toLocaleDateString('pt-BR') : '-'
                                )}
                            </td>
                            <td className="px-6 py-2 text-sm font-medium text-red-600 text-right">
                                - {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-6 py-2 text-center">
                                {activeTab === 'fornecedores' && (
                                    confirmingId === expense.id ? (
                                        <div className="flex items-center justify-center gap-1 bg-white p-1 rounded border border-indigo-200 shadow-sm mx-auto w-fit">
                                            <input
                                                type="text" autoFocus onFocus={e => e.target.select()}
                                                value={paymentDateStr} onChange={handlePaymentDateChange}
                                                onBlur={handlePaymentDateBlur} onKeyDown={(e) => handleDateKeyDown(e, expense.id)}
                                                className="w-[66px] text-center text-[10px] p-1 border border-gray-200 rounded outline-none focus:border-indigo-400 font-bold text-indigo-700"
                                                placeholder="DD/MM/AAAA"
                                            />
                                            <button onClick={() => finalizePayment(expense.id)} className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded transition-colors" title="Confirmar"><Check size={14} /></button>
                                            <button onClick={() => setConfirmingId(null)} className="p-1 bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white rounded transition-colors" title="Cancelar"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => !readOnly && startPaymentConfirmation(expense)}
                                            disabled={readOnly}
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer shadow-sm'} ${expense.paid
                                                ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                                : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                                                }`}
                                        >
                                            {expense.paid ? 'PAGO' : 'PENDENTE'}
                                        </button>
                                    )
                                )}
                            </td>
                            <td className="px-6 py-2 text-sm text-right">
                                <button onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                    Excluir
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                        <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Nenhuma despesa registrada nesta categoria.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Saída / Despesas</h2>
                {readOnly && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                        👁️ Somente Visualização
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ano:</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-semibold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* GLOBAL MONTH TABS */}
            <div className="flex space-x-1 overflow-x-auto pb-4 scrollbar-hide">
                {months.map((month, index) => (
                    <button
                        key={month}
                        onClick={() => setSelectedMonth(index)}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${selectedMonth === index
                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                            : 'text-gray-600 bg-gray-50 border border-gray-200 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                    >
                        {month}
                    </button>
                ))}
            </div>

            {/* CATEGORY TABS */}
            <div className="flex space-x-2 border-b border-gray-200 pb-1 overflow-x-auto">
                {[
                    { id: 'fixos', label: 'Gastos Fixos' },
                    { id: 'mercado', label: 'Gastos Extras' },
                    { id: 'fornecedores', label: 'Fornecedores' },
                    { id: 'retirada', label: 'Retirada' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">

                {/* GASTOS FIXOS */}
                {activeTab === 'fixos' && (
                    <div className="space-y-3">
                        {!readOnly && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">Adicionar Gasto Extra</h3>
                                <form onSubmit={handleAddExtra} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <div className="md:col-span-4">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição</label>
                                        <input
                                            type="text" required
                                            value={extrasForm.description}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, description: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Ex: Manutenção Ar"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor (R$)</label>
                                        <input
                                            type="number" step="0.01"
                                            value={extrasForm.value}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, value: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data Inicial</label>
                                        <input
                                            type="date" required
                                            value={extrasForm.date}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, date: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-3 flex flex-col justify-end gap-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700 cursor-pointer w-full mb-1">
                                            <input
                                                type="checkbox"
                                                checked={extrasForm.allMonths}
                                                onChange={(e) => setExtrasForm({ ...extrasForm, allMonths: e.target.checked })}
                                                className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="leading-tight">Repetir no ano inteiro?</span>
                                        </label>
                                        <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                            <Plus size={16} /> Adicionar Extra
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-3 border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-800">Gastos Fixos e Extras - {months[selectedMonth]}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${expenses.filter(e => (e.type === 'fixos' || e.type === 'fixos_extra') && e.month === selectedMonth && e.year === selectedYear && e.paid).length >= fixedCategories.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {expenses.filter(e => (e.type === 'fixos' || e.type === 'fixos_extra') && e.month === selectedMonth && e.year === selectedYear && e.paid).length} Pagos
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Valor (R$)</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {expenses
                                            .filter(e => (e.type === 'fixos' || e.type === 'fixos_extra') && e.month === selectedMonth && e.year === selectedYear)
                                            .sort((a, b) => {
                                                const dA = a.dueDate || a.date;
                                                const dB = b.dueDate || b.date;
                                                let dateDiff = 0;
                                                if (dA && dB) {
                                                    dateDiff = new Date(dA + 'T00:00:00') - new Date(dB + 'T00:00:00');
                                                } else if (dA) {
                                                    dateDiff = -1;
                                                } else if (dB) {
                                                    dateDiff = 1;
                                                }
                                                if (dateDiff !== 0) return dateDiff;

                                                const nameA = (a.category || a.description || '').toLowerCase();
                                                const nameB = (b.category || b.description || '').toLowerCase();
                                                return nameA.localeCompare(nameB);
                                            })
                                            .map(expense => (
                                                <tr key={expense.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={expense.category || expense.description || ''}
                                                                onChange={(e) => !readOnly && updateExpenseField(expense.id, expense.category !== undefined ? 'category' : 'description', e.target.value)}
                                                                readOnly={readOnly}
                                                                disabled={readOnly}
                                                                className={`w-full max-w-[160px] p-1 border border-transparent hover:border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-300 bg-transparent text-sm font-medium text-indigo-600 outline-none transition-colors ${readOnly ? 'cursor-default' : ''}`}
                                                                placeholder="Nome do Gasto"
                                                            />
                                                            {expense.type === 'fixos_extra' && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full inline-block mt-0.5 shrink-0">Extra</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center">
                                                            <input
                                                                type="date"
                                                                value={expense.dueDate || ''}
                                                                onChange={(e) => !readOnly && updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                                                readOnly={readOnly}
                                                                disabled={readOnly}
                                                                className={`p-1 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs font-medium shrink-0 ${expense.paid ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'} ${readOnly ? 'cursor-default' : ''}`}
                                                            />
                                                            {getDaysUntilDue(expense.dueDate, expense.paid)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number" step="0.01"
                                                            value={expense.amount || ''}
                                                            onChange={(e) => !readOnly && updateExpenseField(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                                                            readOnly={readOnly}
                                                            disabled={readOnly}
                                                            className="w-full max-w-[120px] p-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                                            placeholder="0,00"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {confirmingId === expense.id ? (
                                                            <div className="flex items-center justify-center gap-1 bg-white p-1 rounded border border-indigo-200 shadow-sm mx-auto w-fit">
                                                                <input
                                                                    type="text" autoFocus onFocus={e => e.target.select()}
                                                                    value={paymentDateStr} onChange={handlePaymentDateChange}
                                                                    onBlur={handlePaymentDateBlur} onKeyDown={(e) => handleDateKeyDown(e, expense.id)}
                                                                    className="w-[66px] text-center text-[10px] p-1 border border-gray-200 rounded outline-none focus:border-indigo-400 font-bold text-indigo-700"
                                                                    placeholder="DD/MM/AAAA"
                                                                />
                                                                <button onClick={() => finalizePayment(expense.id)} className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded transition-colors" title="Confirmar"><Check size={14} /></button>
                                                                <button onClick={() => setConfirmingId(null)} className="p-1 bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white rounded transition-colors" title="Cancelar"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => !readOnly && startPaymentConfirmation(expense)}
                                                                    disabled={readOnly}
                                                                    className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer shadow-sm'} ${expense.paid
                                                                        ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                                                        : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                                                                        }`}
                                                                >
                                                                    {expense.paid ? 'PAGO' : 'NÃO PAGO'}
                                                                </button>
                                                                {expense.type === 'fixos_extra' && !readOnly && (
                                                                    <button onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Excluir Extra">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                    </div>
                )}

                {/* MERCADO -> GASTOS EXTRAS */}
                {activeTab === 'mercado' && (
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-800">Adicionar Gasto Extra (Avulso)</h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                    {months[selectedMonth]}
                                </span>
                            </div>
                            {!readOnly && (
                                <form onSubmit={handleAddMercado} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição</label>
                                        <input
                                            type="text" required
                                            value={mercadoForm.description}
                                            onChange={(e) => setMercadoForm({ ...mercadoForm, description: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Ex: Compras Atacadão"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor (R$)</label>
                                        <input
                                            type="number" step="0.01" required
                                            value={mercadoForm.value}
                                            onChange={(e) => setMercadoForm({ ...mercadoForm, value: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data</label>
                                        <input
                                            type="date" required
                                            value={mercadoForm.date}
                                            onChange={(e) => setMercadoForm({ ...mercadoForm, date: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                            <Plus size={16} /> Adicionar
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* FORNECEDORES */}
                {activeTab === 'fornecedores' && (
                    <div className="space-y-3">
                        {/* TOTALS SUMMARY */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div className="bg-green-50 border border-green-100 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Total Pago - {months[selectedMonth]}</p>
                                <p className="text-xl font-bold text-green-700">
                                    {expenses
                                        .filter(e => e.type === 'fornecedores' && e.month === selectedMonth && e.paid)
                                        .reduce((acc, curr) => acc + curr.amount, 0)
                                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Total Pendente - {months[selectedMonth]}</p>
                                <p className="text-xl font-bold text-red-700">
                                    {expenses
                                        .filter(e => e.type === 'fornecedores' && e.month === selectedMonth && !e.paid)
                                        .reduce((acc, curr) => acc + curr.amount, 0)
                                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            <div className="col-span-2 md:col-span-1 bg-red-600 border border-red-700 p-3 rounded-xl shadow-lg shadow-red-100">
                                <p className="text-[10px] font-bold text-white/80 uppercase mb-1">Total Pendente Geral</p>
                                <p className="text-xl font-black text-white">
                                    {expenses
                                        .filter(e => e.type === 'fornecedores' && !e.paid)
                                        .reduce((acc, curr) => acc + curr.amount, 0)
                                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        {!readOnly && (
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-800 mb-4">Adicionar Pagamento a Fornecedor</h3>
                                <form onSubmit={handleAddFornecedores} className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição/Fornecedor</label>
                                            <input
                                                type="text" required
                                                value={fornecedoresForm.description}
                                                onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, description: e.target.value })}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                                placeholder="Ex: Tecidos Ltda"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor Total (R$)</label>
                                            <input
                                                type="number" step="0.01" required
                                                value={fornecedoresForm.value}
                                                onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, value: e.target.value })}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data</label>
                                            <input
                                                type="date" required
                                                value={fornecedoresForm.date}
                                                onChange={(e) => {
                                                    const dateVal = e.target.value;
                                                    const n = fornecedoresForm.installments;
                                                    const baseDate = new Date(dateVal + 'T00:00:00');
                                                    const dates = Array.from({ length: n }, (_, i) => {
                                                        const d = new Date(baseDate);
                                                        const targetMonth = d.getUTCMonth() + i;
                                                        d.setUTCMonth(targetMonth);
                                                        if (d.getUTCMonth() !== (targetMonth % 12)) d.setUTCDate(0);
                                                        return d.toISOString().split('T')[0];
                                                    });
                                                    setFornecedoresForm({ ...fornecedoresForm, date: dateVal, installmentDates: dates });
                                                }}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Parcelas</label>
                                            <select
                                                value={fornecedoresForm.installments}
                                                onChange={(e) => {
                                                    const n = parseInt(e.target.value);
                                                    const baseDate = new Date(fornecedoresForm.date + 'T00:00:00');
                                                    const dates = Array.from({ length: n }, (_, i) => {
                                                        const d = new Date(baseDate);
                                                        const targetMonth = d.getUTCMonth() + i;
                                                        d.setUTCMonth(targetMonth);
                                                        if (d.getUTCMonth() !== (targetMonth % 12)) {
                                                            d.setUTCDate(0);
                                                        }
                                                        return d.toISOString().split('T')[0];
                                                    });
                                                    setFornecedoresForm({ ...fornecedoresForm, installments: n, installmentDates: dates });
                                                }}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                                    <option key={n} value={n}>{n}x</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                                <Plus size={16} /> Adicionar
                                            </button>
                                        </div>
                                    </div>

                                    {fornecedoresForm.installments > 1 && (
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Vencimento das Parcelas</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {fornecedoresForm.installmentDates.map((date, index) => (
                                                    <div key={index}>
                                                        <label className="block text-[9px] text-gray-500 mb-0.5">{index + 1}ª Parcela</label>
                                                        <input
                                                            type="date"
                                                            required
                                                            value={date}
                                                            onChange={(e) => {
                                                                const newDates = [...fornecedoresForm.installmentDates];
                                                                newDates[index] = e.target.value;
                                                                setFornecedoresForm({ ...fornecedoresForm, installmentDates: newDates });
                                                            }}
                                                            className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-[11px]"
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
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">Registrar Retirada</h3>
                        {!readOnly && (
                            <form onSubmit={handleAddRetirada} className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor Total (R$)</label>
                                        <input
                                            type="number" step="0.01" required
                                            value={retiradaForm.value}
                                            onChange={(e) => setRetiradaForm({ ...retiradaForm, value: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data</label>
                                        <input
                                            type="date" required
                                            value={retiradaForm.date}
                                            onChange={(e) => setRetiradaForm({ ...retiradaForm, date: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Retirada para:</label>
                                    <div className="flex flex-wrap gap-3">
                                        {withdrawalPeople.map(person => (
                                            <label key={person} className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                    checked={retiradaForm.people.includes(person)}
                                                    onChange={() => toggleRetiradaPerson(person)}
                                                />
                                                <span className="ml-2 text-xs text-gray-700">{person}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="w-full md:w-auto px-6 bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                    <Plus size={16} /> Registrar Retirada
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            {/* EXPENSE LIST */}
            {activeTab !== 'fixos' && ExpenseList()}
        </div>
    );
};

export default Saida;
