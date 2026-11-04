import React, { useState, useEffect } from "react";
import { Download, RefreshCw, CheckCircle, AlertTriangle, ArrowRight, X } from "lucide-react";
import { mlApi, mlListings } from "../../services/mlApi";
import { api } from "../../services/api";

const ImportacaoVendasML = ({ currentMonth, onImported, fts }) => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); 
    
    const [tally, setTally] = useState({});
    const [listings, setListings] = useState([]);
    const [meliOverrides, setMeliOverrides] = useState({});
    const [ftVariations, setFtVariations] = useState({});
    
    

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
                // Apenas orders "paid" contam como vendas reais no relatorio do ML (ignora pendentes, canceladas, etc)
                  if (order.status !== 'paid') continue;
                
                for (const item of order.order_items || []) {
                    const mlId = item.item?.id;
                    const variationId = item.item?.variation_id;
                    const qty = item.quantity || 1;
                    const title = item.item?.title || "Produto Desconhecido";
                    const sellerSku = item.item?.seller_sku || item.item?.seller_custom_field || "";
                    
                    if (mlId) {
                        const tallyKey = variationId ? `${mlId}_${variationId}` : mlId;
                        if (!currentTally[tallyKey]) {
                            currentTally[tallyKey] = { 
                                total: 0, 
                                revenue: 0,
                                title: title + (variationId ? ` (Var: ${variationId})` : ''), 
                                mlId, 
                                variationId,
                                sellerSku,
                                tallyKey 
                            };
                        } else if (!currentTally[tallyKey].sellerSku && sellerSku) {
                            currentTally[tallyKey].sellerSku = sellerSku;
                        }
                        currentTally[tallyKey].total += qty;
                        currentTally[tallyKey].revenue += (qty * (item.unit_price || 0));
                    }
                }
            }
            
            setTally(currentTally);
            
            const existingListings = await mlListings.getListings();
            setListings(existingListings);
            const ovr = await api.getSettings('ft_overrides_meli') || {};
            setMeliOverrides(ovr);
            const varsData = await api.getSettings('ft_variations') || {};
            setFtVariations(varsData);
            
            setStep(2);
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar vendas do ML: " + err.message);
            setStep(0);
        } finally {
            setLoading(false);
        }
    };

    const handleLinkFt = async (tallyKey, ftId, targetVarId = null) => {
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

            // Salva o SKU na FT ou na Variação da FT dentro do sistema para ficar permanente
            const skuToSave = item.sellerSku || listing?.sku || '';
            const targetFt = fts.find(f => f.id === ftId);
            if (targetFt && skuToSave) {
                // Se o usuário selecionou uma variação específica
                if (targetVarId) {
                    const currentVars = await api.getSettings('ft_variations') || {};
                    const ftVarsList = currentVars[targetFt.ftCode] || targetFt.variations || [];
                    const updatedList = ftVarsList.map(v => {
                        if (v.id === targetVarId) {
                            return {
                                ...v,
                                skus: { ...(v.skus || {}), meli: skuToSave },
                                sku: skuToSave
                            };
                        }
                        return v;
                    });
                    currentVars[targetFt.ftCode] = updatedList;
                    await api.saveSettings('ft_variations', currentVars);
                    setFtVariations(currentVars);
                } else {
                    // Salva no override principal
                    const currentOvr = await api.getSettings('ft_overrides_meli') || {};
                    currentOvr[targetFt.ftCode] = {
                        ...(currentOvr[targetFt.ftCode] || {}),
                        sku: skuToSave,
                        updatedAt: new Date().toISOString()
                    };
                    await api.saveSettings('ft_overrides_meli', currentOvr);
                    setMeliOverrides(currentOvr);
                }
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao vincular FT");
        }
    };

    const getMappedFtId = (tallyItem) => {
        const listing = listings.find(l => l.ml_item_id === tallyItem.mlId);
        
        let foundFtId = null;
        if (listing) {
            if (tallyItem.variationId && listing.variations) {
                const v = listing.variations.find(v => String(v.id) === String(tallyItem.variationId));
                if (v && v.ft_id) foundFtId = v.ft_id;
            }
            if (!foundFtId) foundFtId = listing.ft_id; // fallback to parent
        }
        
        // IMPORTANT: Verify if the mapped ftId actually exists in the current active FTs!
        if (foundFtId && fts.some(ft => ft.id === foundFtId)) {
            return foundFtId;
        }

        // Auto-match por SKU salvo na FT, nas variações da FT ou no override do ML
        const itemSku = tallyItem.sellerSku || listing?.sku;
        if (itemSku) {
            const cleanSku = String(itemSku).trim().toLowerCase();
            
            // 1. Procura em ft_overrides_meli (principal ou variações)
            const matchedCode = Object.keys(meliOverrides || {}).find(ftCode => {
                const ovr = meliOverrides[ftCode] || {};
                if (ovr.sku && String(ovr.sku).trim().toLowerCase() === cleanSku) return true;
                if ((ovr.variations || []).some(v => v.sku && String(v.sku).trim().toLowerCase() === cleanSku)) return true;
                return false;
            });
            if (matchedCode) {
                const matchedFt = fts.find(f => f.ftCode.toLowerCase() === matchedCode.toLowerCase());
                if (matchedFt) return matchedFt.id;
            }

            // 2. Procura em ftVariations
            const matchedVarCode = Object.keys(ftVariations || {}).find(ftCode => {
                const list = ftVariations[ftCode] || [];
                return list.some(v => {
                    const skuMeli = v.skus?.meli || v.sku;
                    return skuMeli && String(skuMeli).trim().toLowerCase() === cleanSku;
                });
            });
            if (matchedVarCode) {
                const matchedFt = fts.find(f => f.ftCode.toLowerCase() === matchedVarCode.toLowerCase());
                if (matchedFt) return matchedFt.id;
            }

            // 3. Procura nas FTs diretamente (ft.sku, ftCode ou ft.variations)
            const matchedDirect = fts.find(f => {
                const ftSku = f.sku || f.skus?.meli;
                if (ftSku && String(ftSku).trim().toLowerCase() === cleanSku) return true;
                if (f.ftCode && f.ftCode.toLowerCase() === cleanSku) return true;
                
                const vars = f.variations || ftVariations[f.ftCode] || [];
                if (vars.some(v => {
                    const vSku = v.skus?.meli || v.sku;
                    return vSku && String(vSku).trim().toLowerCase() === cleanSku;
                })) return true;

                return false;
            });
            if (matchedDirect) return matchedDirect.id;
        }
        
        return null;
    };

    const handleApply = () => {
        const ftData = {};
        
        Object.values(tally).forEach(item => {
            const ftId = getMappedFtId(item);
            if (ftId) {
                if (!ftData[ftId]) ftData[ftId] = { qty: 0, revenue: 0 };
                ftData[ftId].qty += item.total;
                ftData[ftId].revenue += item.revenue;
            }
        });
        
        onImported(ftData);
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
                        Integração Automática Mercado Livre
                    </h3>
                    <p className="text-xs text-indigo-600 mt-1">Busque as vendas do mês e preencha automaticamente a planilha.</p>
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
                                {unmappedItems.length} produto(s) ou variações precisam ser mapeados para uma FT
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {unmappedItems.map(item => (
                                    <div key={item.tallyKey} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white rounded border border-amber-100 gap-2">
                                        <div className="text-xs">
                                            <div className="font-semibold text-gray-800 line-clamp-1 flex items-center gap-2" title={item.title}>
                                                <span>{item.title}</span>
                                                {item.sellerSku && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        SKU: {item.sellerSku}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-gray-500 text-[10px]">
                                                ID: {item.mlId} {item.variationId && `• Var: ${item.variationId}`} • Vendas: <span className="font-bold text-indigo-600">{item.total}</span>
                                            </div>
                                        </div>
                                        <select 
                                            onChange={(e) => { 
                                                if (e.target.value) {
                                                    const [ftId, varId] = e.target.value.split('::');
                                                    handleLinkFt(item.tallyKey, ftId, varId || null);
                                                }
                                            }}
                                            className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 bg-white font-medium max-w-[280px] shadow-2xs"
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Vincular a uma FT...</option>
                                            {fts.map(ft => {
                                                const vars = ft.variations || ftVariations[ft.ftCode] || [];
                                                if (vars.length > 0) {
                                                    return (
                                                        <optgroup key={ft.id} label={ft.ftCode + ' - ' + ft.name + ' (' + vars.length + ' variações)'}>
                                                            <option value={ft.id + '::'}>
                                                                {ft.ftCode} - Produto Principal (Geral)
                                                            </option>
                                                            {vars.map(v => (
                                                                <option key={v.id} value={ft.id + '::' + v.id}>
                                                                    ↳ {ft.ftCode} / {v.name || 'Variação'} {v.skus?.meli ? '(SKU: ' + v.skus.meli + ')' : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    );
                                                }
                                                return (
                                                    <option key={ft.id} value={ft.id + '::'}>
                                                        {ft.ftCode} - {ft.name} {ft.sku ? '(SKU: ' + ft.sku + ')' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Todos os itens vendidos já estão mapeados corretamente!
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
