import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Check, X, Edit2, Search, TrendingUp, Grid, LayoutList, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Entradas = ({ orders, setOrders, readOnly = false }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);
    const [searchQuery, setSearchQuery] = useState('');
    const [layoutMode, setLayoutMode] = useState(() => {
        return localStorage.getItem('entradas_layout_mode') || 'single';
    });

    const toggleLayoutMode = (mode) => {
        setLayoutMode(mode);
        localStorage.setItem('entradas_layout_mode', mode);
    };

    // Orçamentos aprovados disponíveis para importar
    const [approvedBudgets, setApprovedBudgets] = useState([]);
    const [showBudgetPicker, setShowBudgetPicker] = useState(false);

    useEffect(() => {
        // Busca orçamentos aprovados da API (ou localStorage como fallback)
        api.getBudgets().then(data => {
            if (data && data.length > 0) {
                setApprovedBudgets(data.filter(b => b.status === 'Aprovado'));
            } else {
                try {
                    const local = JSON.parse(localStorage.getItem('savedBudgets') || '[]');
                    setApprovedBudgets(local.filter(b => b.status === 'Aprovado'));
                } catch (_) { }
            }
        });
    }, []);
    const emptyForm = {
        clientName: '',
        description: '',
        orderDate: new Date().toISOString().split('T')[0],
        value: '',
        isPaid: false,
        installments: 1,
        installmentDates: [new Date().toISOString().split('T')[0]],
        paymentMethod: 'Pix/Transferência',
        nfNumber: '',
        boletoNumber: '',
        contribMarginValue: null,
        contribMarginPerc: null,
        originalTotal: null,
        originalMaterialCost: null
    };

    const [formData, setFormData] = useState(emptyForm);
    const [confirmingId, setConfirmingId] = useState(null);
    const [paymentDateStr, setPaymentDateStr] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        let newFormData = { ...formData, [name]: type === 'checkbox' ? checked : value };

        if (name === 'orderDate' || name === 'installments') {
            const n = name === 'installments' ? parseInt(value) : formData.installments;
            const baseDateStr = name === 'orderDate' ? value : formData.orderDate;
            const baseDate = new Date(baseDateStr + 'T00:00:00');

            const dates = Array.from({ length: n }, (_, i) => {
                const d = new Date(baseDate);
                const targetMonth = d.getUTCMonth() + i;
                d.setUTCMonth(targetMonth);
                if (d.getUTCMonth() !== (targetMonth % 12)) {
                    d.setUTCDate(0);
                }
                return d.toISOString().split('T')[0];
            });

            newFormData.installments = n;
            newFormData.installmentDates = dates;
        }

        setFormData(newFormData);
    };

    const handleInstallmentDateChange = (index, value) => {
        const newDates = [...formData.installmentDates];
        newDates[index] = value;
        setFormData(prev => ({ ...prev, installmentDates: newDates }));
    };    // Importar dados de um orçamento aprovado
    const handleImportBudget = async (budget, option = 'cheio') => {
        const totalMaterialCost = budget.items?.reduce((sum, item) => sum + ((item.unitMaterialCost || 0) * item.quantity), 0) || 0;
        const totalTaxAndNfCost = budget.items?.reduce((sum, item) => {
            const itemTax = (item.unitTaxValue || 0) + (item.unitNfValue || 0);
            return sum + (itemTax * item.quantity);
        }, 0) || 0;
        
        let totalMargin = (budget.total || 0) - totalMaterialCost - totalTaxAndNfCost;
        let marginPerc = budget.total > 0 ? (totalMargin / budget.total) * 100 : 0;
        
        let targetValue = budget.total || 0;
        let targetInstallments = 1;
        let descSuffix = '';
        
        if (option === 'desconto') {
            targetValue = (budget.total || 0) * 0.9;
            descSuffix = ' (À Vista 10% desc.)';
            // Recalcula a margem proporcionalmente aplicando o desconto
            const taxRate = budget.total > 0 ? (totalTaxAndNfCost / budget.total) : 0;
            totalMargin = targetValue - totalMaterialCost - (targetValue * taxRate);
            marginPerc = targetValue > 0 ? (totalMargin / targetValue) * 100 : 0;
        } else if (option === 'parcelado') {
            targetValue = (budget.total || 0) * 0.9;
            targetInstallments = 2;
            descSuffix = ' (2x 50% Pedido / 50% Retirada)';
            // Recalcula a margem proporcionalmente aplicando o desconto de 10%
            const taxRate = budget.total > 0 ? (totalTaxAndNfCost / budget.total) : 0;
            totalMargin = targetValue - totalMaterialCost - (targetValue * taxRate);
            marginPerc = targetValue > 0 ? (totalMargin / targetValue) * 100 : 0;
        }

        const baseDate = new Date(formData.orderDate + 'T00:00:00');
        const installmentDates = Array.from({ length: targetInstallments }, (_, i) => {
            const d = new Date(baseDate);
            const targetMonth = d.getUTCMonth() + i;
            d.setUTCMonth(targetMonth);
            if (d.getUTCMonth() !== (targetMonth % 12)) {
                d.setUTCDate(0);
            }
            return d.toISOString().split('T')[0];
        });

        setFormData(prev => ({
            ...prev,
            clientName: budget.clientData?.name || '',
            description: (budget.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || '') + descSuffix,
            value: targetValue ? String(targetValue.toFixed(2)) : '',
            installments: targetInstallments,
            installmentDates: installmentDates,
            contribMarginValue: totalMargin,
            contribMarginPerc: marginPerc,
            originalTotal: budget.total || 0,
            originalMaterialCost: totalMaterialCost
        }));
        setShowBudgetPicker(false);

        // Remove imediatamente localmente da lista de importação
        setApprovedBudgets(prev => prev.filter(b => b.id !== budget.id));

        // Atualiza o banco para que não volte a aparecer (fica como Faturado)
        try {
            await api.updateBudget(budget.id, { status: 'Faturado' });
        } catch (error) {
            console.error('Erro ao atualizar status do orçamento:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const totalValue = parseFloat(formData.value) || 0;
        const numInstallments = parseInt(formData.installments);
        const installmentValue = totalValue / numInstallments;

        let totalMargin = formData.contribMarginValue !== null && formData.contribMarginValue !== undefined
            ? parseFloat(formData.contribMarginValue)
            : null;
        let marginPerc = formData.contribMarginPerc !== null && formData.contribMarginPerc !== undefined
            ? parseFloat(formData.contribMarginPerc)
            : null;

        // Se o valor faturado foi alterado, recalcula a margem proporcionalmente
        if (totalMargin !== null && formData.originalTotal && Math.abs(parseFloat(formData.originalTotal) - totalValue) > 0.01) {
            const originalVal = parseFloat(formData.originalTotal);
            const materialCost = parseFloat(formData.originalMaterialCost || 0);
            
            // originalVal = materialCost + originalTaxesAndNf + totalMargin
            // originalTaxesAndNf = originalVal - materialCost - totalMargin
            const originalTaxesAndNf = originalVal - materialCost - totalMargin;
            const taxRate = originalVal > 0 ? (originalTaxesAndNf / originalVal) : 0;
            
            // Nova Margem = Novo Valor - Custo Materiais - (Novo Valor * Taxa Impostos/NF)
            totalMargin = totalValue - materialCost - (totalValue * taxRate);
            marginPerc = totalValue > 0 ? (totalMargin / totalValue) * 100 : 0;
        }

        const newOrdersToInsert = formData.installmentDates.map((date, index) => {
            const orderVal = installmentValue;
            let orderMarginVal = null;
            if (totalMargin !== null) {
                orderMarginVal = totalMargin / numInstallments;
            }

            return {
                clientName: formData.clientName,
                description: numInstallments > 1
                    ? `${formData.description} (${index + 1}/${numInstallments})`
                    : formData.description,
                orderDate: date,
                value: orderVal,
                paymentDate: null,
                isPaid: false,
                paymentMethod: formData.paymentMethod,
                nfNumber: formData.nfNumber,
                boletoNumber: formData.paymentMethod === 'Boleto' ? formData.boletoNumber : '',
                year: new Date(date + 'T00:00:00').getUTCFullYear(),
                contribMarginValue: orderMarginVal,
                contribMarginPerc: marginPerc
            };
        });

        try {
            const insertedOrders = await api.addOrders(newOrdersToInsert);
            if (insertedOrders) {
                setOrders([...insertedOrders, ...orders]);
                setFormData(emptyForm);
            } else {
                alert('Erro ao salvar pedidos. Verifique o console.');
            }
        } catch (err) {
            console.error('Erro ao salvar no Supabase:', err);
            alert('Erro de conexão ao salvar.');
        }
    };

    const startPaymentConfirmation = (order) => {
        if (order.isPaid) {
            setConfirmModal({
                type: 'revert',
                title: 'Reverter Pagamento',
                theme: 'amber',
                message: `Deseja reverter o pagamento de ${fmt(order.value)} para "${order.clientName}" para PENDENTE?`,
                details: (
                    <div className="space-y-1.5 text-xs text-gray-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p><strong>Cliente:</strong> {order.clientName}</p>
                        <p><strong>Descrição:</strong> {order.description}</p>
                        <p><strong>Valor:</strong> {fmt(order.value)}</p>
                        <p><strong>Data Pago:</strong> {order.paymentDate ? new Date(order.paymentDate + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</p>
                    </div>
                ),
                onConfirm: async () => {
                    const updatedOrder = { ...order, isPaid: false, paymentDate: null };
                    setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
                    try {
                        await api.updateOrder(order.id, { isPaid: false, paymentDate: null });
                    } catch (err) {
                        console.error('Erro ao reverter pagamento no Supabase:', err);
                    }
                }
            });
        } else {
            setConfirmingId(order.id);
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

    const finalizePayment = async (orderId) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

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

        const dateFormatted = `${d}/${m}/${y}`;
        setConfirmModal({
            type: 'pay',
            title: 'Confirmar Pagamento',
            theme: 'emerald',
            message: `Confirmar o recebimento desta parcela?`,
            details: (
                <div className="space-y-1.5 text-xs text-gray-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p><strong>Cliente:</strong> {order.clientName}</p>
                    <p><strong>Descrição:</strong> {order.description}</p>
                    <p><strong>Valor:</strong> {fmt(order.value)}</p>
                    <p><strong>Data de Pagamento:</strong> {dateFormatted}</p>
                </div>
            ),
            onConfirm: async () => {
                const updatedOrder = { ...order, isPaid: true, paymentDate: isoDate };
                setOrders(orders.map(o => o.id === orderId ? updatedOrder : o));
                setConfirmingId(null);
                setPaymentDateStr('');
                try {
                    await api.updateOrder(orderId, { isPaid: true, paymentDate: isoDate });
                } catch (err) {
                    console.error('Erro ao salvar no Supabase:', err);
                }
            }
        });
    };

    const handleDateKeyDown = (e, orderId) => {
        if (e.key === 'Enter') finalizePayment(orderId);
        if (e.key === 'Escape') setConfirmingId(null);
    };

    const handleDelete = async (id) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        setConfirmModal({
            type: 'delete',
            title: 'Excluir Entrada',
            theme: 'red',
            message: `Tem certeza que deseja excluir esta entrada? Esta ação não pode ser desfeita.`,
            details: (
                <div className="space-y-1.5 text-xs text-gray-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p><strong>Cliente:</strong> {order.clientName}</p>
                    <p><strong>Descrição:</strong> {order.description}</p>
                    <p><strong>Valor:</strong> {fmt(order.value)}</p>
                    <p><strong>Status:</strong> {order.isPaid ? 'Pago' : 'Pendente'}</p>
                </div>
            ),
            onConfirm: async () => {
                try {
                    const success = await api.deleteOrder(id);
                    if (!success) throw new Error("A API retornou false");
                    setOrders(orders.filter(o => o.id !== id));
                } catch (err) {
                    console.error('Erro ao excluir:', err);
                    alert('Erro ao excluir do servidor. Tente novamente.');
                }
            }
        });
    };

    const startEditing = (order) => {
        setEditingId(order.id);
        const orderDateStr = order.orderDate.split('T')[0]; // Ensure it's just YYYY-MM-DD
        setEditForm({
            clientName: order.clientName || '',
            description: order.description || '',
            value: order.value || 0,
            orderDate: orderDateStr,
            paymentMethod: order.paymentMethod || 'Pix/Transferência',
            nfNumber: order.nfNumber || '',
            boletoNumber: order.boletoNumber || '',
            contribMarginValue: order.contribMarginValue !== undefined ? order.contribMarginValue : null,
            contribMarginPerc: order.contribMarginPerc !== undefined ? order.contribMarginPerc : null
        });
    };

    const handleSaveEdit = async () => {
        if (!editForm.clientName || !editForm.value || !editForm.orderDate) {
            alert('Preencha os campos obrigatórios (Nome, Valor, Data).');
            return;
        }

        const dateYear = new Date(editForm.orderDate + 'T00:00:00').getUTCFullYear();
        const updatedData = {
            ...editForm,
            value: parseFloat(editForm.value),
            year: dateYear
        };

        try {
            const success = await api.updateOrder(editingId, updatedData);
            if (!success) throw new Error('Falha ao atualizar no banco de dados');
            setOrders(orders.map(o => o.id === editingId ? { ...o, ...updatedData } : o));
            setEditingId(null);
            setEditForm(null);
        } catch (err) {
            console.error('Erro ao atualizar entrada:', err);
            alert('Erro ao salvar edição. Verifique o console ou a conexão.');
        }
    };

    const filteredOrders = orders.filter(order => {
        const orderYear = order.year || new Date(order.orderDate + 'T00:00:00').getUTCFullYear();
        const matchesYear = orderYear === selectedYear;

        if (!searchQuery.trim()) return matchesYear;

        const q = searchQuery.toLowerCase().trim();
        const matchesName = order.clientName?.toLowerCase().includes(q);
        const matchesDesc = order.description?.toLowerCase().includes(q);
        const matchesVal = order.value?.toString().includes(q);
        const matchesBoleto = order.boletoNumber?.toLowerCase().includes(q);
        const matchesNF = order.nfNumber?.toLowerCase().includes(q);
        const matchesPayment = order.paymentMethod?.toLowerCase().includes(q);

        // Busca por status de pagamento (pendente vs pago)
        let matchesStatus = false;
        if (q === 'pendente' || q === 'pendentes' || q === 'aguardando') {
            matchesStatus = !order.isPaid;
        } else if (q === 'pago' || q === 'pagos' || q === 'concluido' || q === 'concluído') {
            matchesStatus = order.isPaid;
        }

        return matchesYear && (
            matchesName || 
            matchesDesc || 
            matchesVal || 
            matchesBoleto || 
            matchesNF || 
            matchesPayment || 
            matchesStatus
        );
    });

    return (
        <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Entradas</h2>
                {readOnly ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                        👁️ Somente Visualização
                    </span>
                ) : (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar nome, valor, boleto, NF..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="font-bold uppercase tracking-widest text-[10px]">Filtrar por Ano:</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-semibold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            
                            {/* Alternador de Layout de Meses */}
                            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => toggleLayoutMode('single')}
                                    title="Visualizar um mês por linha (Notebook / Telas menores)"
                                    className={clsx(
                                        "p-1.5 rounded-md transition-all flex items-center justify-center",
                                        layoutMode === 'single'
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    <LayoutList size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleLayoutMode('grid')}
                                    title="Visualizar meses lado a lado (Monitor Grande)"
                                    className={clsx(
                                        "p-1.5 rounded-md transition-all flex items-center justify-center",
                                        layoutMode === 'grid'
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    <Grid size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!readOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">

                    {/* Importar Orçamento Aprovado */}
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                        <button
                            type="button"
                            onClick={() => setShowBudgetPicker(!showBudgetPicker)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                            <FileText size={14} />
                            Importar de Orçamento Aprovado
                            {approvedBudgets.length > 0 && (
                                <span className="ml-1 bg-indigo-600 text-white rounded-full px-1.5 py-0 text-[9px]">
                                    {approvedBudgets.length}
                                </span>
                            )}
                        </button>
                        <span className="text-[10px] text-gray-400">Preenche automaticamente Nome, Valor e Descrição</span>
                    </div>

                    {/* Lista de orçamentos aprovados */}
                    {showBudgetPicker && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">
                                Orçamentos Aprovados — clique para importar
                            </p>
                            {approvedBudgets.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nenhum orçamento aprovado encontrado.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2.5">
                                    {approvedBudgets.map(budget => (
                                        <div
                                            key={budget.id}
                                            className="py-3 px-3 rounded-xl border border-indigo-100 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-indigo-300"
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {budget.clientData?.name || 'Cliente sem nome'}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                                    {new Date(budget.date).toLocaleDateString('pt-BR')} · {budget.items?.length || 0} itens
                                                </p>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleImportBudget(budget, 'cheio')}
                                                    className="px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold transition-all flex flex-col items-center shrink-0"
                                                    title="Importa o valor total em 1x"
                                                >
                                                    <span className="text-[8px] font-medium text-gray-400 uppercase tracking-wide">Cheio (1x)</span>
                                                    <span>{fmt(budget.total || 0)}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleImportBudget(budget, 'desconto')}
                                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex flex-col items-center shrink-0"
                                                    title="Importa o valor com 10% de desconto em 1x"
                                                >
                                                    <span className="text-[8px] font-bold text-indigo-200 uppercase tracking-wide">À Vista (-10%)</span>
                                                    <span>{fmt((budget.total || 0) * 0.9)}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleImportBudget(budget, 'parcelado')}
                                                    className="px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold transition-all flex flex-col items-center shrink-0"
                                                    title="Importa o valor com 10% de desconto dividido em 2 parcelas (50% no pedido e 50% na retirada)"
                                                >
                                                    <span className="text-[8px] font-medium text-gray-400 uppercase tracking-wide">Parcelado (2x)</span>
                                                    <span>2x de {fmt(((budget.total || 0) * 0.9) / 2)}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Formulário de nova entrada */}
                    <h3 className="text-sm font-semibold text-gray-800">Nova Entrada</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {formData.contribMarginValue !== null && formData.contribMarginValue !== undefined && (
                            <div className="col-span-1 md:col-span-12 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-700 gap-2">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <TrendingUp size={14} className="text-indigo-500" />
                                    <span>
                                        <strong>Margem de Contribuição Importada:</strong>{' '}
                                        {fmt(formData.contribMarginValue)}{' '}
                                        ({formData.contribMarginPerc?.toFixed(1)}%)
                                    </span>
                                </span>
                                {formData.installments > 1 && (
                                    <span className="text-[10px] text-gray-500 font-semibold bg-white/50 px-2 py-0.5 rounded border border-indigo-100/50">
                                        Proporcional por parcela: {fmt(formData.contribMarginValue / formData.installments)}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="col-span-1 md:col-span-4">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nome do Cliente</label>
                            <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor (R$)</label>
                            <input type="number" step="0.01" name="value" value={formData.value} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                        </div>

                        <div className="col-span-1 md:col-span-4">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição do Pedido</label>
                            <input type="text" name="description" value={formData.description} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required placeholder="Descrição curta" />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nº Nota Fiscal</label>
                            <input type="text" name="nfNumber" value={formData.nfNumber} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: 12345" />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data do Pedido</label>
                            <input type="date" name="orderDate" value={formData.orderDate} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Forma de Pagamento</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                                <option value="Pix/Transferência">Pix/Transferência</option>
                                <option value="Link de pagamento">Link de pagamento</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>

                        {formData.paymentMethod === 'Boleto' && (
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nº do Boleto</label>
                                <input type="text" name="boletoNumber" value={formData.boletoNumber} onChange={handleInputChange}
                                    className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Nº Boleto" />
                            </div>
                        )}

                        <div className="col-span-1 md:col-span-1">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Parcelas</label>
                            <select name="installments" value={formData.installments} onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                    <option key={n} value={n}>{n}x</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex items-end">
                            <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                <Plus size={16} /> Adicionar
                            </button>
                        </div>

                        {/* Datas de parcelas */}
                        {formData.installments > 1 && (
                            <div className="col-span-1 md:col-span-12 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Vencimento Estimado das Parcelas</h4>
                                <p className="text-[9px] text-gray-400 mb-2">Informe as datas previstas. A data de pagamento real será registrada ao confirmar cada parcela como "Pago".</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {formData.installmentDates.map((date, index) => (
                                        <div key={index}>
                                            <label className="block text-[9px] text-gray-500 mb-0.5">{index + 1}ª Parcela</label>
                                            <input type="date" required value={date}
                                                onChange={(e) => handleInstallmentDateChange(index, e.target.value)}
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-[11px]" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* Resumo Anual - 12 meses */}
            {(() => {
                const MONTHS = [
                    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
                ];
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();

                const monthlyData = MONTHS.map((name, idx) => {
                    const monthOrders = orders.filter(o => {
                        const oYear = o.year || new Date(o.orderDate + 'T00:00:00').getUTCFullYear();
                        const oMonth = new Date(o.orderDate + 'T00:00:00').getUTCMonth();
                        return oYear === selectedYear && oMonth === idx;
                    });
                    const total = monthOrders.reduce((s, o) => s + (o.value || 0), 0);
                    const paid = monthOrders.filter(o => o.isPaid).reduce((s, o) => s + (o.value || 0), 0);
                    const pending = total - paid;

                    // MC calculations for annual summary month block
                    const ordersWithMc = monthOrders.filter(o => o.contribMarginValue !== null && o.contribMarginValue !== undefined);
                    const mcValue = ordersWithMc.reduce((s, o) => s + o.contribMarginValue, 0);
                    const mcBaseValue = ordersWithMc.reduce((s, o) => s + o.value, 0);
                    const mcPerc = mcBaseValue > 0 ? (mcValue / mcBaseValue) * 100 : 0;

                    return { name, total, paid, pending, count: monthOrders.length, mcValue, mcPerc };
                });

                const yearTotal = monthlyData.reduce((s, m) => s + m.total, 0);
                const yearPaid = monthlyData.reduce((s, m) => s + m.paid, 0);
                const yearPending = monthlyData.reduce((s, m) => s + m.pending, 0);

                // Annual MC values
                const yearMcValue = monthlyData.reduce((s, m) => s + m.mcValue, 0);
                const yearMcBaseValue = orders.filter(o => {
                    const oYear = o.year || new Date(o.orderDate + 'T00:00:00').getUTCFullYear();
                    return oYear === selectedYear && o.contribMarginValue !== null && o.contribMarginValue !== undefined;
                }).reduce((s, o) => s + o.value, 0);
                const yearMcPerc = yearMcBaseValue > 0 ? (yearMcValue / yearMcBaseValue) * 100 : 0;

                const scrollToMonth = (monthName) => {
                    const el = document.getElementById(`month-section-${monthName.toLowerCase()}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };

                return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Header do resumo anual */}
                        <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-indigo-200" />
                                <span className="text-sm font-bold text-white">Resumo Anual {selectedYear}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] flex-wrap justify-end">
                                {yearMcValue > 0 && (
                                    <span className="text-indigo-100 bg-indigo-700/40 px-2 py-0.5 rounded font-bold">
                                        MC: {fmt(yearMcValue)} ({yearMcPerc.toFixed(1)}%)
                                    </span>
                                )}
                                <span className="text-indigo-200">Total: <span className="font-bold text-white">{fmt(yearTotal)}</span></span>
                                <span className="text-green-300">Pago: <span className="font-bold text-white">{fmt(yearPaid)}</span></span>
                                {yearPending > 0 && <span className="text-red-300">Pendente: <span className="font-bold text-white">{fmt(yearPending)}</span></span>}
                            </div>
                        </div>

                        {/* Grid dos 12 meses */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 divide-x divide-y divide-gray-100">
                            {monthlyData.map((m, idx) => {
                                const isCurrent = idx === currentMonth && selectedYear === currentYear;
                                const hasData = m.total > 0;
                                return (
                                    <button
                                        key={m.name}
                                        onClick={() => scrollToMonth(m.name)}
                                        title={`Ir para ${m.name}`}
                                        className={clsx(
                                            'flex flex-col items-start p-2.5 text-left transition-all hover:z-10 relative group',
                                            isCurrent
                                                ? 'bg-green-50 hover:bg-green-100'
                                                : hasData
                                                    ? 'bg-white hover:bg-indigo-50'
                                                    : 'bg-gray-50 hover:bg-gray-100'
                                        )}
                                    >
                                        <div className="flex items-center gap-1 mb-1 w-full">
                                            <span className={clsx(
                                                'text-[9px] font-bold uppercase tracking-widest truncate',
                                                isCurrent ? 'text-green-600' : 'text-gray-500'
                                            )}>
                                                {m.name.slice(0, 3)}
                                            </span>
                                            {isCurrent && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        {hasData ? (
                                            <>
                                                <span className="text-[10px] font-bold text-gray-800 leading-tight">{fmt(m.total)}</span>
                                                {m.mcValue > 0 && (
                                                    <span className="text-[9px] text-indigo-600 font-semibold leading-tight mt-0.5">
                                                        MC: {fmt(m.mcValue)} ({m.mcPerc.toFixed(0)}%)
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-green-600 leading-tight mt-0.5">{fmt(m.paid)}</span>
                                                {m.pending > 0 && (
                                                    <span className="text-[9px] text-red-500 leading-tight">{fmt(m.pending)}</span>
                                                )}
                                                <span className="text-[8px] text-gray-400 mt-0.5">{m.count} {m.count === 1 ? 'item' : 'itens'}</span>
                                            </>
                                        ) : (
                                            <span className="text-[9px] text-gray-300 italic">—</span>
                                        )}
                                        <div className={clsx(
                                            'absolute bottom-0 left-0 right-0 h-0.5 transition-all group-hover:opacity-100',
                                            isCurrent ? 'bg-green-400 opacity-100' : 'bg-indigo-400 opacity-0'
                                        )} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Lista agrupada por mês */}
            <div className={clsx(
                "grid gap-4",
                layoutMode === 'grid' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            )}>
                {Object.entries(filteredOrders.reduce((acc, order) => {
                    const monthYear = new Date(order.orderDate + 'T00:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
                    const key = capitalize(monthYear);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(order);
                    return acc;
                }, {})).map(([month, monthOrders]) => {
                    const totalValue = monthOrders.reduce((sum, order) => sum + order.value, 0);
                    const totalPaid = monthOrders.filter(o => o.isPaid).reduce((sum, order) => sum + order.value, 0);
                    const totalPending = totalValue - totalPaid;

                    // MC Calculations
                    const ordersWithMc = monthOrders.filter(o => o.contribMarginValue !== null && o.contribMarginValue !== undefined);
                    const totalMcValue = ordersWithMc.reduce((sum, o) => sum + o.contribMarginValue, 0);
                    const totalMcBaseValue = ordersWithMc.reduce((sum, o) => sum + o.value, 0);
                    const avgMcPerc = totalMcBaseValue > 0 ? (totalMcValue / totalMcBaseValue) * 100 : 0;

                    const currentMonthYear = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
                    const isCurrentMonth = month === capitalize(currentMonthYear);

                    // Extrair o nome do mês para usar como id de âncora
                    const monthNameOnly = month.split(' ')[0]; // ex: "Janeiro"

                    return (
                        <div
                            key={month}
                            id={`month-section-${monthNameOnly.toLowerCase()}`}
                            className={clsx(
                                "bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all scroll-mt-4",
                                isCurrentMonth ? "border-green-300 ring-1 ring-green-100 shadow-md" : "border-gray-100"
                            )}
                        >
                            <div className={clsx(
                                "px-4 py-2 border-b flex justify-between items-center shrink-0",
                                isCurrentMonth ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"
                            )}>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-800 capitalize text-sm">{month}</h3>
                                    {isCurrentMonth && (
                                        <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            Mês Atual
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col items-end text-[10px] leading-tight mt-0.5">
                                    <span className="text-gray-600 font-semibold">{fmt(totalValue)}</span>
                                    {totalMcValue > 0 && (
                                        <span className="text-indigo-600 font-bold bg-indigo-50/70 border border-indigo-100/50 px-1 py-0.2 rounded mt-0.5">
                                            MC: {fmt(totalMcValue)} ({avgMcPerc.toFixed(1)}%)
                                        </span>
                                    )}
                                    <span className="text-green-600 font-medium mt-0.5">Pg: {fmt(totalPaid)}</span>
                                    {totalPending > 0 && <span className="text-red-600 font-medium">Pd: {fmt(totalPending)}</span>}
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100 overflow-y-auto max-h-[500px]">
                                {[...monthOrders].sort((a, b) => {
                                    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
                                    const dateA = a.isPaid ? new Date(a.paymentDate || a.orderDate) : new Date(a.orderDate);
                                    const dateB = b.isPaid ? new Date(b.paymentDate || b.orderDate) : new Date(b.orderDate);
                                    return dateA - dateB;
                                }).map((order) => (
                                    <div key={order.id} className={clsx("py-1 px-2 flex hover:bg-gray-50 transition-colors gap-1", editingId === order.id ? "flex-col items-stretch" : "items-center justify-between")}>
                                        {editingId === order.id ? (
                                            <div className="flex flex-col gap-1.5 p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5">
                                                    <div className="md:col-span-4">
                                                        <input type="text" value={editForm.clientName} onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="Nome do Cliente" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <input type="number" step="0.01" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="Valor" />
                                                    </div>
                                                    <div className="md:col-span-6">
                                                        <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="Descrição" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                                    <div className="md:col-span-3">
                                                        <input type="date" value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm" />
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <select value={editForm.paymentMethod} onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm">
                                                            <option value="Pix/Transferência">Pix/Transferência</option>
                                                            <option value="Link de pagamento">Link de pagamento</option>
                                                            <option value="Boleto">Boleto</option>
                                                            <option value="Dinheiro">Dinheiro</option>
                                                        </select>
                                                    </div>
                                                    {editForm.paymentMethod === 'Boleto' && (
                                                        <div className="md:col-span-2">
                                                            <input type="text" value={editForm.boletoNumber} onChange={(e) => setEditForm({ ...editForm, boletoNumber: e.target.value })}
                                                                className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="Nº Boleto" />
                                                        </div>
                                                    )}
                                                    <div className="md:col-span-2">
                                                        <input type="text" value={editForm.nfNumber} onChange={(e) => setEditForm({ ...editForm, nfNumber: e.target.value })}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="Nº NF" />
                                                    </div>
                                                    <div className="md:col-span-2 flex justify-end gap-2 items-center">
                                                        <button onClick={handleSaveEdit} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 transition flex items-center gap-1">
                                                            <Check size={14} /> Salvar
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold hover:bg-gray-300 transition flex items-center gap-1">
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-2 border-r border-gray-100">
                                                    <div className="w-32 flex-shrink-0">
                                                        <p className="font-semibold text-gray-800 truncate text-xs" title={order.clientName}>{order.clientName}</p>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {order.paymentMethod && (
                                                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">{order.paymentMethod}</span>
                                                            )}
                                                            {order.nfNumber && (
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">NF: {order.nfNumber}</span>
                                                            )}
                                                            {order.boletoNumber && (
                                                                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-tighter">Bol: {order.boletoNumber}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-gray-600 truncate text-[11px]" title={order.description}>{order.description}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {/* Datas: pedido + pagamento (só se pago) */}
                                                    <div className="text-[10px] text-gray-500 w-28 text-right flex flex-col">
                                                        <span className="truncate">Ped: {new Date(order.orderDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                        {order.isPaid && order.paymentDate ? (
                                                            <span className="font-medium text-green-600 truncate">
                                                                Pg: {new Date(order.paymentDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col">
                                                                <span className="text-red-400 font-medium truncate">Aguardando</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Margem de Contribuição */}
                                                    <div className="w-20 text-center flex flex-col justify-center flex-shrink-0">
                                                        {order.contribMarginValue !== undefined && order.contribMarginValue !== null ? (
                                                            <>
                                                                <span className="font-semibold text-indigo-600 text-[11px]" title={`Margem: ${fmt(order.contribMarginValue)}`}>
                                                                    {fmt(order.contribMarginValue)}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 font-medium">
                                                                    {order.contribMarginPerc?.toFixed(1)}% MC
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">—</span>
                                                        )}
                                                    </div>

                                                    <div className="w-20 font-bold text-right text-gray-800 text-xs flex-shrink-0">
                                                        {fmt(order.value)}
                                                    </div>

                                                    {confirmingId === order.id ? (
                                                        <div className="flex items-center gap-1 bg-white p-1 rounded border border-indigo-200 shadow-sm">
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                onFocus={e => e.target.select()}
                                                                value={paymentDateStr}
                                                                onChange={handlePaymentDateChange}
                                                                onBlur={handlePaymentDateBlur}
                                                                onKeyDown={(e) => handleDateKeyDown(e, order.id)}
                                                                className="w-[72px] text-center text-[10px] p-1 border border-gray-200 rounded outline-none focus:border-indigo-400 font-bold text-indigo-700"
                                                                placeholder="DD/MM/AAAA"
                                                            />
                                                            <button onMouseDown={() => finalizePayment(order.id)} className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded transition-colors" title="Confirmar">
                                                                <Check size={14} />
                                                            </button>
                                                            <button onMouseDown={() => setConfirmingId(null)} className="p-1 bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white rounded transition-colors" title="Cancelar">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => !readOnly && startPaymentConfirmation(order)}
                                                                disabled={readOnly}
                                                                className={clsx(
                                                                    "w-20 text-[10px] py-0.5 rounded-full font-medium border transition-colors text-center",
                                                                    readOnly ? "cursor-default" : "cursor-pointer",
                                                                    order.isPaid
                                                                        ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                                                        : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                                                                )}
                                                            >
                                                                {order.isPaid ? 'PAGO' : 'PENDENTE'}
                                                            </button>

                                                            {!readOnly && (
                                                                <div className="flex flex-col gap-1 ml-1">
                                                                    <button onClick={() => startEditing(order)}
                                                                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1 bg-gray-50 rounded" title="Editar">
                                                                        <Edit2 size={13} />
                                                                    </button>
                                                                    <button onClick={() => handleDelete(order.id)}
                                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-50 rounded" title="Excluir">
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {orders.length === 0 && (
                    <p className="text-center text-gray-500 py-8">Nenhuma entrada cadastrada.</p>
                )}
            </div>

            {/* Modal de Confirmação Unificada */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all duration-300">
                        {/* Modal Header */}
                        <div className={clsx(
                            "px-6 py-4 border-b flex items-center gap-3",
                            confirmModal.theme === 'emerald' && "bg-emerald-50 border-emerald-100 text-emerald-800",
                            confirmModal.theme === 'amber' && "bg-amber-50 border-amber-100 text-amber-800",
                            confirmModal.theme === 'red' && "bg-red-50 border-red-100 text-red-800"
                        )}>
                            <div className={clsx(
                                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                confirmModal.theme === 'emerald' && "bg-emerald-100 text-emerald-600",
                                confirmModal.theme === 'amber' && "bg-amber-100 text-amber-600",
                                confirmModal.theme === 'red' && "bg-red-100 text-red-600"
                            )}>
                                {confirmModal.theme === 'emerald' && <CheckCircle2 size={24} />}
                                {confirmModal.theme === 'amber' && <AlertTriangle size={24} />}
                                {confirmModal.theme === 'red' && <AlertOctagon size={24} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">{confirmModal.title}</h3>
                                <p className="text-xs opacity-80">Confirme a ação antes de prosseguir</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                {confirmModal.message}
                            </p>
                            {confirmModal.details}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl text-sm font-semibold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    await confirmModal.onConfirm();
                                    setConfirmModal(null);
                                }}
                                className={clsx(
                                    "px-4 py-2 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm",
                                    confirmModal.theme === 'emerald' && "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
                                    confirmModal.theme === 'amber' && "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
                                    confirmModal.theme === 'red' && "bg-red-600 hover:bg-red-700 shadow-red-200"
                                )}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Entradas;
