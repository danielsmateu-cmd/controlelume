import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Entradas = ({ orders, setOrders, readOnly = false }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    const [formData, setFormData] = useState({
        clientName: '', description: '',
        orderDate: new Date().toISOString().split('T')[0],
        value: '',
        paymentDate: new Date().toISOString().split('T')[0],
        isPaid: false, installments: 1,
        installmentDates: [new Date().toISOString().split('T')[0]],
        paymentMethod: 'Pix/Transferência', nfNumber: '', boletoNumber: ''
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'installments') {
            const n = parseInt(value);
            setFormData(prev => ({ ...prev, installments: n, installmentDates: Array(n).fill(formData.paymentDate || new Date().toISOString().split('T')[0]) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleInstallmentDateChange = (index, value) => {
        const newDates = [...formData.installmentDates];
        newDates[index] = value;
        setFormData(prev => ({ ...prev, installmentDates: newDates }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const totalValue = parseFloat(formData.value) || 0;
        const numInstallments = parseInt(formData.installments);
        const installmentValue = totalValue / numInstallments;
        const newOrders = formData.installmentDates.map((date, index) => ({
            id: Date.now() + index,
            clientName: formData.clientName,
            description: numInstallments > 1 ? `${formData.description} (${index + 1}/${numInstallments})` : formData.description,
            orderDate: formData.orderDate,
            value: installmentValue, paymentDate: date, isPaid: formData.isPaid,
            paymentMethod: formData.paymentMethod, nfNumber: formData.nfNumber,
            boletoNumber: formData.paymentMethod === 'Boleto' ? formData.boletoNumber : '',
            year: new Date(date + 'T00:00:00').getUTCFullYear()
        }));
        setOrders([...newOrders, ...orders]);
        setFormData({
            clientName: '', description: '',
            orderDate: new Date().toISOString().split('T')[0], value: '',
            paymentDate: new Date().toISOString().split('T')[0], isPaid: false,
            installments: 1, installmentDates: [new Date().toISOString().split('T')[0]],
            paymentMethod: 'Pix/Transferência', nfNumber: '', boletoNumber: ''
        });
    };

    const togglePaymentStatus = (id) => setOrders(orders.map(order => order.id === id ? { ...order, isPaid: !order.isPaid } : order));
    const handleDelete = (id) => { if (window.confirm('Tem certeza que deseja excluir esta entrada?')) setOrders(orders.filter(order => order.id !== id)); };

    const filteredOrders = orders.filter(order => {
        const orderYear = order.year || new Date(order.paymentDate || order.orderDate).getFullYear();
        return orderYear === selectedYear;
    });

    const label = "block text-[11px] font-medium text-slate-500 mb-1";
    const inputCls = "input-field";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Entradas</h2>
                    {readOnly && (
                        <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">👁️ Somente Visualização</span>
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

            {/* Formulário */}
            {!readOnly && (
                <div className="bg-white rounded-xl border border-slate-100 p-5" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,.06)' }}>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Nova Entrada</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">

                        <div className="col-span-1 md:col-span-4">
                            <label className={label}>Nome do Cliente</label>
                            <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} className={inputCls} required />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className={label}>Valor (R$)</label>
                            <input type="number" step="0.01" name="value" value={formData.value} onChange={handleInputChange} className={clsx(inputCls, "mono-num")} required />
                        </div>

                        <div className="col-span-1 md:col-span-4">
                            <label className={label}>Descrição do Pedido</label>
                            <input type="text" name="description" value={formData.description} onChange={handleInputChange} className={inputCls} required placeholder="Descrição curta" />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className={label}>Nº Nota Fiscal</label>
                            <input type="text" name="nfNumber" value={formData.nfNumber} onChange={handleInputChange} className={inputCls} placeholder="Ex: 12345" />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className={label}>Data do Pedido</label>
                            <input type="date" name="orderDate" value={formData.orderDate} onChange={handleInputChange} className={inputCls} required />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className={label}>Data de Pagamento</label>
                            <input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleInputChange} className={inputCls} required />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className={label}>Forma de Pagamento</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={inputCls}>
                                <option value="Pix/Transferência">Pix/Transferência</option>
                                <option value="Link de pagamento">Link de pagamento</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>

                        {formData.paymentMethod === 'Boleto' && (
                            <div className="col-span-1 md:col-span-2">
                                <label className={label}>Nº do Boleto</label>
                                <input type="text" name="boletoNumber" value={formData.boletoNumber} onChange={handleInputChange} className={inputCls} placeholder="Nº Boleto" />
                            </div>
                        )}

                        <div className="col-span-1 md:col-span-1 flex items-end pb-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="isPaid" id="isPaid" checked={formData.isPaid} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300" />
                                <span className="text-xs font-semibold text-slate-700">Pago</span>
                            </label>
                        </div>

                        <div className="col-span-1 md:col-span-1">
                            <label className={label}>Parcelas</label>
                            <select name="installments" value={formData.installments} onChange={handleInputChange} className={inputCls}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-12 lg:col-span-1 flex items-end">
                            <button type="submit" className="btn-primary w-full">
                                <Plus size={15} /> Adicionar
                            </button>
                        </div>

                        {formData.installments > 1 && (
                            <div className="col-span-1 md:col-span-12 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Vencimento das Parcelas</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {formData.installmentDates.map((date, index) => (
                                        <div key={index}>
                                            <label className="block text-[9px] text-slate-400 mb-0.5">{index + 1}ª Parcela</label>
                                            <input type="date" required value={date} onChange={(e) => handleInstallmentDateChange(index, e.target.value)}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* Lista agrupada por mês */}
            <div className="space-y-5">
                {Object.entries(filteredOrders.reduce((acc, order) => {
                    const monthYear = new Date(order.orderDate).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const key = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(order);
                    return acc;
                }, {})).map(([month, monthOrders]) => {
                    const totalValue = monthOrders.reduce((sum, o) => sum + o.value, 0);
                    const totalPaid = monthOrders.filter(o => o.isPaid).reduce((sum, o) => sum + o.value, 0);
                    const totalPending = totalValue - totalPaid;

                    return (
                        <div key={month} className="bg-white rounded-xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,.06)' }}>
                            {/* Header do mês */}
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-700 capitalize text-sm">{month}</h3>
                                <div className="flex gap-5 text-xs">
                                    <span className="text-slate-500">Total: <span className="font-bold text-slate-700 mono-num">{fmt(totalValue)}</span></span>
                                    <span className="text-emerald-600">Pago: <span className="font-bold mono-num">{fmt(totalPaid)}</span></span>
                                    <span className="text-red-500">Pendente: <span className="font-bold mono-num">{fmt(totalPending)}</span></span>
                                </div>
                            </div>

                            {/* Linhas */}
                            <div className="divide-y divide-slate-50">
                                {monthOrders.map((order) => (
                                    <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-44 flex-shrink-0">
                                                <p className="font-semibold text-slate-800 truncate text-sm" title={order.clientName}>{order.clientName}</p>
                                                <div className="flex flex-wrap gap-x-2 mt-0.5">
                                                    {order.paymentMethod && <span className="text-[10px] font-medium text-indigo-400 uppercase">{order.paymentMethod}</span>}
                                                    {order.nfNumber && <span className="text-[10px] text-slate-400">NF: {order.nfNumber}</span>}
                                                    {order.boletoNumber && <span className="text-[10px] text-amber-500">Boleto: {order.boletoNumber}</span>}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-slate-500 truncate text-sm" title={order.description}>{order.description}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-5 flex-shrink-0">
                                            <div className="text-xs text-slate-400 w-36 flex flex-col items-end gap-0.5">
                                                <span>Pedido: {new Date(order.orderDate).toLocaleDateString('pt-BR')}</span>
                                                <span className="text-indigo-500 font-medium">Pgto: {new Date(order.paymentDate).toLocaleDateString('pt-BR')}</span>
                                            </div>

                                            <div className="w-28 font-semibold text-right text-slate-800 text-sm mono-num">
                                                {fmt(order.value)}
                                            </div>

                                            <button
                                                onClick={() => !readOnly && togglePaymentStatus(order.id)}
                                                disabled={readOnly}
                                                className={clsx(
                                                    "px-3 py-0.5 rounded-full text-[10px] font-bold border transition-colors w-20 text-center",
                                                    readOnly ? "cursor-default" : "cursor-pointer",
                                                    order.isPaid
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                        : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                                )}
                                            >
                                                {order.isPaid ? 'PAGO' : 'PENDENTE'}
                                            </button>

                                            {!readOnly && (
                                                <button onClick={() => handleDelete(order.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {orders.length === 0 && (
                    <div className="text-center text-slate-400 py-16">
                        <p className="text-sm">Nenhuma entrada cadastrada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Entradas;
