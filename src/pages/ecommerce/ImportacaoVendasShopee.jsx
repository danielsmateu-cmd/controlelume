import React, { useState, useEffect } from "react";
import { Download, Upload, CheckCircle, AlertTriangle, ArrowRight, FileSpreadsheet, X, RefreshCw, Zap, Link2 } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../../services/api";
import { shopeeAuth, shopeeApi } from "../../services/shopeeApi";

const ImportacaoVendasShopee = ({ currentMonth, onImported, fts }) => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: Inicial / Upload, 2: Revisão de Mapeamento, 3: Sucesso
    const [fileName, setFileName] = useState("");
    const [tally, setTally] = useState({});
    const [shopeeOverrides, setShopeeOverrides] = useState({});
    const [ftVariations, setFtVariations] = useState({});
    const [isApiConnected, setIsApiConnected] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const ovr = await api.getSettings('ft_overrides_shopee') || {};
            setShopeeOverrides(ovr);
            const varsData = await api.getSettings('ft_variations') || {};
            setFtVariations(varsData);
            const connected = await shopeeAuth.isConnected();
            setIsApiConnected(connected);
        } catch (err) {
            console.error("Erro ao carregar configurações da Shopee:", err);
        }
    };

    // Sincronização direta via API Oficial da Shopee (1-Clique)
    const fetchApiMonthlyOrders = async () => {
        setLoading(true);
        try {
            const [yearStr, monthStr] = currentMonth.split('-');
            const currentTally = await shopeeApi.getMonthlyOrders(yearStr, monthStr);

            if (!currentTally || Object.keys(currentTally).length === 0) {
                alert("Nenhum pedido encontrado na Shopee para este mês.");
                setLoading(false);
                return;
            }

            await loadSettings();
            setTally(currentTally);
            setFileName("API Oficial Shopee");
            setStep(2);
        } catch (err) {
            console.error("Erro ao sincronizar Shopee via API:", err);
            alert("Erro ao buscar vendas da Shopee via API: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Função para normalizar texto de cabeçalho da planilha
    const normalizeHeader = (header) => {
        return String(header || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setFileName(file.name);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!rawData || rawData.length < 2) {
                alert("O arquivo selecionado está vazio ou não possui linhas de dados.");
                setLoading(false);
                return;
            }

            // Identificar índices das colunas no cabeçalho
            const headerRow = rawData[0].map(normalizeHeader);

            const findColIndex = (predicates) => {
                return headerRow.findIndex(h => predicates.some(p => h.includes(p)));
            };

            const idxOrderId = findColIndex(["id do pedido", "numero do pedido", "order id", "order sn"]);
            const idxStatus = findColIndex(["status do pedido", "status", "order status"]);
            const idxProductName = findColIndex(["nome do produto", "produto", "product name"]);
            const idxVariationName = findColIndex(["nome da variacao", "variacao", "variation name"]);
            const idxVarSku = findColIndex([
                "numero de referencia do sku da variacao",
                "sku da variacao",
                "referencia da variacao",
                "codigo da variacao",
                "variation sku"
            ]);
            const idxProdSku = findColIndex([
                "numero de referencia do sku",
                "sku de referencia",
                "referencia do sku",
                "codigo do produto",
                "sku",
                "product sku"
            ]);
            const idxQty = findColIndex(["quantidade", "qtd", "quantity"]);
            const idxPrice = findColIndex([
                "preco acordado",
                "preco com desconto",
                "preco negociado",
                "total do produto",
                "subtotal do produto",
                "preco de venda",
                "preco unitario"
            ]);

            const currentTally = {};
            let processedOrders = 0;

            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                // Status check: ignora cancelados e reembolsados
                if (idxStatus !== -1) {
                    const statusStr = normalizeHeader(row[idxStatus]);
                    if (statusStr.includes("cancel") || statusStr.includes("reembols") || statusStr.includes("devolv")) {
                        continue;
                    }
                }

                const productName = idxProductName !== -1 ? String(row[idxProductName] || "Produto Shopee").trim() : "Produto Shopee";
                const varName = idxVariationName !== -1 ? String(row[idxVariationName] || "").trim() : "";
                const varSku = idxVarSku !== -1 ? String(row[idxVarSku] || "").trim() : "";
                const prodSku = idxProdSku !== -1 ? String(row[idxProdSku] || "").trim() : "";
                const sku = varSku || prodSku || "";

                const qty = idxQty !== -1 ? parseInt(row[idxQty], 10) || 1 : 1;
                let price = 0;
                if (idxPrice !== -1) {
                    const rawVal = row[idxPrice];
                    if (typeof rawVal === "number") price = rawVal;
                    else if (typeof rawVal === "string") {
                        price = parseFloat(rawVal.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
                    }
                }

                // Chave única para agregação
                const tallyKey = sku ? `sku_${sku.toLowerCase()}` : `item_${productName}_${varName}`.toLowerCase();

                if (!currentTally[tallyKey]) {
                    currentTally[tallyKey] = {
                        total: 0,
                        revenue: 0,
                        title: productName + (varName ? ` (${varName})` : ""),
                        productName,
                        varName,
                        shopeeSku: sku,
                        tallyKey
                    };
                }

                currentTally[tallyKey].total += qty;
                currentTally[tallyKey].revenue += (qty * price);
                processedOrders++;
            }

            if (Object.keys(currentTally).length === 0) {
                alert("Nenhum pedido válido/concluído foi encontrado no arquivo.");
                setLoading(false);
                return;
            }

            // Atualiza dados mais recentes de configurações
            await loadSettings();
            setTally(currentTally);
            setStep(2);
        } catch (err) {
            console.error("Erro ao processar planilha da Shopee:", err);
            alert("Erro ao ler planilha: " + err.message);
            setStep(0);
        } finally {
            setLoading(false);
        }
    };

    // Auto-match por SKU com as FTs ou suas variações
    const getMappedFtId = (tallyItem) => {
        const itemSku = tallyItem.shopeeSku;
        if (!itemSku) return null;

        const cleanSku = String(itemSku).trim().toLowerCase();

        // 1. Procura em ft_overrides_shopee
        const matchedCode = Object.keys(shopeeOverrides || {}).find(ftCode => {
            const ovr = shopeeOverrides[ftCode] || {};
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
                const skuShopee = v.skus?.shopee || v.sku;
                return skuShopee && String(skuShopee).trim().toLowerCase() === cleanSku;
            });
        });
        if (matchedVarCode) {
            const matchedFt = fts.find(f => f.ftCode.toLowerCase() === matchedVarCode.toLowerCase());
            if (matchedFt) return matchedFt.id;
        }

        // 3. Procura nas FTs diretamente (ft.sku, ft.ftCode ou ft.variations)
        const matchedDirect = fts.find(f => {
            const ftSku = f.sku || f.skus?.shopee;
            if (ftSku && String(ftSku).trim().toLowerCase() === cleanSku) return true;
            if (f.ftCode && f.ftCode.toLowerCase() === cleanSku) return true;

            const vars = f.variations || ftVariations[f.ftCode] || [];
            if (vars.some(v => {
                const vSku = v.skus?.shopee || v.sku;
                return vSku && String(vSku).trim().toLowerCase() === cleanSku;
            })) return true;

            return false;
        });

        if (matchedDirect) return matchedDirect.id;

        return null;
    };

    // Salva o vínculo manual e persiste o SKU na FT ou na variação
    const handleLinkFt = async (tallyKey, ftId, targetVarId = null) => {
        try {
            const item = tally[tallyKey];
            const targetFt = fts.find(f => f.id === ftId);
            const skuToSave = item.shopeeSku || "";

            if (targetFt && skuToSave) {
                if (targetVarId) {
                    // Salva na variação específica
                    const currentVars = await api.getSettings('ft_variations') || {};
                    const ftVarsList = currentVars[targetFt.ftCode] || targetFt.variations || [];
                    const updatedList = ftVarsList.map(v => {
                        if (v.id === targetVarId) {
                            return {
                                ...v,
                                skus: { ...(v.skus || {}), shopee: skuToSave },
                                sku: skuToSave
                            };
                        }
                        return v;
                    });
                    currentVars[targetFt.ftCode] = updatedList;
                    await api.saveSettings('ft_variations', currentVars);
                    setFtVariations(currentVars);
                } else {
                    // Salva no override principal da Shopee
                    const currentOvr = await api.getSettings('ft_overrides_shopee') || {};
                    currentOvr[targetFt.ftCode] = {
                        ...(currentOvr[targetFt.ftCode] || {}),
                        sku: skuToSave,
                        updatedAt: new Date().toISOString()
                    };
                    await api.saveSettings('ft_overrides_shopee', currentOvr);
                    setShopeeOverrides(currentOvr);
                }
            }

            // Atualiza mapeamento temporário para refletir na interface instantaneamente
            setTally(prev => ({
                ...prev,
                [tallyKey]: {
                    ...prev[tallyKey],
                    manualFtId: ftId
                }
            }));
        } catch (err) {
            console.error("Erro ao vincular FT na Shopee:", err);
            alert("Erro ao vincular produto.");
        }
    };

    const handleApply = () => {
        const ftData = {};

        Object.values(tally).forEach(item => {
            const ftId = item.manualFtId || getMappedFtId(item);
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

    const unmappedItems = Object.values(tally).filter(item => !item.manualFtId && !getMappedFtId(item));
    const totalUnits = Object.values(tally).reduce((acc, curr) => acc + curr.total, 0);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-5 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-sm font-bold text-orange-950 flex items-center gap-2">
                        <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                            <Zap className="w-4 h-4" />
                        </span>
                        Sincronização de Vendas Shopee
                        {isApiConnected && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                API 1-Clique Ativa
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-orange-700/80 mt-1">
                        {isApiConnected
                            ? 'Sua loja Shopee está conectada via API! Clique no botão abaixo para buscar as vendas do mês instantaneamente.'
                            : 'Busque as vendas do mês com 1 clique (quando a API estiver conectada) ou importe a planilha de pedidos da Shopee.'}
                    </p>
                </div>

                {step === 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {isApiConnected ? (
                            <button
                                onClick={fetchApiMonthlyOrders}
                                disabled={loading}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                <span>Sincronizar Vendas do Mês (1-Clique API)</span>
                            </button>
                        ) : (
                            <label className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm">
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                <span>Importar Planilha Shopee (.xlsx)</span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    disabled={loading}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg text-xs font-bold border border-emerald-200">
                        <CheckCircle className="w-4 h-4" />
                        Vendas da Shopee aplicadas com sucesso!
                    </div>
                )}
            </div>

            {step === 2 && (
                <div className="border-t border-orange-100 pt-4 mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3 bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">
                        <span>Origem: <strong className="text-gray-800">{fileName}</strong></span>
                        <span>Total de itens vendidos no período: <strong className="text-orange-600 font-bold">{totalUnits} un</strong></span>
                    </div>

                    {unmappedItems.length > 0 ? (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                {unmappedItems.length} produto(s) ou variações não foram identificados automaticamente
                            </h4>
                            <p className="text-[11px] text-amber-700 mb-2">
                                Selecione a FT correspondente abaixo. O SKU da Shopee será gravado automaticamente na FT para que as próximas importações sejam 100% automáticas!
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {unmappedItems.map(item => (
                                    <div key={item.tallyKey} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 gap-2 shadow-2xs">
                                        <div className="text-xs">
                                            <div className="font-semibold text-gray-800 line-clamp-1 flex items-center gap-2" title={item.title}>
                                                <span>{item.title}</span>
                                                {item.shopeeSku && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        SKU: {item.shopeeSku}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-gray-500 text-[10px] mt-0.5">
                                                Qtd Vendida: <span className="font-bold text-orange-600">{item.total} un</span> • Total: R$ {item.revenue.toFixed(2)}
                                            </div>
                                        </div>

                                        <select
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const [ftId, varId] = e.target.value.split('::');
                                                    handleLinkFt(item.tallyKey, ftId, varId || null);
                                                }
                                            }}
                                            className="text-xs border border-orange-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-500 bg-white font-medium max-w-[280px] shadow-2xs"
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
                                                                    ↳ {ft.ftCode} / {v.name || 'Variação'} {v.skus?.shopee ? '(SKU: ' + v.skus.shopee + ')' : ''}
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
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            Todos os itens vendidos foram identificados e vinculados com sucesso!
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setStep(0)}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                        >
                            <ArrowRight className="w-4 h-4" />
                            Aplicar Vendas ({totalUnits} itens)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportacaoVendasShopee;
