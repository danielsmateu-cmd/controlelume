import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const Entradas = ({ orders, setOrders, readOnly = false }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    const [formData, setFormData] = useState({
        clientName: '',
        description: '',
        orderDate: new Date().toISOString().split('T')[0],
        value: '',
        paymentDate: new Date().toISOString().split('T')[0],
        isPaid: false,
        installments: 1,
        installmentDates: [new Date().toISOString().split('T')[0]],
        paymentMethod: 'Pix/Transferência',
        nfNumber: '',
        boletoNumber: ''
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'installments') {
            const n = parseInt(value);
            const dates = Array(n).fill(formData.paymentDate || new Date().toISOString().split('T')[0]);
            setFormData(prev => ({
                ...prev,
                installments: n,
                installmentDates: dates
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleInstallmentDateChange = (index, value) => {
        const newDates = [...formData.installmentDates];
        newDates[index] = value;
        setFormData(prev => ({
            ...prev,
            installmentDates: newDates
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const totalValue = parseFloat(formData.value) || 0;
        const numInstallments = parseInt(formData.installments);
        const installmentValue = totalValue / numInstallments;

        const newOrders = formData.installmentDates.map((date, index) => ({
            id: Date.now() + index,
            clientName: formData.clientName,
            description: numInstallments > 1
                ? `${formData.description} (${index + 1}/${numInstallments})`
                : formData.description,
            orderDate: formData.orderDate,
            value: installmentValue,
            paymentDate: date,
            isPaid: formData.isPaid,
            paymentMethod: formData.paymentMethod,
            nfNumber: formData.nfNumber,
            boletoNumber: formData.paymentMethod === 'Boleto' ? formData.boletoNumber : '',
            year: new Date(date + 'T00:00:00').getUTCFullYear()
        }));

        setOrders([...newOrders, ...orders]);
        setFormData({
            clientName: '',
            description: '',
            orderDate: new Date().toISOString().split('T')[0],
            value: '',
            paymentDate: new Date().toISOString().split('T')[0],
            isPaid: false,
            installments: 1,
            installmentDates: [new Date().toISOString().split('T')[0]],
            paymentMethod: 'Pix/Transferência',
            nfNumber: '',
            boletoNumber: ''
        });
    };

    const togglePaymentStatus = (id) => {
        setOrders(orders.map(order =>
            order.id === id
                ? { ...order, isPaid: !order.isPaid }
                : order
        ));
    };

    const handleDelete = (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta entrada?')) {
            setOrders(orders.filter(order => order.id !== id));
        }
    };

    const filteredOrders = orders.filter(order => {
        const orderYear = order.year || new Date(order.paymentDate || order.orderDate).getFullYear();
        return orderYear === selectedYear;
    });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Entradas</h2>
                {readOnly ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                        👁️ Somente Visualização
                    </span>
                ) : (
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
                )}
            </div>

            {!readOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Nova Entrada</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">

                        <div className="col-span-1 md:col-span-4">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nome do Cliente</label>
                            <input
                                type="text"
                                name="clientName"
                                value={formData.clientName}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Valor (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="value"
                                value={formData.value}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            />
                        </div>

                        <div className="col-span-1 md:col-span-4">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Descrição do Pedido</label>
                            <input
                                type="text"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                                placeholder="Descrição curta"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nº Nota Fiscal</label>
                            <input
                                type="text"
                                name="nfNumber"
                                value={formData.nfNumber}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                placeholder="Ex: 12345"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data do Pedido</label>
                            <input
                                type="date"
                                name="orderDate"
                                value={formData.orderDate}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            />
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Data de Pagamento</label>
                            <input
                                type="date"
                                name="paymentDate"
                                value={formData.paymentDate}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Forma de Pagamento</label>
                            <select
                                name="paymentMethod"
                                value={formData.paymentMethod}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            >
                                <option value="Pix/Transferência">Pix/Transferência</option>
                                <option value="Link de pagamento">Link de pagamento</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>

                        {formData.paymentMethod === 'Boleto' && (
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Nº do Boleto</label>
                                <input
                                    type="text"
                                    name="boletoNumber"
                                    value={formData.boletoNumber}
                                    onChange={handleInputChange}
                                    className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    placeholder="Nº Boleto"
                                />
                            </div>
                        )}

                        <div className={clsx("col-span-1 flex items-end pb-1.5", formData.paymentMethod === 'Boleto' ? "md:col-span-1" : "md:col-span-1")}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isPaid"
                                    id="isPaid"
                                    checked={formData.isPaid}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                />
                                <label htmlFor="isPaid" className="text-xs font-medium text-gray-700">Pago</label>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-1">
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Parcelas</label>
                            <select
                                name="installments"
                                value={formData.installments}
                                onChange={handleInputChange}
                                className="w-full p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                    <option key={n} value={n}>{n}x</option>
                                ))}
                            </select>
                        </div>

                        <div className={clsx("col-span-1 flex items-end", formData.paymentMethod === 'Boleto' ? "md:col-span-12 lg:col-span-1" : "md:col-span-12 lg:col-span-1")}>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">
                                <Plus size={16} /> Adicionar
                            </button>
                        </div>

                        {formData.installments > 1 && (
                            <div className="col-span-1 md:col-span-12 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Vencimento das Parcelas</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {formData.installmentDates.map((date, index) => (
                                        <div key={index}>
                                            <label className="block text-[9px] text-gray-500 mb-0.5">{index + 1}ª Parcela</label>
                                            <input
                                                type="date"
                                                required
                                                value={date}
                                                onChange={(e) => handleInstallmentDateChange(index, e.target.value)}
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

            <div className="space-y-6">
                {Object.entries(filteredOrders.reduce((acc, order) => {
                    const monthYear = new Date(order.orderDate).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
                    const key = capitalize(monthYear);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(order);
                    return acc;
                }, {})).map(([month, monthOrders]) => {
                    const totalValue = monthOrders.reduce((sum, order) => sum + order.value, 0);
                    const totalPaid = monthOrders.filter(o => o.isPaid).reduce((sum, order) => sum + order.value, 0);
                    const totalPending = totalValue - totalPaid;

                    return (
                        <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-2 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-800 capitalize">{month}</h3>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-gray-600">
                                        Total: <span className="font-semibold">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </span>
                                    <span className="text-green-600">
                                        Pago: <span className="font-semibold">{totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </span>
                                    <span className="text-red-600">
                                        Pendente: <span className="font-semibold">{totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {monthOrders.map((order) => (
                                    <div key={order.id} className="p-2 flex items-center justify-between hover:bg-gray-50 transition-colors gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-48 flex-shrink-0">
                                                <p className="font-semibold text-gray-800 truncate text-sm" title={order.clientName}>{order.clientName}</p>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {order.paymentMethod && (
                                                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">{order.paymentMethod}</span>
                                                    )}
                                                    {order.nfNumber && (
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">NF: {order.nfNumber}</span>
                                                    )}
                                                    {order.boletoNumber && (
                                                        <span className="text-[9px] font-bold text-orange-400 uppercase tracking-tighter">Boleto: {order.boletoNumber}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-gray-600 truncate text-sm" title={order.description}>{order.description}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 flex-shrink-0">
                                            <div className="text-xs text-gray-500 w-40 text-center flex flex-col">
                                                <span>Pedido: {new Date(order.orderDate).toLocaleDateString('pt-BR')}</span>
                                                <span className="font-medium text-indigo-600">Pgto: {new Date(order.paymentDate).toLocaleDateString('pt-BR')}</span>
                                            </div>

                                            <div className="w-32 font-medium text-right text-gray-800 text-sm">
                                                {order.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>

                                            <button
                                                onClick={() => !readOnly && togglePaymentStatus(order.id)}
                                                disabled={readOnly}
                                                className={clsx("w-20 text-[10px] py-0.5 rounded-full font-medium border transition-colors text-center",
                                                    readOnly ? "cursor-default" : "cursor-pointer",
                                                    order.isPaid
                                                        ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                                        : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                                                )}>
                                                {order.isPaid ? 'PAGO' : 'PENDENTE'}
                                            </button>

                                            {!readOnly && (
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
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
                    <p className="text-center text-gray-500 py-8">Nenhuma entrada cadastrada.</p>
                )}
            </div>
        </div>
    );
};

export default Entradas;
