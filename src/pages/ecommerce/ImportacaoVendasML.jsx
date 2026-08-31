import React, { useState, useEffect } from "react";
import { Download, RefreshCw, CheckCircle, AlertTriangle, ArrowRight, X } from "lucide-react";
import { mlApi, mlListings } from "../../services/mlApi";
import { api } from "../../services/api";

const ImportacaoVendasML = ({ currentMonth, onImported, fts }) => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); 
    
    const [tally, setTally] = useState({});
    const [listings, setListings] = useState([]);
    
    if (window.location.hostname !== "localhost") return null;

    const fetchMonthlyOrders = async () => {
        setLoading(true);
        setStep(1);
        try {
            const [yearStr, monthStr] = currentMonth.split("-");
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            
            const targetDate = new Date(year, month - 2, 1);
            const targetYear = targetDate.getFullYear();
            const targetMonth = targetDate.getMonth();
            
            const from = new Date(targetYear, targetMonth, 1, 0, 0, 0).toISOString();
            const to = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999).toISOString();

            const allOrders = await mlApi.getAllOrdersByDate(from, to);
            
            const currentTally = {};
            for (const order of allOrders) {
                if (order.status === 'cancelled' || order.status === 'invalid') continue;
                
                for (const item of order.order_items || []) {
                    const mlId = item.item?.id;
                    const variationId = item.item?.variation_id;
                    const qty = item.quantity || 1;
                    const title = item.item?.title || "Produto Desconhecido";
                    
                    if (mlId) {
                        const tallyKey = variationId ? `${mlId}_${variationId}` : mlId;
                        if (!currentTally[tallyKey]) {
                            currentTally[tallyKey] = { 
                                total: 0, 
                                title: title + (variationId ? ` (Var: ${variationId})` : ''), 
                                mlId, 
                                variationId,
                                tallyKey 
                            };
                        }
                        currentTally[tallyKey].total += qty;
                    }
                }
            }
            
            setTally(currentTally);
            
            const existingListings = await mlListings.getListings();
            setListings(existingListings);
            
            setStep(2);
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar vendas do ML: " + err.message);
            setStep(0);
        } finally {
            setLoading(false);
        }
    };

    const handleLinkFt = async (tallyKey, ftId) => {
        try {
            const item = tally[tallyKey];
            let listing = listings.find(l => l.ml_item_id === item.mlId);
            
            if (!listing) {
                const itemDetails = await mlApi.getItem(item.mlId);
                await mlListings.saveListings([itemDetails]);
                const updatedListings = await mlListings.getListings();
                setListings(updatedListings);
                listing = updatedListings.find(l => l.ml_item_id === item.mlId);
            }
            
            if (listing) {
                if (item.variationId) {
                    await mlListings.linkVariationFt(listing.id, item.variationId, ftId);
                    setListings(prev => prev.map(l => {
                        if (l.id !== listing.id) return l;
                        const newVars = (l.variations || []).map(v => 
                            String(v.id) === String(item.variationId) ? { ...v, ft_id: ftId } : v
                        );
                        return { ...l, variations: newVars };
                    }));
                } else {
                    await mlListings.linkFt(listing.id, ftId);
                    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, ft_id: ftId } : l));
                }
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao vincular FT");
        }
    };

    const getMappedFtId = (tallyItem) => {
        const listing = listings.find(l => l.ml_item_id === tallyItem.mlId);
        if (!listing) return null;
        if (tallyItem.variationId && listing.variations) {
            const v = listing.variations.find(v => String(v.id) === String(tallyItem.variationId));
            if (v && v.ft_id) return v.ft_id;
        }
        return listing.ft_id; // fallback to parent
    };

    const handleApply = () => {
        const ftQuantities = {};
        
        Object.values(tally).forEach(item => {
            const ftId = getMappedFtId(item);
            if (ftId) {
                if (!ftQuantities[ftId]) ftQuantities[ftId] = 0;
                ftQuantities[ftId] += item.total;
            }
        });
        
        onImported(ftQuantities);
        setStep(3);
        setTimeout(() => setStep(0), 3000);
    };

    const unmappedItems = Object.values(tally).filter(item => !getMappedFtId(item));

    return (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                        <Download className="w-4 h-4 text-indigo-500" />
                        Integracao Automatica Mercado Livre (Localhost)
                    </h3>
                    <p className="text-xs text-indigo-600 mt-1">Busque as vendas do mes e preencha automaticamente a planilha.</p>
                </div>
                
                {step === 0 && (
                    <button 
                        onClick={fetchMonthlyOrders}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Sincronizar Vendas do Mes
                    </button>
                )}
                
                {step === 3 && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg text-xs font-bold border border-emerald-200">
                        <CheckCircle className="w-4 h-4" />
                        Vendas aplicadas com sucesso!
                    </div>
                )}
            </div>
            
            {step === 2 && (
                <div className="border-t border-indigo-50 pt-4 mt-2">
                    {unmappedItems.length > 0 ? (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                {unmappedItems.length} produto(s) ou variacoes precisam ser mapeados para uma FT
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {unmappedItems.map(item => (
                                    <div key={item.tallyKey} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white rounded border border-amber-100 gap-2">
                                        <div className="text-xs">
                                            <div className="font-semibold text-gray-800 line-clamp-1" title={item.title}>{item.title}</div>
                                            <div className="text-gray-500 text-[10px]">
                                                ID: {item.mlId} {item.variationId && `• Var: ${item.variationId}`} • Vendas: <span className="font-bold text-indigo-600">{item.total}</span>
                                            </div>
                                        </div>
                                        <select 
                                            onChange={(e) => { if(e.target.value) handleLinkFt(item.tallyKey, e.target.value) }}
                                            className="text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 bg-gray-50 max-w-[200px]"
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Selecione a FT correspondente...</option>
                                            {fts.map(ft => (
                                                <option key={ft.id} value={ft.id}>{ft.ftCode} - {ft.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Todos os itens vendidos ja estao mapeados corretamente!
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 mt-4">
                        <button 
                            onClick={() => setStep(0)}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleApply}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                            Aplicar Vendas ({Object.values(tally).reduce((acc, curr) => acc + curr.total, 0)} itens)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportacaoVendasML;
