import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Download, Image as ImageIcon, FileText, Tag, Package } from 'lucide-react';
import { mlAuth, mlApi, mlListings } from '../../services/mlApi';
import { api } from '../../services/api';

const ALL_MKT_PLATFORMS = ['meli', 'tiktok', 'amazon', 'shopee', 'site'];

const MlCatalogImportModal = ({ isOpen, onClose, baseFts = [], currentMarketplace = 'meli', onImported }) => {
    const [loading, setLoading] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [error, setError] = useState('');
    const [catalogRows, setCatalogRows] = useState([]);
    const [selectedMlIds, setSelectedMlIds] = useState({});
    const [manualFtLinks, setManualFtLinks] = useState({});
    const [applying, setApplying] = useState(false);

    // Opções do que importar
    const [opts, setOpts] = useState({
        mediaAndDesc: true,
        brandEanCat: true,
        fiscal: true,
        stock: true,
        prices: false,
        replicateOthers: true,
    });

    useEffect(() => {
        if (isOpen) {
            fetchMlCatalog();
        }
    }, [isOpen]);

    const findMatchingFt = (catalogItem, localListings, meliOverrides, ftVars) => {
        // 1. Link salvo em marketplace_listings
        const savedListing = localListings.find(l => l.ml_item_id === catalogItem.mlItemId);
        if (savedListing?.ft_id) {
            const byId = baseFts.find(f => f.id === savedListing.ft_id || f.ftCode === savedListing.ft_id);
            if (byId) return { ft: byId, matchReason: 'Vínculo salvo' };
        }

        // 2. Match por SKU no item pai
        const itemSku = (catalogItem.sku || '').trim().toLowerCase();
        if (itemSku) {
            for (const ft of baseFts) {
                const meliSku = (meliOverrides[ft.ftCode]?.sku || '').trim().toLowerCase();
                if (meliSku && meliSku === itemSku) {
                    return { ft, matchReason: `SKU (${catalogItem.sku})` };
                }
                if (ft.ftCode.toLowerCase() === itemSku) {
                    return { ft, matchReason: `Código (${ft.ftCode})` };
                }
            }
        }

        // 3. Match por SKU em variações
        if (catalogItem.variations?.length > 0) {
            const varSkus = catalogItem.variations.map(v => (v.sku || '').trim().toLowerCase()).filter(Boolean);
            if (varSkus.length > 0) {
                for (const ft of baseFts) {
                    const vars = ftVars[ft.ftCode] || meliOverrides[ft.ftCode]?.variations || [];
                    const hasMatch = vars.some(v => {
                        const s = (v.skus?.meli || v.sku || '').trim().toLowerCase();
                        return s && varSkus.includes(s);
                    });
                    if (hasMatch) {
                        return { ft, matchReason: 'SKU de variação' };
                    }
                }
            }
        }

        return { ft: null, matchReason: null };
    };

    const fetchMlCatalog = async () => {
        setLoading(true);
        setError('');
        setCatalogRows([]);
        try {
            const isConn = await mlAuth.isConnected();
            if (!isConn) {
                setError('Mercado Livre não está conectado. Conecte primeiro em E-commerce > Marketplaces > Mercado Livre > Integração API.');
                setLoading(false);
                return;
            }

            setProgressText('Carregando anúncios e vínculos salvos...');
            const [localListings, meliOverrides, ftVars] = await Promise.all([
                mlListings.getListings(),
                api.getSettings('ft_overrides_meli').then(r => r || {}),
                api.getSettings('ft_variations').then(r => r || {}),
            ]);

            // Buscar todos os IDs ativos diretamente da API do ML
            setProgressText('Buscando anúncios ativos na API do Mercado Livre...');
            let allIds = [];
            let offset = 0;
            while (true) {
                const res = await mlApi.getMyItems(offset, 50);
                const ids = res.results || [];
                allIds = [...allIds, ...ids];
                if (ids.length < 50) break;
                offset += 50;
            }

            // Incluir também IDs que já existam em localListings caso algum esteja pausado
            localListings.forEach(l => {
                if (l.ml_item_id && !allIds.includes(l.ml_item_id)) {
                    allIds.push(l.ml_item_id);
                }
            });

            if (allIds.length === 0) {
                setError('Nenhum anúncio encontrado na conta do Mercado Livre.');
                setLoading(false);
                return;
            }

            // Buscar detalhes completos em lotes de 20
            const allDetails = [];
            for (let i = 0; i < allIds.length; i += 20) {
                setProgressText(`Baixando fotos, atributos e variações (${Math.min(i + 20, allIds.length)}/${allIds.length})...`);
                const batch = allIds.slice(i, i + 20);
                const details = await mlApi.getItemsFullDetails(batch);
                allDetails.push(...details);
            }

            // Buscar descrições e categorias em lotes pequenos de 5 para evitar rate-limit
            const rows = [];
            const initialSelected = {};
            const initialManualLinks = {};

            for (let i = 0; i < allDetails.length; i += 5) {
                setProgressText(`Baixando descrições e categorias (${Math.min(i + 5, allDetails.length)}/${allDetails.length})...`);
                const slice = allDetails.slice(i, i + 5);
                const sliceResults = await Promise.all(slice.map(async (item) => {
                    const [descData, catPath] = await Promise.all([
                        mlApi.getItemDescription(item.id),
                        mlApi.getCategoryPath(item.category_id),
                    ]);
                    const extracted = mlApi.extractCatalogData(item, descData, catPath);
                    const { ft, matchReason } = findMatchingFt(extracted, localListings, meliOverrides, ftVars);
                    return { ...extracted, matchedFt: ft, matchReason };
                }));

                sliceResults.forEach(r => {
                    rows.push(r);
                    if (r.matchedFt) {
                        initialSelected[r.mlItemId] = true;
                        initialManualLinks[r.mlItemId] = r.matchedFt.ftCode;
                    }
                });
            }

            // Buscar dados fiscais (NCM, CEST, Origem, CSOSN, EAN fallback) via NF-e / faturamento ML
            const fiscalMap = await mlApi.getBulkFiscalMap(rows, setProgressText);
            rows.forEach((r) => {
                const fis = fiscalMap[r.mlItemId];
                if (fis) {
                    r.ncm = fis.ncm || r.ncm || '';
                    r.cest = fis.cest || '';
                    r.origin = fis.origin !== undefined && fis.origin !== '' ? fis.origin : '0';
                    r.csosn = fis.csosn || '';
                    if (!r.ean && fis.ean) r.ean = fis.ean;
                }
            });

            // Ordena: vinculados primeiro, depois por código FT / título
            rows.sort((a, b) => {
                if (a.matchedFt && !b.matchedFt) return -1;
                if (!a.matchedFt && b.matchedFt) return 1;
                return (a.matchedFt?.ftCode || a.marketplaceTitle).localeCompare(b.matchedFt?.ftCode || b.marketplaceTitle);
            });

            setCatalogRows(rows);
            setSelectedMlIds(initialSelected);
            setManualFtLinks(initialManualLinks);
        } catch (err) {
            console.error('Erro ao importar catálogo ML:', err);
            setError(err.message || 'Falha ao consultar API do Mercado Livre.');
        } finally {
            setLoading(false);
            setProgressText('');
        }
    };

    const handleApplyImport = async () => {
        const toApply = catalogRows.filter(r => selectedMlIds[r.mlItemId] && manualFtLinks[r.mlItemId]);
        if (toApply.length === 0) {
            alert('Selecione ao menos um anúncio vinculado a uma FT para importar.');
            return;
        }

        setApplying(true);
        try {
            const targetChannels = opts.replicateOthers
                ? ALL_MKT_PLATFORMS
                : [currentMarketplace === 'geral' ? 'meli' : currentMarketplace];

            // Carrega overrides de todos os canais alvo + ft_variations
            const [ftVarsSetting, localListings, ...channelOverridesList] = await Promise.all([
                api.getSettings('ft_variations').then(r => r || {}),
                mlListings.getListings(),
                ...targetChannels.map(ch => api.getSettings(`ft_overrides_${ch}`).then(r => r || {}))
            ]);

            const overridesByChannel = {};
            targetChannels.forEach((ch, idx) => {
                overridesByChannel[ch] = { ...channelOverridesList[idx] };
            });

            const nextFtVars = { ...ftVarsSetting };
            const touchedFtCodes = new Set();
            const nowIso = new Date().toISOString();

            for (const item of toApply) {
                const ftCode = manualFtLinks[item.mlItemId];
                const baseFt = baseFts.find(f => f.ftCode === ftCode);
                if (!baseFt) continue;
                touchedFtCodes.add(ftCode);

                // Se usuário vinculou manualmente na hora e não estava salvo em marketplace_listings, salva o vínculo
                const savedListing = localListings.find(l => l.ml_item_id === item.mlItemId);
                if (savedListing && !savedListing.ft_id) {
                    await mlListings.linkFt(savedListing.id, baseFt.id);
                }

                // Cria variações ausentes e atualiza existentes (preservando SKUs já cadastrados)
                const existingVars = Array.isArray(nextFtVars[ftCode]) ? [...nextFtVars[ftCode]] : [];
                if (item.variations?.length > 0) {
                    nextFtVars[ftCode] = mlApi.mergeVariationsFromMl(
                        existingVars,
                        item.variations,
                        currentMarketplace === 'geral' ? 'meli' : currentMarketplace,
                        { overwritePrices: opts.prices, overwriteStock: opts.stock }
                    );
                }

                for (const ch of targetChannels) {
                    const isMeli = ch === 'meli';
                    const existingOvr = overridesByChannel[ch][ftCode] || {
                        name: baseFt.name,
                        variation: baseFt.variation || '',
                        productionTime: baseFt.productionTime || '',
                        salePrice: baseFt.salePrice || 0,
                        materials: baseFt.materials || [],
                        directCostsRS: baseFt.directCostsRS || [],
                        directCostsPercent: baseFt.directCostsPercent || [],
                    };

                    const patch = {
                        ...existingOvr,
                        updatedAt: nowIso,
                    };

                    // Campos compartilháveis (se for meli, ou se replicateOthers estiver ativo)
                    if (isMeli || opts.replicateOthers) {
                        if (opts.mediaAndDesc) {
                            patch.marketplaceTitle = item.marketplaceTitle || existingOvr.marketplaceTitle || baseFt.name;
                            if (item.description) patch.description = item.description;
                            if (item.photos?.length > 0) patch.photos = item.photos;
                            if (item.videoUrl) patch.videoUrl = item.videoUrl;
                        }
                        if (opts.brandEanCat) {
                            if (item.brand) patch.brand = item.brand;
                            if (item.ean) patch.ean = item.ean;
                            if (item.category) patch.category = item.category;
                        }
                        if (opts.fiscal) {
                            if (item.ncm) patch.ncm = item.ncm;
                            if (item.cest) patch.cest = item.cest;
                            if (item.origin !== undefined && item.origin !== '') patch.origin = item.origin;
                            if (item.csosn) patch.csosn = item.csosn;
                        }
                        if (!existingOvr.originCep) patch.originCep = '13347-458';
                        if (!existingOvr.origin && patch.origin === undefined) patch.origin = '0';
                        if (!existingOvr.csosn && !patch.csosn) patch.csosn = '102';
                    }

                    // Campos específicos do Mercado Livre (SKU, Estoque e Preço opcional)
                    if (isMeli) {
                        if (item.sku && !existingOvr.sku) patch.sku = item.sku;
                        if (opts.stock) patch.stock = item.stock;
                        if (opts.prices && item.salePrice > 0) {
                            patch.salePrice = item.salePrice;
                            patch.promoPrice = item.promoPrice;
                        }
                    }

                    if (nextFtVars[ftCode]) {
                        patch.variations = nextFtVars[ftCode];
                    }

                    overridesByChannel[ch][ftCode] = patch;
                }
            }

            // Salva tudo no Supabase
            await Promise.all([
                api.saveSettings('ft_variations', nextFtVars),
                ...targetChannels.map(ch => api.saveSettings(`ft_overrides_${ch}`, overridesByChannel[ch])),
                ...Array.from(touchedFtCodes).map(ftCode => api.touchFtUpdatedAt(ftCode))
            ]);

            alert(`✅ Dados importados com sucesso para ${touchedFtCodes.size} Ficha(s) Técnica(s)!`);
            if (onImported) await onImported();
            onClose();
        } catch (err) {
            console.error('Erro ao aplicar importação ML:', err);
            alert('Erro ao salvar dados importados: ' + err.message);
        } finally {
            setApplying(false);
        }
    };

    if (!isOpen) return null;

    const matchedCount = catalogRows.filter(r => manualFtLinks[r.mlItemId]).length;
    const selectedCount = catalogRows.filter(r => selectedMlIds[r.mlItemId] && manualFtLinks[r.mlItemId]).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-yellow-50/70">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Download size={18} className="text-yellow-600" />
                            <span>Importar Dados dos Produtos do Mercado Livre</span>
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Puxa automaticamente fotos, descrição, título, marca, EAN/GTIN, categoria e estoque dos anúncios vinculados às suas FTs.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-gray-600 gap-3">
                            <RefreshCw size={32} className="animate-spin text-yellow-500" />
                            <p className="text-sm font-semibold">{progressText || 'Consultando Mercado Livre...'}</p>
                            <p className="text-xs text-gray-400">Isso pode levar alguns segundos dependendo da quantidade de anúncios.</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 text-red-700">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold">Não foi possível consultar o Mercado Livre</p>
                                <p className="mt-1">{error}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Opções de Importação */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                                <p className="text-xs font-bold text-gray-700 uppercase">O que importar para as FTs selecionadas:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={opts.mediaAndDesc} onChange={e => setOpts({ ...opts, mediaAndDesc: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Título comercial, Descrição, Fotos (em ordem) e Vídeo</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={opts.brandEanCat} onChange={e => setOpts({ ...opts, brandEanCat: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Marca, EAN/GTIN e Categoria</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={opts.fiscal} onChange={e => setOpts({ ...opts, fiscal: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Dados Fiscais (NCM, CEST, Origem e CSOSN das NF-es)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={opts.stock} onChange={e => setOpts({ ...opts, stock: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Estoque e Variações do Mercado Livre</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={opts.prices} onChange={e => setOpts({ ...opts, prices: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Sobrescrever Preço de Venda / Promoção no ML com preço do anúncio</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer sm:col-span-2 font-semibold text-indigo-800 pt-1 border-t border-gray-200">
                                        <input type="checkbox" checked={opts.replicateOthers} onChange={e => setOpts({ ...opts, replicateOthers: e.target.checked })} className="rounded text-indigo-600" />
                                        <span>Replicar Descrição, Marca, EAN, Categoria, Fotos, Vídeo e Dados Fiscais também para Shopee, TikTok, Amazon e Site (preservando os preços/SKUs de cada canal)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Resumo & Ações em massa */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                                <span>
                                    Encontrados <strong>{catalogRows.length}</strong> anúncios no ML • <strong>{matchedCount}</strong> vinculados a FTs • <strong>{selectedCount}</strong> marcados para importar
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = {};
                                            catalogRows.forEach(r => { if (manualFtLinks[r.mlItemId]) next[r.mlItemId] = true; });
                                            setSelectedMlIds(next);
                                        }}
                                        className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                                    >
                                        Marcar todos vinculados
                                    </button>
                                    <span>•</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMlIds({})}
                                        className="text-gray-500 hover:underline cursor-pointer"
                                    >
                                        Desmarcar todos
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Anúncios */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                                        <tr>
                                            <th className="px-3 py-2.5 text-center w-10">Imp.</th>
                                            <th className="px-3 py-2.5 text-left">Anúncio no Mercado Livre</th>
                                            <th className="px-3 py-2.5 text-left">FT Vinculada</th>
                                            <th className="px-3 py-2.5 text-center">Dados Extraídos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {catalogRows.map(row => {
                                            const linkedFtCode = manualFtLinks[row.mlItemId] || '';
                                            const isChecked = !!selectedMlIds[row.mlItemId] && !!linkedFtCode;
                                            return (
                                                <tr key={row.mlItemId} className={linkedFtCode ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 text-gray-400'}>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            disabled={!linkedFtCode}
                                                            onChange={(e) => setSelectedMlIds(prev => ({ ...prev, [row.mlItemId]: e.target.checked }))}
                                                            className="rounded text-indigo-600 cursor-pointer disabled:opacity-30"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            {row.photos?.[0] && (
                                                                <img src={row.photos[0]} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-800 line-clamp-1 max-w-[260px]" title={row.marketplaceTitle}>
                                                                    {row.marketplaceTitle}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 font-mono">
                                                                    {row.mlItemId} {row.sku ? `• SKU: ${row.sku}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <select
                                                            value={linkedFtCode}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setManualFtLinks(prev => ({ ...prev, [row.mlItemId]: val }));
                                                                if (val) setSelectedMlIds(prev => ({ ...prev, [row.mlItemId]: true }));
                                                            }}
                                                            className={`text-xs border rounded-lg px-2 py-1 max-w-[220px] ${linkedFtCode ? 'border-indigo-200 bg-indigo-50/40 text-indigo-900 font-semibold' : 'border-gray-200 bg-white text-gray-500'}`}
                                                        >
                                                            <option value="">-- Não vinculado --</option>
                                                            {baseFts.map(ft => (
                                                                <option key={ft.ftCode} value={ft.ftCode}>
                                                                    {ft.ftCode} - {ft.name?.slice(0, 28)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {row.matchReason && (
                                                            <span className="block text-[9px] text-emerald-600 mt-0.5">✓ {row.matchReason}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                                                                <ImageIcon size={10} /> {row.photos?.length || 0}
                                                            </span>
                                                            {row.description && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                                                                    <FileText size={10} /> Desc
                                                                </span>
                                                            )}
                                                            {row.ean && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-mono">
                                                                    EAN: {row.ean}
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-medium">
                                                                <Package size={10} /> {row.stock}un
                                                            </span>
                                                            {row.variations?.length > 0 && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                                                                    <Tag size={10} /> {row.variations.length} var
                                                                </span>
                                                            )}
                                                            {row.ncm && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                                                                    NCM: {row.ncm}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Variações são criadas automaticamente e NCM/CEST/Origem/CSOSN vêm do faturamento ML.
                    </span>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleApplyImport}
                            disabled={loading || applying || selectedCount === 0}
                            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {applying ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            <span>{applying ? 'Salvando...' : `Importar (${selectedCount}) para FTs`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MlCatalogImportModal;
