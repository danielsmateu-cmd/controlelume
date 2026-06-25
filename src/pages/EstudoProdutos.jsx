import React, { useState, useEffect } from 'react';
import { Lightbulb, Plus, Trash2, Edit, ExternalLink, ChevronUp, ChevronDown, X, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatPercent = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((val || 0) / 100);
};

const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let clean = String(val).replace(/[R$\s]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
};

const EMPTY_FORM = {
    name: '',
    link: '',
    saleValue: '',
    productionCost: '',
    monthlySales: '',
    image: ''
};

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</h3>
                <div className={clsx("mt-1.5 text-2xl font-bold text-gray-800", colorClass)}>
                    {value}
                </div>
                {subtitle && <p className="text-[11px] text-gray-400 mt-1 font-medium">{subtitle}</p>}
            </div>
            {Icon && (
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Icon size={22} />
                </div>
            )}
        </div>
    );
};

const EstudoProdutos = ({ readOnly }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSave, setLoadingSave] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [zoomImage, setZoomImage] = useState(null);

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    setForm(f => ({ ...f, image: event.target.result }));
                };
                reader.readAsDataURL(file);
                e.preventDefault();
                break;
            }
        }
    };

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            try {
                const data = await api.getSettings('estudo_produtos');
                if (data && Array.isArray(data)) {
                    setProducts(data);
                } else {
                    setProducts([]);
                }
            } catch (err) {
                console.error("Erro ao carregar estudo de produtos:", err);
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, []);

    const saveList = async (newList) => {
        setLoadingSave(true);
        try {
            await api.saveSettings('estudo_produtos', newList);
        } catch (err) {
            console.error("Erro ao salvar lista:", err);
            alert("Erro ao persistir os dados no servidor. Tente novamente.");
        } finally {
            setLoadingSave(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingProduct(null);
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (product) => {
        setEditingProduct(product);
        setForm({
            name: product.name,
            link: product.link || '',
            saleValue: String(product.saleValue || ''),
            productionCost: String(product.productionCost || ''),
            monthlySales: String(product.monthlySales || ''),
            image: product.image || ''
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        const productData = {
            name: form.name.trim(),
            link: form.link.trim(),
            saleValue: parseNumber(form.saleValue),
            productionCost: parseNumber(form.productionCost),
            monthlySales: parseInt(form.monthlySales) || 0,
            image: form.image || ''
        };

        let newList;
        if (editingProduct) {
            newList = products.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p);
        } else {
            const newProduct = {
                id: Date.now().toString(),
                ...productData,
                created_at: new Date().toISOString()
            };
            newList = [...products, newProduct];
        }

        setProducts(newList);
        await saveList(newList);
        setIsModalOpen(false);
        setForm(EMPTY_FORM);
        setEditingProduct(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente remover este produto do estudo?")) return;
        const newList = products.filter(p => p.id !== id);
        setProducts(newList);
        await saveList(newList);
    };

    const handleMoveUp = async (index) => {
        if (index === 0) return;
        const newList = [...products];
        const temp = newList[index];
        newList[index] = newList[index - 1];
        newList[index - 1] = temp;
        setProducts(newList);
        await saveList(newList);
    };

    const handleMoveDown = async (index) => {
        if (index === products.length - 1) return;
        const newList = [...products];
        const temp = newList[index];
        newList[index] = newList[index + 1];
        newList[index + 1] = temp;
        setProducts(newList);
        await saveList(newList);
    };

    // Cálculos Gerais das Métricas
    const totalProducts = products.length;
    
    const calculatedProducts = products.map(p => {
        const sale = p.saleValue || 0;
        const cost = p.productionCost || 0;
        const qty = p.monthlySales || 0;
        
        const marginRS = sale - cost;
        const marginPct = sale > 0 ? (marginRS / sale) * 100 : 0;
        const projMarginRS = marginRS * qty;
        
        return {
            ...p,
            marginRS,
            marginPct,
            projMarginRS
        };
    });

    const totalProjMargin = calculatedProducts.reduce((sum, p) => sum + p.projMarginRS, 0);
    const avgMarginPct = calculatedProducts.length > 0 
        ? calculatedProducts.reduce((sum, p) => sum + p.marginPct, 0) / calculatedProducts.length
        : 0;
    const avgTicket = calculatedProducts.length > 0
        ? calculatedProducts.reduce((sum, p) => sum + p.saleValue, 0) / calculatedProducts.length
        : 0;

    // Métricas do formulário em tempo real
    const liveSale = parseNumber(form.saleValue);
    const liveCost = parseNumber(form.productionCost);
    const liveMarginRS = liveSale - liveCost;
    const liveMarginPct = liveSale > 0 ? (liveMarginRS / liveSale) * 100 : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <p className="mt-4 text-sm text-gray-500 font-medium animate-pulse">Carregando estudo de produtos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Lightbulb className="text-indigo-600" size={24} />
                        Estudo de Produtos
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Analise e ordene a viabilidade de lançamentos em Marketplaces</p>
                </div>
                {!readOnly && (
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Adicionar Produto
                    </button>
                )}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total de Ideias" 
                    value={totalProducts} 
                    subtitle="Produtos em estudo" 
                    icon={Lightbulb}
                />
                <StatCard 
                    title="Margem Média" 
                    value={formatPercent(avgMarginPct)} 
                    subtitle="Sobre o preço de venda" 
                    icon={TrendingUp}
                    colorClass={avgMarginPct >= 40 ? "text-green-600" : avgMarginPct >= 25 ? "text-amber-500" : "text-red-500"}
                />
                <StatCard 
                    title="Ticket Médio" 
                    value={formatCurrency(avgTicket)} 
                    subtitle="Preço de venda médio"
                />
                <StatCard 
                    title="Margem Mensal Projetada" 
                    value={formatCurrency(totalProjMargin)} 
                    subtitle="Resultado total se lançados" 
                    colorClass="text-green-600"
                />
            </div>

            {/* Lista de Produtos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {calculatedProducts.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400 mb-4">
                            <Lightbulb size={28} />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">Nenhum produto cadastrado nesta lista de estudo.</p>
                        {!readOnly && (
                            <button
                                onClick={handleOpenAddModal}
                                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                                Adicionar o primeiro produto
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    <th className="px-6 py-4 w-[40px]">Ordem</th>
                                    <th className="px-6 py-4">Produto</th>
                                    <th className="px-6 py-4 text-right">Valor Venda</th>
                                    <th className="px-6 py-4 text-right">Custo Venda</th>
                                    <th className="px-6 py-4 text-right">Margem Unit.</th>
                                    <th className="px-6 py-4 text-right">Vendas/Mês</th>
                                    <th className="px-6 py-4 text-right">Projeção Mensal</th>
                                    <th className="px-6 py-4 text-center w-[120px]">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                                {calculatedProducts.map((p, idx) => {
                                    // Pílula da margem unitária
                                    const marginBadgeClass = p.marginPct >= 50 
                                        ? "bg-green-50 text-green-700 border-green-100" 
                                        : p.marginPct >= 30 
                                            ? "bg-amber-50 text-amber-700 border-amber-100" 
                                            : "bg-red-50 text-red-700 border-red-100";

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                            {/* Ordenador */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center justify-center">
                                                    <button
                                                        onClick={() => handleMoveUp(idx)}
                                                        disabled={idx === 0 || readOnly || loadingSave}
                                                        className="p-0.5 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors"
                                                        title="Mover para cima"
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveDown(idx)}
                                                        disabled={idx === products.length - 1 || readOnly || loadingSave}
                                                        className="p-0.5 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors"
                                                        title="Mover para baixo"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            {/* Nome e Link */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {p.image ? (
                                                        <img 
                                                            src={p.image} 
                                                            alt={p.name} 
                                                            className="w-10 h-10 object-cover rounded-lg border border-gray-150 shadow-sm cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                                                            onClick={() => setZoomImage(p.image)}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0">
                                                            <Lightbulb size={15} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-gray-800 break-words max-w-[250px]">{p.name}</div>
                                                        {p.link ? (
                                                            <a
                                                                href={p.link.startsWith('http') ? p.link : `https://${p.link}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5 mt-0.5"
                                                            >
                                                                Link do Produto <ExternalLink size={10} />
                                                            </a>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400 italic">Sem link associado</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Preço de Venda */}
                                            <td className="px-6 py-4 text-right font-medium">
                                                {formatCurrency(p.saleValue)}
                                            </td>
                                            {/* Custo de Venda */}
                                            <td className="px-6 py-4 text-right text-gray-500">
                                                {formatCurrency(p.productionCost)}
                                            </td>
                                            {/* Margem de Contribuição Unitária */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-semibold text-gray-800">{formatCurrency(p.marginRS)}</span>
                                                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full border mt-0.5 font-bold", marginBadgeClass)}>
                                                        {formatPercent(p.marginPct)}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Vendas mensais */}
                                            <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                {p.monthlySales} un.
                                            </td>
                                            {/* Margem Projetada Mensal */}
                                            <td className="px-6 py-4 text-right font-bold text-gray-800">
                                                {formatCurrency(p.projMarginRS)}
                                            </td>
                                            {/* Ações */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditModal(p)}
                                                        disabled={loadingSave}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-all disabled:opacity-50"
                                                        title="Editar produto"
                                                    >
                                                        <Edit size={15} />
                                                    </button>
                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => handleDelete(p.id)}
                                                            disabled={loadingSave}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                                                            title="Excluir produto"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Add/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-1.5">
                                <Lightbulb className="text-indigo-600" size={18} />
                                {editingProduct ? 'Editar Produto em Estudo' : 'Novo Produto para Estudo'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSave} onPaste={handlePaste} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome do Produto *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Luminária de Mesa Flexível"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Link de Referência / Concorrente</label>
                                <input
                                    type="text"
                                    placeholder="Ex: shopee.com.br/produto-xyz"
                                    value={form.link}
                                    onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                />
                            </div>

                            {/* Campo de Imagem (Colar ou Selecionar) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Imagem (Print Ctrl+V / Arquivo)</label>
                                <div 
                                    className="border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors relative group bg-gray-50/50 hover:bg-white min-h-[90px] flex items-center justify-center"
                                >
                                    {form.image ? (
                                        <div className="relative inline-block w-full">
                                            <img src={form.image} alt="Preview" className="max-h-36 rounded-lg object-contain mx-auto border" />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setForm(f => ({ ...f, image: '' }));
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow-md z-10"
                                                title="Remover Imagem"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 flex flex-col items-center justify-center gap-1 py-1 w-full">
                                            <span className="font-semibold text-indigo-600">Cole (Ctrl+V) um print aqui</span>
                                            <span>ou clique para selecionar</span>
                                            <input 
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            setForm(f => ({ ...f, image: event.target.result }));
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preço de Venda (R$)</label>
                                    <input
                                        type="text"
                                        placeholder="0,00"
                                        value={form.saleValue}
                                        onChange={e => setForm(f => ({ ...f, saleValue: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Custo de Venda (R$)</label>
                                    <input
                                        type="text"
                                        placeholder="0,00"
                                        value={form.productionCost}
                                        onChange={e => setForm(f => ({ ...f, productionCost: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Vendas Estimadas / Mês</label>
                                <input
                                    type="number"
                                    placeholder="Ex: 50"
                                    min="0"
                                    value={form.monthlySales}
                                    onChange={e => setForm(f => ({ ...f, monthlySales: e.target.value }))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                />
                            </div>

                            {/* Visualização de Margem em Tempo Real */}
                            {(liveSale > 0 || liveCost > 0) && (
                                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 text-xs flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Margem Estimada:</span>
                                    <div className="text-right">
                                        <span className="font-bold text-gray-800 block">{formatCurrency(liveMarginRS)}</span>
                                        <span className={clsx("font-bold text-[10px] px-1.5 py-0.5 rounded-full border", 
                                            liveMarginPct >= 50 
                                                ? "bg-green-50 text-green-700 border-green-100" 
                                                : liveMarginPct >= 30 
                                                    ? "bg-amber-50 text-amber-700 border-amber-100" 
                                                    : "bg-red-50 text-red-700 border-red-100"
                                        )}>
                                            {formatPercent(liveMarginPct)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={loadingSave}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {editingProduct ? 'Salvar Alterações' : 'Adicionar Produto'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Zoom Imagem (Lightbox) */}
            {zoomImage && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
                    onClick={() => setZoomImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-1.5 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setZoomImage(null)}
                            className="absolute top-4 right-4 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition-colors z-10 shadow-lg"
                        >
                            <X size={18} />
                        </button>
                        <img 
                            src={zoomImage} 
                            alt="Visualização" 
                            className="max-w-full max-h-[85vh] object-contain rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default EstudoProdutos;
