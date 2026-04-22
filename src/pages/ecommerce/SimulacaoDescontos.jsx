import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Calculator, CheckCircle2, AlertCircle, Search, X, History, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PLATFORMS = [
    {
        id: 'meli',
        label: 'Mercado Livre',
        emoji: '🛒',
        color: 'bg-yellow-400 hover:bg-yellow-500',
        activeColor: 'bg-yellow-500',
        ring: 'ring-yellow-300',
        textColor: 'text-yellow-900',
    },
    {
        id: 'shopee',
        label: 'Shopee',
        emoji: '🧡',
        color: 'bg-orange-500 hover:bg-orange-600',
        activeColor: 'bg-orange-600',
        ring: 'ring-orange-300',
        textColor: 'text-white',
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        emoji: '🎵',
        color: 'bg-gray-900 hover:bg-black',
        activeColor: 'bg-black',
        ring: 'ring-gray-500',
        textColor: 'text-white',
    },
    {
        id: 'amazon',
        label: 'Amazon',
        emoji: '📦',
        color: 'bg-amber-500 hover:bg-amber-600',
        activeColor: 'bg-amber-600',
        ring: 'ring-amber-300',
        textColor: 'text-white',
    },
    {
        id: 'site',
        label: 'Site',
        emoji: '🌐',
        color: 'bg-indigo-600 hover:bg-indigo-700',
        activeColor: 'bg-indigo-700',
        ring: 'ring-indigo-300',
        textColor: 'text-white',
    },
];

