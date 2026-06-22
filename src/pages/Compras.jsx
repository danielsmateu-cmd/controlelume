import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ShoppingBag, FolderPlus, PlusCircle, Search, Trash, Check, X, ClipboardList, HelpCircle } from 'lucide-react';
import { api } from '../services/api';

const Compras = ({ materials, readOnly }) => {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Temp quantity inputs state to hold typed values before saving
    const [qtyInputs, setQtyInputs] = useState({}); // { [itemId]: value }

    // Modals state
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [showItemModal, setShowItemModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [itemSource, setItemSource] = useState('registered'); // 'registered' | 'custom'
    const [selectedMaterialId, setSelectedMaterialId] = useState('');
    const [customItemName, setCustomItemName] = useState('');

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.getCompras();
                
                // Handle migrations of data structure
                let loadedCategories = [];
                let loadedItems = [];

                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    loadedCategories = Array.isArray(data.categories) ? data.categories : [];
                    loadedItems = Array.isArray(data.items) ? data.items : [];
                } else if (Array.isArray(data)) {
                    // Old array format migration
                    loadedCategories = ['Geral'];
                    loadedItems = data.map(item => ({
                        ...item,
                        category: item.category || 'Geral'
                    }));
                }

                // If empty, initialize with default categories and budget materials
                if (loadedCategories.length === 0) {
                    loadedCategories = ['Acrílicos', 'Embalagens', 'Outros'];
                }

                // Map budget materials that are not already present in loadedItems
                const initialItems = [...loadedItems];
                materials.forEach(mat => {
                    const exists = initialItems.some(it => !it.isCustom && it.materialId?.toString() === mat.id.toString());
                    if (!exists) {
                        let cat = 'Outros';
                        if (mat.name.toLowerCase().includes('acrílico') || mat.name.toLowerCase().includes('acrilico')) {
                            cat = 'Acrílicos';
                        } else if (mat.name.toLowerCase().includes('caixa') || mat.name.toLowerCase().includes('embalagem')) {
                            cat = 'Embalagens';
                        }
                        initialItems.push({
                            id: 'mat_' + mat.id,
                            name: mat.name,
                            materialId: mat.id,
                            category: cat,
                            quantity: 0,
                            isCustom: false,
                            createdAt: new Date().toISOString()
                        });
                    }
                });

                // Ensure all item categories exist in the categories list to make them visible
                const finalCategories = [...loadedCategories];
                initialItems.forEach(it => {
                    if (it.category && !finalCategories.includes(it.category)) {
                        finalCategories.push(it.category);
                    }
                });

                // Posicionar a categoria 'Outros' no final se ela existir
                if (finalCategories.includes('Outros')) {
                    const idx = finalCategories.indexOf('Outros');
                    finalCategories.splice(idx, 1);
                    finalCategories.push('Outros');
                }

                setCategories(finalCategories);
                setItems(initialItems);

                // Initialize quantity input fields
                const inputs = {};
                initialItems.forEach(it => {
                    inputs[it.id] = it.quantity > 0 ? it.quantity.toString() : '';
                });
                setQtyInputs(inputs);

            } catch (err) {
                console.error("Erro ao carregar dados de compras:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [materials]);

    // Save data to Supabase
    const saveData = async (newCategories, newItems) => {
        setIsSaving(true);
        try {
            await api.saveCompras({
                categories: newCategories,
                items: newItems
            });
        } catch (err) {
            console.error("Erro ao salvar lista de compras:", err);
            alert("Erro ao salvar no banco de dados.");
        } finally {
            setIsSaving(false);
        }
    };

    // Update Item Quantity with confirmation
    const handleSaveQty = (item) => {
        if (readOnly) return;
        const inputValue = qtyInputs[item.id] || '';
        const qty = inputValue.trim() === '' ? 0 : parseFloat(inputValue);

        if (isNaN(qty) || qty < 0) {
            alert("Por favor, digite uma quantidade válida.");
            return;
        }

        const confirmMessage = qty === 0 
            ? `Tem certeza que deseja remover o item "${item.name}" da lista de compras ativa?`
            : `Deseja realmente salvar o item "${item.name}" com a quantidade de ${qty}?`;

        if (window.confirm(confirmMessage)) {
            const updatedItems = items.map(it => 
                it.id === item.id ? { ...it, quantity: qty } : it
            );
            setItems(updatedItems);
            
            // Clean input if quantity became 0
            if (qty === 0) {
                setQtyInputs(prev => ({ ...prev, [item.id]: '' }));
            }

            saveData(categories, updatedItems);
        }
    };

    // Handle Enter Key in input
    const handleKeyDown = (e, item) => {
        if (e.key === 'Enter') {
            handleSaveQty(item);
        }
    };

    // Add New Category
    const handleAddCategory = (e) => {
        e.preventDefault();
        const catName = newCategoryName.trim();
        if (!catName) return;

        if (categories.some(c => c.toLowerCase() === catName.toLowerCase())) {
            alert("Esta categoria já existe.");
            return;
        }

        const updatedCategories = [...categories, catName];
        setCategories(updatedCategories);
        setNewCategoryName('');
        setShowCategoryModal(false);
        saveData(updatedCategories, items);
    };

    // Add New Item to Category
    const handleAddItem = (e) => {
        e.preventDefault();
        let name = '';
        let materialId = null;
        let isCustom = false;

        if (itemSource === 'registered') {
            if (!selectedMaterialId) {
                alert('Selecione um material.');
                return;
            }
            const mat = materials.find(m => m.id.toString() === selectedMaterialId.toString());
            if (!mat) return;
            
            // Check if already in the list
            if (items.some(it => !it.isCustom && it.materialId?.toString() === mat.id.toString())) {
                alert('Este material já está na lista.');
                return;
            }

            name = mat.name;
            materialId = mat.id;
            isCustom = false;
        } else {
            if (!customItemName.trim()) {
                alert('Digite o nome do item.');
                return;
            }
            name = customItemName.trim();
            materialId = null;
            isCustom = true;
        }

        const newItem = {
            id: isCustom 
                ? 'custom_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
                : 'mat_' + materialId,
            name,
            materialId,
            category: selectedCategory,
            quantity: 0,
            isCustom,
            createdAt: new Date().toISOString()
        };

        const updatedItems = [newItem, ...items];
        setItems(updatedItems);
        
        // Initialize input
        setQtyInputs(prev => ({ ...prev, [newItem.id]: '' }));

        setShowItemModal(false);
        setCustomItemName('');
        setSelectedMaterialId('');

        saveData(categories, updatedItems);
    };

    // Delete item from catalog
    const handleDeleteItem = (itemId) => {
        if (readOnly) return;
        const item = items.find(it => it.id === itemId);
        if (!item) return;

        const confirmMsg = item.isCustom 
            ? `Tem certeza que deseja excluir o item "${item.name}" definitivamente do catálogo de compras?`
            : `Deseja desvincular o material "${item.name}" desta lista de compras? (O material de orçamentos não será afetado)`;

        if (window.confirm(confirmMsg)) {
            const updatedItems = items.filter(it => it.id !== itemId);
            setItems(updatedItems);
            
            // Clean input
            const newInputs = { ...qtyInputs };
            delete newInputs[itemId];
            setQtyInputs(newInputs);

            saveData(categories, updatedItems);
        }
    };

    // Clear all quantities
    const handleClearAllQuantities = () => {
        if (readOnly) return;
        if (window.confirm('Tem certeza que deseja zerar a quantidade de TODOS os itens da lista de compras?')) {
            const updatedItems = items.map(it => ({ ...it, quantity: 0 }));
            setItems(updatedItems);

            const clearedInputs = {};
            updatedItems.forEach(it => {
                clearedInputs[it.id] = '';
            });
            setQtyInputs(clearedInputs);

            saveData(categories, updatedItems);
        }
    };

    // Filter items with active quantities (> 0)
    const activeShoppingList = items.filter(it => it.quantity > 0);

    return (
        <div className="space-y-6 pb-20 print:hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Insumos & Compras da Produção</h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Defina a quantidade de materiais necessários para compras. Adicione materiais customizados que não poluem o catálogo de orçamentos.
                        </p>
                    </div>
                </div>
                {!readOnly && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCategoryModal(true)}
                            className="px-4 py-2.5 bg-white border border-gray-250 text-gray-700 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all flex items-center gap-1.5"
                        >
                            <FolderPlus size={16} /> NOVA CATEGORIA
                        </button>
                        {activeShoppingList.length > 0 && (
                            <button
                                onClick={handleClearAllQuantities}
                                className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold shadow-sm hover:bg-red-100 transition-all flex items-center gap-1.5"
                            >
                                <Trash2 size={16} /> ZERAR QUANTIDADES
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Sync State Indicator */}
            {isSaving && (
                <div className="fixed top-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-bounce z-50">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                    Salvando lista...
                </div>
            )}

            {/* 1. ACTIVE SHOPPING LIST (TOP SECTION) */}
            {activeShoppingList.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-200/60 p-6 rounded-3xl space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardList size={18} className="text-amber-600" /> Itens Adicionados para Compra (Lista Ativa)
                        </h3>
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            {activeShoppingList.length} {activeShoppingList.length === 1 ? 'item' : 'itens'}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-amber-200/50 shadow-sm overflow-hidden divide-y divide-gray-100">
                        {activeShoppingList.map(item => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50/40 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="px-4 py-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-sm font-black min-w-[50px] text-center">
                                        {item.quantity}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                                        <span className="text-[9px] font-black uppercase text-gray-450 bg-gray-100 px-2 py-0.5 rounded border border-gray-150">
                                            {item.category}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setQtyInputs(prev => ({ ...prev, [item.id]: '0' }));
                                        // Confirm removal immediately through standard function
                                        const updatedItems = items.map(it => 
                                            it.id === item.id ? { ...it, quantity: 0 } : it
                                        );
                                        setItems(updatedItems);
                                        setQtyInputs(prev => ({ ...prev, [item.id]: '' }));
                                        saveData(categories, updatedItems);
                                    }}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remover da lista"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Catalog */}
            <div className="relative">
                <Search className="absolute left-3.5 top-3 text-gray-450" size={18} />
                <input
                    type="text"
                    placeholder="Buscar insumos no catálogo..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-semibold"
                />
            </div>

            {/* 2. CATALOG LIST GROUPED BY CATEGORIES */}
            <div className="space-y-8">
                {categories.map(category => {
                    const categoryItems = items.filter(it => 
                        it.category === category && 
                        it.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    if (categoryItems.length === 0 && searchQuery) return null;

                    return (
                        <div key={category} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm space-y-4">
                            {/* Category Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <h3 className="text-base font-extrabold text-gray-700 uppercase tracking-wider">{category}</h3>
                                {!readOnly && (
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            setShowItemModal(true);
                                        }}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        <PlusCircle size={14} /> Adicionar Item
                                    </button>
                                )}
                            </div>

                            {/* Items List */}
                            {categoryItems.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-2">Nenhum item nesta categoria ainda.</p>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {categoryItems.map(item => {
                                        const inputValue = qtyInputs[item.id] ?? '';
                                        const hasUnsavedChanges = inputValue !== '' && parseFloat(inputValue) !== item.quantity;
                                        
                                        return (
                                            <div 
                                                key={item.id} 
                                                className={`py-3 flex items-center justify-between transition-colors ${
                                                    item.quantity > 0 ? 'bg-amber-50/20' : ''
                                                }`}
                                            >
                                                {/* Left side: Quantity Input & Action */}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        value={inputValue}
                                                        onChange={e => setQtyInputs({ ...qtyInputs, [item.id]: e.target.value })}
                                                        onKeyDown={e => handleKeyDown(e, item)}
                                                        className={`w-16 px-2 py-1.5 text-center text-sm font-black border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                            hasUnsavedChanges 
                                                                ? 'border-indigo-400 bg-indigo-50/30' 
                                                                : (item.quantity > 0 ? 'border-amber-300 bg-amber-50 font-bold text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-600')
                                                        }`}
                                                        disabled={readOnly}
                                                        min="0"
                                                        step="any"
                                                    />
                                                    {hasUnsavedChanges && (
                                                        <button
                                                            onClick={() => handleSaveQty(item)}
                                                            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center"
                                                            title="Salvar quantidade"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Middle: Item Name */}
                                                <div className="flex-1 ml-4 flex items-center gap-2 min-w-0">
                                                    <span className={`text-sm font-bold truncate ${item.quantity > 0 ? 'text-amber-800' : 'text-gray-700'}`}>
                                                        {item.name}
                                                    </span>
                                                    {item.isCustom && (
                                                        <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 text-[8px] font-bold rounded">
                                                            Manual
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Right side: Delete/Remove Item Action */}
                                                {!readOnly && (
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="p-1 text-gray-300 hover:text-red-500 transition-colors ml-4"
                                                        title="Excluir item do catálogo"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal: New Category */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-5 text-white flex items-center justify-between">
                            <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                                <FolderPlus size={16} /> Nova Categoria
                            </h3>
                            <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddCategory} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome da Categoria</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Embalagens, Fitas, Chapas..."
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryModal(false)}
                                    className="px-4 py-2 border border-gray-250 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                                >
                                    CRIAR CATEGORIA
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: New Item */}
            {showItemModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-5 text-white flex items-center justify-between">
                            <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                                <PlusCircle size={16} /> Adicionar Item em "{selectedCategory}"
                            </h3>
                            <button onClick={() => setShowItemModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem} className="p-5 space-y-4">
                            {/* Source Selector */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Origem do Material</label>
                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-250">
                                    <button
                                        type="button"
                                        onClick={() => setItemSource('registered')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                            itemSource === 'registered'
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        Material do Sistema
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setItemSource('custom')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                            itemSource === 'custom'
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        Digitar Manualmente
                                    </button>
                                </div>
                            </div>

                            {itemSource === 'registered' ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selecionar Material Cadastrado</label>
                                    <select
                                        value={selectedMaterialId}
                                        onChange={e => setSelectedMaterialId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {materials
                                            // Filter out materials already mapped to any category
                                            .filter(m => !items.some(it => !it.isCustom && it.materialId?.toString() === m.id.toString()))
                                            .map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome do Item Personalizado</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Caixa de Papelão 20x20x10..."
                                        value={customItemName}
                                        onChange={e => setCustomItemName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-750"
                                        required
                                    />
                                    <p className="text-[9px] text-orange-600 font-semibold mt-1">
                                        * Este item será adicionado apenas à lista de compras e não alterará os materiais de orçamentos.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowItemModal(false)}
                                    className="px-4 py-2 border border-gray-250 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                                >
                                    ADICIONAR ITEM
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
