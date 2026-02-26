import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const Saida = ({ expenses, setExpenses, readOnly = false }) => {
    const [activeTab, setActiveTab] = useState('fixos');

    const fixedCategories = ['ENERGIA', 'AGUA', 'INTERNET', 'DAS', 'CONTADOR', 'IPTU', 'FAXINA', 'DARE', 'FUNCIONARIO'];

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    // Form States
    const [extrasForm, setExtrasForm] = useState({ description: '', value: '', date: new Date().toISOString().split('T')[0] });
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

    // Handlers
    const toggleExpenseStatus = (id) => {
        setExpenses(expenses.map(exp => {
            if (exp.id === id) {
                return { ...exp, paid: !exp.paid };
            }
            return exp;
        }));
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
        const newExpense = {
            id: Date.now(),
            type: 'fixos_extra',
            month: selectedMonth,
            year: selectedYear,
            description: extrasForm.description,
            amount: parseFloat(extrasForm.value),
            date: extrasForm.date
        };
        setExpenses([newExpense, ...expenses]);
        setExtrasForm({ ...extrasForm, description: '', value: '' });
    };

    const handleAddMercado = (e) => {
        e.preventDefault();
        const newExpense = {
            id: Date.now(),
            type: 'mercado',
            description: mercadoForm.description,
            amount: parseFloat(mercadoForm.value),
            date: mercadoForm.date,
            year: new Date(mercadoForm.date + 'T00:00:00').getUTCFullYear()
        };
        setExpenses([newExpense, ...expenses]);
        setMercadoForm({ ...mercadoForm, description: '', value: '' });
    };

    const handleAddFornecedores = (e) => {
        e.preventDefault();
        const totalValue = parseFloat(fornecedoresForm.value);
        const numInstallments = parseInt(fornecedoresForm.installments);
        const installmentValue = totalValue / numInstallments;

        const newExpenses = fornecedoresForm.installmentDates.map((date, index) => {
            const installmentDate = new Date(date);
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
            people: [person]
        }));

        setExpenses([...newExpenses, ...expenses]);
        setRetiradaForm({ ...retiradaForm, value: '', people: [] });
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
                await api.deleteExpense(id);
                setExpenses(expenses.filter(e => e.id !== id));
            } catch (err) {
                console.error('Erro ao excluir:', err);
                alert('Erro ao excluir do servidor. Tente novamente.');
            }
        }
    };

    const filteredExpenses = expenses.filter(e => {
        if (activeTab === 'fixos') {
            return e.type === 'fixos' ? (e.month === selectedMonth && e.year === selectedYear) : (e.type === 'fixos_extra' && e.month === selectedMonth && e.year === selectedYear);
        }
        if (activeTab === 'fornecedores') {
            return e.type === 'fornecedores' && e.month === selectedMonth && e.year === selectedYear;
        }
        if (activeTab === 'mercado' || activeTab === 'retirada') {
            return e.type === activeTab && new Date(e.date + 'T00:00:00').getUTCFullYear() === selectedYear;
        }
        return e.type === activeTab;
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
                                    <input
                                        type="date"
                                        value={expense.dueDate || ''}
                                        onChange={(e) => updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                        className={`p-1 border rounded focus:ring-1 focus:ring-indigo-500 text-xs font-medium ${expense.paid ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'}`}
                                    />
                                ) : (
                                    expense.date ? new Date(expense.date).toLocaleDateString('pt-BR') : '-'
                                )}
                            </td>
                            <td className="px-6 py-2 text-sm font-medium text-red-600 text-right">
                                - {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-6 py-2 text-center">
                                {activeTab === 'fornecedores' && (
                                    <button
                                        onClick={() => toggleExpenseStatus(expense.id)}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${expense.paid
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-red-100 text-red-700 border border-red-200'
                                            }`}
                                    >
                                        {expense.paid ? 'PAGO' : 'PENDENTE'}
                                    </button>
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
        <div className="space-y-6">
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

            <div className="flex space-x-2 border-b border-gray-200 pb-1 overflow-x-auto">
                {[
                    { id: 'fixos', label: 'Gastos Fixos' },
                    { id: 'mercado', label: 'Mercado' },
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
                    <div className="space-y-6">
                        {/* MONTH TABS */}
                        <div className="flex space-x-1 overflow-x-auto pb-2 border-b border-gray-100 scrollbar-hide">
                            {months.map((month, index) => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonth(index)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${selectedMonth === index
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-800">Gastos Fixos - {months[selectedMonth]}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth && e.paid).length === fixedCategories.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth && e.paid).length}/{fixedCategories.length} Pagos
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
                                        {expenses.filter(e => e.type === 'fixos' && e.month === selectedMonth).map(expense => (
                                            <tr key={expense.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm font-medium text-indigo-600">{expense.category}</td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="date"
                                                        value={expense.dueDate || ''}
                                                        onChange={(e) => !readOnly && updateExpenseField(expense.id, 'dueDate', e.target.value)}
                                                        readOnly={readOnly}
                                                        disabled={readOnly}
                                                        className={`p-1 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs font-medium ${expense.paid ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'} ${readOnly ? 'cursor-default' : ''}`}
                                                    />
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
                                                    <button
                                                        onClick={() => !readOnly && toggleExpenseStatus(expense.id)}
                                                        disabled={readOnly}
                                                        className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${readOnly ? '' : 'shadow-sm'} ${expense.paid
                                                            ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                                            : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        {expense.paid ? 'PAGO' : 'NÃO PAGO'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {!readOnly && (
                            <div className="border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">Adicionar Gasto Extra</h3>
                                <form onSubmit={handleAddExtra} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição</label>
                                        <input
                                            type="text" required
                                            value={extrasForm.description}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, description: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Ex: Manutenção Ar"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor (R$)</label>
                                        <input
                                            type="number" step="0.01" required
                                            value={extrasForm.value}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, value: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data</label>
                                        <input
                                            type="date" required
                                            value={extrasForm.date}
                                            onChange={(e) => setExtrasForm({ ...extrasForm, date: e.target.value })}
                                            className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                            <Plus size={16} /> Adicionar Extra
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* MERCADO */}
                {activeTab === 'mercado' && (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">Adicionar Gasto de Mercado</h3>
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
                )}

                {/* FORNECEDORES */}
                {activeTab === 'fornecedores' && (
                    <div className="space-y-6">
                        {/* MONTH TABS */}
                        <div className="flex space-x-1 overflow-x-auto pb-2 border-b border-gray-100 scrollbar-hide">
                            {months.map((month, index) => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonth(index)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${selectedMonth === index
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>

                        {/* TOTALS SUMMARY */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                                <form onSubmit={handleAddFornecedores} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição/Fornecedor</label>
                                            <input
                                                type="text" required
                                                value={fornecedoresForm.description}
                                                onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, description: e.target.value })}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                                placeholder="Ex: Tecidos Ltda"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor Total (R$)</label>
                                            <input
                                                type="number" step="0.01" required
                                                value={fornecedoresForm.value}
                                                onChange={(e) => setFornecedoresForm({ ...fornecedoresForm, value: e.target.value })}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Parcelas</label>
                                            <select
                                                value={fornecedoresForm.installments}
                                                onChange={(e) => {
                                                    const n = parseInt(e.target.value);
                                                    const dates = Array(n).fill(fornecedoresForm.date);
                                                    setFornecedoresForm({ ...fornecedoresForm, installments: n, installmentDates: dates });
                                                }}
                                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                                    <option key={n} value={n}>{n}x</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                                <Plus size={16} /> Adicionar Pagamento
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
            <ExpenseList />
        </div>
    );
};

export default Saida;
