import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ShoppingBag, Search, Package, ArrowLeft, AlertCircle, DollarSign, Calendar, Check, X, FileText, ShoppingCart } from 'lucide-react';
import { api } from '../services/api';

const Compras = ({ materials, readOnly }) => {
    const [compras, setCompras] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('pendente'); // 'pendente' ou 'comprado'

    // Form / Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [itemSource, setItemSource] = useState('registered'); // 'registered' ou 'custom'
    const [selectedMaterialId, setSelectedMaterialId] = useState('');
    const [customName, setCustomName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState('');
    const [notes, setNotes] = useState('');

    // Load data from API
    useEffect(() => {
        const loadCompras = async () => {
            setIsLoading(true);
            try {
                const list = await api.getCompras();
                setCompras(Array.isArray(list) ? list : []);
            } catch (err) {
                console.error("Erro ao buscar lista de compras:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadCompras();
    }, []);

    // Save list to Supabase
    const saveList = async (updatedList) => {
        setIsSaving(true);
        try {
            await api.saveCompras(updatedList);
        } catch (err) {
            console.error("Erro ao salvar lista de compras:", err);
            alert("Erro ao salvar alterações no banco de dados.");
        } finally {
            setIsSaving(false);
        }
    };

    // Open modal for new item
    const handleNewItem = () => {
        setEditingItem(null);
        setItemSource('registered');
        setSelectedMaterialId('');
        setCustomName('');
        setQuantity(1);
        setUnitPrice('');
        setNotes('');
        setShowModal(true);
    };

    // Open modal for editing item
    const handleEditItem = (item) => {
        setEditingItem(item);
        if (item.isCustom) {
            setItemSource('custom');
            setCustomName(item.name);
        } else {
            setItemSource('registered');
            setSelectedMaterialId(item.materialId || '');
        }
        setQuantity(item.quantity);
        setUnitPrice(item.unitPrice ? item.unitPrice.toString() : '');
        setNotes(item.notes || '');
        setShowModal(true);
    };

    // Handle auto-fill price when selecting registered material
    useEffect(() => {
        if (itemSource === 'registered' && selectedMaterialId) {
            const mat = materials.find(m => m.id.toString() === selectedMaterialId.toString());
            if (mat) {
                setUnitPrice(mat.price || '');
            }
        }
    }, [selectedMaterialId, itemSource, materials]);

    // Handle Save Item (Add/Update)
    const handleSaveItem = async (e) => {
        e.preventDefault();

        let name = '';
        let materialId = null;
        let isCustom = false;

        if (itemSource === 'registered') {
            if (!selectedMaterialId) {
                alert('Selecione um material cadastrado.');
                return;
            }
            const mat = materials.find(m => m.id.toString() === selectedMaterialId.toString());
            if (!mat) return;
            name = mat.name;
            materialId = mat.id;
            isCustom = false;
        } else {
            if (!customName.trim()) {
                alert('Digite o nome do item.');
                return;
            }
            name = customName.trim();
            materialId = null;
            isCustom = true;
        }

        const qtyVal = parseFloat(quantity) || 1;
        const priceVal = parseFloat(unitPrice) || 0;

        let updatedList;
        if (editingItem) {
            // Update existing
            updatedList = compras.map(item => 
                item.id === editingItem.id 
                    ? {
                        ...item,
                        name,
                        materialId,
                        isCustom,
                        quantity: qtyVal,
                        unitPrice: priceVal,
                        notes: notes.trim(),
                        updatedAt: new Date().toISOString()
                      }
                    : item
            );
        } else {
            // Add new
            const newItem = {
                id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
                name,
                materialId,
                isCustom,
                quantity: qtyVal,
                unitPrice: priceVal,
                notes: notes.trim(),
                status: 'pendente', // 'pendente' ou 'comprado'
                createdAt: new Date().toISOString()
            };
            updatedList = [newItem, ...compras];
        }

        setCompras(updatedList);
        setShowModal(false);
        await saveList(updatedList);
    };

    // Toggle item status (Pendente / Comprado)
    const handleToggleStatus = async (itemId) => {
        if (readOnly) return;
        const updatedList = compras.map(item => {
            if (item.id === itemId) {
                const newStatus = item.status === 'comprado' ? 'pendente' : 'comprado';
                return { 
                    ...item, 
                    status: newStatus,
                    boughtAt: newStatus === 'comprado' ? new Date().toISOString() : null
                };
            }
            return item;
        });
        setCompras(updatedList);
        await saveList(updatedList);
    };

    // Delete item
    const handleDeleteItem = async (itemId) => {
        if (readOnly) return;
        if (window.confirm('Tem certeza que deseja remover este item da lista de compras?')) {
            const updatedList = compras.filter(item => item.id !== itemId);
            setCompras(updatedList);
            await saveList(updatedList);
        }
    };

    // Filters and search logic
    const filteredCompras = compras.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = item.status === activeFilter;
        return matchesSearch && matchesFilter;
    });

    // Summary calculations
    const pendingCount = compras.filter(c => c.status === 'pendente').length;
    const pendingTotalCost = compras
        .filter(c => c.status === 'pendente')
        .reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 1)), 0);

    const boughtCount = compras.filter(c => c.status === 'comprado').length;
    const boughtTotalCost = compras
        .filter(c => c.status === 'comprado')
        .reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 1)), 0);

    return (
        <div className="space-y-6 pb-20 print:hidden animate-in fade-in duration-300">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Lista de Compras</h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Gestão de insumos e matérias-primas que precisam ser comprados pela produção.
                        </p>
                    </div>
                </div>
                {!readOnly && (
                    <button
                        onClick={handleNewItem}
                        className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/10 hover:bg-indigo-700 transition-all flex items-center gap-2 transform hover:scale-[1.01]"
                    >
                        <Plus size={18} /> ADICIONAR ITEM PARA COMPRA
                    </button>
                )}
            </div>

            {/* Sync State Indicator */}
            {isSaving && (
                <div className="fixed top-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-bounce z-50">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                    Salvando no banco de dados...
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pendentes de Compra</p>
                        <h3 className="text-3xl font-black text-slate-800">{pendingCount}</h3>
                        <p className="text-xs font-semibold text-amber-600">
                            Custo Est.: {pendingTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                        <AlertCircle size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Itens Comprados</p>
                        <h3 className="text-3xl font-black text-slate-800">{boughtCount}</h3>
                        <p className="text-xs font-semibold text-emerald-600">
                            Total Pago: {boughtTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                        <CheckCircle2 size={24} />
                    </div>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar item ou observação..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                </div>

                {/* Filters */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => setActiveFilter('pendente')}
                        className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeFilter === 'pendente'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Pendentes ({pendingCount})
                    </button>
                    <button
                        onClick={() => setActiveFilter('comprado')}
                        className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeFilter === 'comprado'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Comprados ({boughtCount})
                    </button>
                </div>
            </div>

            {/* Loading / Empty / List State */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm gap-4">
                    <span className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 font-semibold">Carregando lista de compras...</p>
                </div>
            ) : filteredCompras.length === 0 ? (
                <div className="p-16 border-2 border-dashed border-gray-200 bg-white rounded-3xl text-center flex flex-col items-center justify-center gap-4 shadow-sm">
                    <ShoppingCart size={48} className="text-gray-305" />
                    <div>
                        <p className="text-gray-500 font-bold text-lg">Nenhum item localizado</p>
                        <p className="text-gray-400 text-xs mt-1">
                            {searchQuery ? 'Tente mudar o termo da busca.' : 'Adicione itens à lista para começar a planejar suas compras.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase w-12 text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Item</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-center">Qtd</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Est. Unitário</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Est. Total</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Anotações</th>
                                    <th className="px-6 py-4 text-center w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCompras.map(item => {
                                    const totalCost = (item.unitPrice || 0) * (item.quantity || 1);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleToggleStatus(item.id)}
                                                    disabled={readOnly}
                                                    className="focus:outline-none transition-transform active:scale-90"
                                                    title={item.status === 'comprado' ? 'Marcar como Pendente' : 'Marcar como Comprado'}
                                                >
                                                    {item.status === 'comprado' ? (
                                                        <CheckCircle2 className="text-emerald-500 hover:text-emerald-600" size={20} />
                                                    ) : (
                                                        <Circle className="text-gray-300 hover:text-indigo-500" size={20} />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-750 flex items-center gap-2">
                                                    {item.name}
                                                    {item.isCustom ? (
                                                        <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 text-[9px] font-bold rounded-md">
                                                            Manual
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded-md">
                                                            Orçamento
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1 font-medium">
                                                    <Calendar size={10} />
                                                    {new Date(item.createdAt).toLocaleDateString('pt-BR')} às {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-700">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                {item.unitPrice > 0 
                                                    ? item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-indigo-600">
                                                {totalCost > 0
                                                    ? totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate font-medium" title={item.notes}>
                                                {item.notes || <span className="text-gray-300 italic">Sem observações</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                {!readOnly && (
                                                    <div className="flex justify-center items-center gap-1">
                                                        <button
                                                            onClick={() => handleEditItem(item)}
                                                            className="p-1.5 text-gray-350 hover:text-indigo-650 transition-colors"
                                                            title="Editar item"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.82a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="p-1.5 text-gray-355 hover:text-red-500 transition-colors"
                                                            title="Excluir item"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create/Edit Item Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col my-8 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <ShoppingBag size={20} />
                                {editingItem ? 'Editar Item de Compra' : 'Novo Item para Compra'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4 flex-1">
                            {/* Source Selector */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Origem do Item</label>
                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setItemSource('registered')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                            itemSource === 'registered'
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-150'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        Material de Orçamento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setItemSource('custom')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                            itemSource === 'custom'
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-150'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        Digitar Manualmente
                                    </button>
                                </div>
                            </div>

                            {/* Item Inputs based on Source */}
                            {itemSource === 'registered' ? (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Package size={12} className="text-indigo-500" /> Material do Sistema
                                    </label>
                                    <select
                                        value={selectedMaterialId}
                                        onChange={e => setSelectedMaterialId(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        required
                                    >
                                        <option value="">Selecione um material...</option>
                                        {materials.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.type === 'unit' ? 'unid' : m.type === 'linear' ? 'm linear' : 'chapa'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <FileText size={12} className="text-orange-500" /> Nome do Material Manual
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Caixa de Papelão 20x20x10"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-750"
                                        required
                                    />
                                </div>
                            )}

                            {/* Quantity and Price Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantidade</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preço Unitário (R$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Opcional"
                                        value={unitPrice}
                                        onChange={e => setUnitPrice(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observações / Motivo da Compra</label>
                                <textarea
                                    placeholder="Ex: Utilizado para envio de medalhas do pedido #2034."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-650 resize-none font-medium"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 border border-gray-250 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                                >
                                    <Check size={14} />
                                    {editingItem ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR À LISTA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compras;