const SimulacaoDescontos = ({ readOnly = false }) => {
    const [activePlatform, setActivePlatform] = useState('meli');
    const [fts, setFts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [discounts, setDiscounts] = useState({});
    const [stockData, setStockData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingCounts, setPendingCounts] = useState({});
    const [historyModal, setHistoryModal] = useState(null);
    
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    
    // To handle debounced save
    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [activePlatform]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const stockPromises = PLATFORMS.map(p => api.getSettings(`estoque_marketplace_${p.id}`));
            const [dbFts, mktOverrides, simDiscounts, ...stocksData] = await Promise.all([
                api.getFts(),
                api.getSettings(`ft_overrides_${activePlatform}`),
                api.getSettings(`simulacao_descontos_${activePlatform}`),
                ...stockPromises
            ]);

            const overridesData = mktOverrides || {};
            const savedDiscounts = simDiscounts || {};
            
            // Current active platform stock
            const activePlatformIndex = PLATFORMS.findIndex(p => p.id === activePlatform);
            const savedStock = stocksData[activePlatformIndex] || {};
            
            // Calculate pending counts for all platforms
            const newPendingCounts = {};
            PLATFORMS.forEach((p, idx) => {
                const stockSettings = stocksData[idx] || {};
                let count = 0;
                Object.values(stockSettings).forEach(item => {
                    if (item && item.status === 'pending' && item.quantity > 0) {
                        count++;
                    }
                });
                newPendingCounts[p.id] = count;
            });
            
            setDiscounts(savedDiscounts);
            setStockData(savedStock);
            setPendingCounts(newPendingCounts);

            let finalFts = [...dbFts];

            finalFts = finalFts.map(ft => {
                if (overridesData[ft.ftCode]) {
                    return { ...ft, ...overridesData[ft.ftCode], isOverride: true };
                }
                return ft;
            });

            finalFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));
            setFts(finalFts);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscountChange = (ftCode, value) => {
        const numValue = parseFloat(value);
        const newDiscounts = { ...discounts };
        
        if (isNaN(numValue) || value === '') {
            newDiscounts[ftCode] = '';
        } else {
            newDiscounts[ftCode] = numValue;
        }

        setDiscounts(newDiscounts);

        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set a new timeout to save after 1 second of inactivity
        saveTimeoutRef.current = setTimeout(() => {
            // Only save if it's not readOnly
            if (!readOnly) {
                api.saveSettings(`simulacao_descontos_${activePlatform}`, newDiscounts);
            }
        }, 1000);
    };

    const handleStockChange = (ftCode, value) => {
        if (!isAdmin) return;
        
        const numValue = parseInt(value, 10);
        const newStock = { ...stockData };
        const existingHistory = newStock[ftCode]?.history || [];
        
        if (isNaN(numValue) || value === '') {
            newStock[ftCode] = { quantity: 0, status: 'pending', appliedAt: null, history: existingHistory };
        } else {
            newStock[ftCode] = { quantity: numValue, status: 'pending', appliedAt: null, history: existingHistory };
        }

        setStockData(newStock);
        api.saveSettings(`estoque_marketplace_${activePlatform}`, newStock);
        
        // Update local pending count immediately for UI feedback
        setPendingCounts(prev => {
            const count = Object.values(newStock).filter(item => item && item.status === 'pending' && item.quantity > 0).length;
            return { ...prev, [activePlatform]: count };
        });
    };

    const handleStockConfirm = (ftCode) => {
        if (isAdmin) return; // Only simulator confirms
        
        if (window.confirm('Confirma que você adicionou esta quantidade de estoque no marketplace?')) {
            const newStock = { ...stockData };
            if (newStock[ftCode]) {
                const now = new Date();
                const appliedStr = now.toLocaleString('pt-BR');
                newStock[ftCode].status = 'applied';
                newStock[ftCode].appliedAt = appliedStr;
                
                newStock[ftCode].history = newStock[ftCode].history || [];
                newStock[ftCode].history.push({
                    date: appliedStr,
                    quantity: newStock[ftCode].quantity,
                    user: currentUser?.name || 'Funcionário'
                });
                setStockData(newStock);
                api.saveSettings(`estoque_marketplace_${activePlatform}`, newStock);
                
                // Update local pending count immediately for UI feedback
                setPendingCounts(prev => {
                    const count = Object.values(newStock).filter(item => item && item.status === 'pending' && item.quantity > 0).length;
                    return { ...prev, [activePlatform]: count };
                });
                
                alert('Confirmado com sucesso!');
            }
        }
    };

    const deleteHistoryEntry = (ftCode, realIndex) => {
        if (!isAdmin) return;
        
        if (window.confirm('Tem certeza que deseja apagar este registro do histórico?')) {
            const newStock = { ...stockData };
            if (newStock[ftCode] && newStock[ftCode].history) {
                newStock[ftCode].history.splice(realIndex, 1);
                setStockData(newStock);
                api.saveSettings(`estoque_marketplace_${activePlatform}`, newStock);
            }
        }
    };

    const filteredFts = fts.filter(ft => 
        ft.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        ft.ftCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Simulação de Descontos</h1>
                    <p className="text-gray-500 mt-1">Simule a aplicação de um percentual de desconto para os produtos em cada marketplace.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Selecionar Marketplace para Simulação</p>
                <div className="flex flex-wrap gap-3">
                    {PLATFORMS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setActivePlatform(p.id)}
                            className={clsx(
                                'relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                                p.color,
                                p.textColor,
                                activePlatform === p.id
                                    ? `ring-2 ${p.ring} ring-offset-2 shadow-lg scale-105`
                                    : 'opacity-70 hover:opacity-100'
                            )}
                        >
                            <span className="text-base">{p.emoji}</span>
                            {p.label}
                            {pendingCounts[p.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                    {pendingCounts[p.id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-indigo-600" />
                            Painel de Simulação - {PLATFORMS.find(p => p.id === activePlatform)?.label}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Os valores simulados abaixo são salvos apenas para visualização e não alteram o cadastro real da FT.
                        </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Buscar por nome ou código..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-sm"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
            </div>

            {fts.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Fichas Técnicas</h3>
                        <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full">{fts.length} itens</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-white uppercase border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Cód / Nome</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Venda Atual</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Custos (Mat+Dir)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap border-r border-gray-100">Margem Atual</th>
                                    <th className="px-6 py-3 font-medium text-center whitespace-nowrap bg-indigo-50/50">Desconto (%)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap bg-indigo-50/50">Venda Simulada</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap bg-indigo-50/50 border-r border-gray-100">Nova Margem</th>
                                    <th className="px-6 py-3 font-medium text-center whitespace-nowrap bg-emerald-50">Estoque a Adicionar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredFts.map((ft) => {
                                    // Current Values Calculations
                                    const ftTotalMat = ft.materials ? ft.materials.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) : 0;
                                    const ftTotalDirRS = ft.directCostsRS ? ft.directCostsRS.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) : 0;
                                    
                                    const currentSalePrice = parseFloat(ft.salePrice) || 0;

                                    const ftTotalDirPercValue = ft.directCostsPercent ? ft.directCostsPercent.reduce((acc, curr) => {
                                        return acc + (((parseFloat(curr.percentage) || 0) / 100) * currentSalePrice);
                                    }, 0) : 0;

                                    const currentTotalCosts = ftTotalMat + ftTotalDirRS + ftTotalDirPercValue;
                                    const currentMarginRS = currentSalePrice - currentTotalCosts;
                                    const currentMarginPercent = currentSalePrice > 0 ? (currentMarginRS / currentSalePrice) * 100 : 0;

                                    // Simulation Calculations
                                    const discountValue = discounts[ft.ftCode];
                                    const validDiscount = (typeof discountValue === 'number' && !isNaN(discountValue)) ? discountValue : 0;
                                    
                                    // New Sale Price = Current Sale Price - (Current Sale Price * Discount / 100)
                                    const simulatedSalePrice = currentSalePrice * (1 - (validDiscount / 100));

                                    // New Percent Costs based on Simulated Sale Price
                                    const simulatedTotalDirPercValue = ft.directCostsPercent ? ft.directCostsPercent.reduce((acc, curr) => {
                                        return acc + (((parseFloat(curr.percentage) || 0) / 100) * simulatedSalePrice);
                                    }, 0) : 0;

                                    const simulatedTotalCosts = ftTotalMat + ftTotalDirRS + simulatedTotalDirPercValue;
                                    const simulatedMarginRS = simulatedSalePrice - simulatedTotalCosts;
                                    const simulatedMarginPercent = simulatedSalePrice > 0 ? (simulatedMarginRS / simulatedSalePrice) * 100 : 0;

                                    // Stock Data
                                    const ftStock = stockData[ft.ftCode] || { quantity: 0, status: 'pending', appliedAt: null };

                                    return (
                                        <tr key={ft.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                    <span className="text-gray-500">{ft.ftCode}</span>
                                                    <span>{ft.name} {ft.variation && <span className="text-gray-500 font-normal ml-1">({ft.variation})</span>}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap">
                                                R$ {currentSalePrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                R$ {currentTotalCosts.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right border-r border-gray-100">
                                                <div className={clsx("font-semibold", currentMarginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                    R$ {currentMarginRS.toFixed(2)}
                                                </div>
                                                <div className={clsx("text-xs font-bold", currentMarginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                    {currentMarginPercent.toFixed(1)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 bg-indigo-50/30">
                                                <div className="flex justify-center items-center">
                                                    <div className="relative w-24">
                                                        <input
                                                            type="number"
                                                            value={discountValue !== undefined ? discountValue : ''}
                                                            onChange={(e) => handleDiscountChange(ft.ftCode, e.target.value)}
                                                            className="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 pr-6 shadow-sm text-center font-bold text-indigo-900"
                                                            placeholder="0"
                                                            step="0.1"
                                                            min="0"
                                                            max="100"
                                                        />
                                                        <span className="absolute right-2 top-2 text-xs text-gray-400 font-bold">%</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right bg-indigo-50/30">
                                                <div className={clsx("font-bold", validDiscount > 0 ? "text-indigo-700" : "text-gray-900")}>
                                                    R$ {simulatedSalePrice.toFixed(2)}
                                                </div>
                                                {validDiscount > 0 && (
                                                    <div className="text-[10px] text-gray-500 line-through">
                                                        De: R$ {currentSalePrice.toFixed(2)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right bg-indigo-50/30 border-r border-gray-100">
                                                <div className={clsx("font-bold text-base", simulatedMarginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                    R$ {simulatedMarginRS.toFixed(2)}
                                                </div>
                                                <div className={clsx("text-xs font-bold", simulatedMarginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                    {simulatedMarginPercent.toFixed(1)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 bg-emerald-50/30 text-center">
                                                {isAdmin ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={ftStock.status === 'pending' ? (ftStock.quantity || '') : ''}
                                                                onChange={(e) => handleStockChange(ft.ftCode, e.target.value)}
                                                                className="w-20 text-sm border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-center font-bold"
                                                                placeholder="Qtd"
                                                                min="0"
                                                            />
                                                            <span className="text-xs text-gray-500 font-medium">un</span>
                                                        </div>
                                                        {ftStock.status === 'applied' && ftStock.quantity > 0 && (
                                                            <div className="flex flex-col items-center gap-1 mt-1">
                                                                <div className="flex flex-col items-center gap-0.5 text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded-lg text-center">
                                                                    <div className="flex items-center gap-1"><CheckCircle2 size={12} /> OK: {ftStock.quantity} un</div>
                                                                    <div>{ftStock.appliedAt}</div>
                                                                </div>
                                                                {(ftStock.history && ftStock.history.length > 0) && (
                                                                    <button onClick={() => setHistoryModal(ft.ftCode)} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 transition-colors mt-0.5">
                                                                        <History size={10} /> Histórico
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {ftStock.status === 'pending' && ftStock.quantity > 0 && (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold mt-1">
                                                                <AlertCircle size={12} /> Pendente
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        {ftStock.quantity > 0 ? (
                                                            <>
                                                                <div className="font-black text-lg text-emerald-700">
                                                                    +{ftStock.quantity} un
                                                                </div>
                                                                {ftStock.status === 'pending' ? (
                                                                    <button
                                                                        onClick={() => handleStockConfirm(ft.ftCode)}
                                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Dar OK
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-1 mt-1">
                                                                        <div className="flex flex-col items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-100 px-3 py-1.5 rounded-xl text-center shadow-sm">
                                                                            <div className="flex items-center gap-1"><CheckCircle2 size={14} /> OK: {ftStock.quantity} un</div>
                                                                            <div className="text-[10px]">{ftStock.appliedAt}</div>
                                                                        </div>
                                                                        {(ftStock.history && ftStock.history.length > 0) && (
                                                                            <button onClick={() => setHistoryModal(ft.ftCode)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-1 bg-indigo-50 px-2 py-1 rounded-lg">
                                                                                <History size={12} /> Ver Histórico
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic">-</span>
                                                        )}
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
            ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
                    Nenhuma Ficha Técnica encontrada.
                </div>
            )}

            {/* Modal de Histórico */}
            {historyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden m-4">
                        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                            <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600" />
                                Histórico de Estoque
                            </h2>
                            <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 mb-4">
                                Mostrando o histórico de estoque adicionado no marketplace para a FT: <span className="font-bold text-gray-800">{historyModal}</span>
                            </p>
                            
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                {stockData[historyModal]?.history?.length > 0 ? (
                                    stockData[historyModal].history.slice().reverse().map((hist, idx) => {
                                        const originalLength = stockData[historyModal].history.length;
                                        const realIndex = originalLength - 1 - idx;
                                        return (
                                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                                            <div>
                                                <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                                    {hist.date}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-0.5">Por: {hist.user}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg text-sm shadow-sm">
                                                    +{hist.quantity} un
                                                </div>
                                                {isAdmin && (
                                                    <button 
                                                        onClick={() => deleteHistoryEntry(historyModal, realIndex)}
                                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Excluir registro do histórico"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )})
                                ) : (
                                    <div className="text-center text-sm text-gray-400 py-4 italic">Nenhum histórico registrado.</div>
                                )}
                            </div>
                            <div className="mt-6 flex justify-end pt-4 border-t border-gray-100">
                                <button onClick={() => setHistoryModal(null)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimulacaoDescontos;
