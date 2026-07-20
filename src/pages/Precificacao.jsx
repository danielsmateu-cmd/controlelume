import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { Tag, Search, Loader2, Zap, Target, AlertCircle, Package, Weight } from 'lucide-react';
import clsx from 'clsx';

// ─── Plataformas ───────────────────────────────────────────────────────────────

const PLATFORMS = [
    { id: 'meli',   label: 'Mercado Livre', emoji: '🛒', color: 'bg-yellow-400 hover:bg-yellow-500', ring: 'ring-yellow-300', textColor: 'text-yellow-900', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', borderAccent: 'border-l-yellow-400' },
    { id: 'shopee', label: 'Shopee',        emoji: '🧡', color: 'bg-orange-500 hover:bg-orange-600', ring: 'ring-orange-300', textColor: 'text-white',       badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', borderAccent: 'border-l-orange-400' },
    { id: 'tiktok', label: 'TikTok',        emoji: '🎵', color: 'bg-gray-900 hover:bg-black',        ring: 'ring-gray-500',   textColor: 'text-white',       badgeBg: 'bg-gray-100',   badgeText: 'text-gray-700',   borderAccent: 'border-l-gray-600'   },
    { id: 'amazon', label: 'Amazon',        emoji: '📦', color: 'bg-amber-500 hover:bg-amber-600',   ring: 'ring-amber-300',  textColor: 'text-white',       badgeBg: 'bg-amber-100',  badgeText: 'text-amber-700',  borderAccent: 'border-l-amber-400'  },
    { id: 'site',   label: 'Site',          emoji: '🌐', color: 'bg-indigo-600 hover:bg-indigo-700', ring: 'ring-indigo-300', textColor: 'text-white',       badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700', borderAccent: 'border-l-indigo-500' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseNum = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).replace(/[R$\s]/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
};

const calcFtCosts = (ft) => {
    const fixedCosts  = (ft.materials || []).reduce((a, c) => a + parseNum(c.value), 0)
                      + (ft.directCostsRS || []).reduce((a, c) => a + parseNum(c.value), 0);
    const percentRate = (ft.directCostsPercent || []).reduce((a, c) => a + parseNum(c.percentage), 0) / 100;
    return { fixedCosts, percentRate };
};

/** Margem de contribuição % para um dado preço */
const calcMarginPct = (price, fixedCosts, percentRate) => {
    if (!price || price <= 0) return null;
    const totalCost = fixedCosts + percentRate * price;
    return ((price - totalCost) / price) * 100;
};

/** Valor de Queima: preço onde margem = 0% */
const calcQueima = (fixedCosts, percentRate) => {
    if (percentRate >= 1) return null;
    const v = fixedCosts / (1 - percentRate);
    return v > 0 ? v : null;
};

const fmtBRL = (v) =>
    v != null
        ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—';

const fmtPct = (v, dec = 1) =>
    v != null ? `${v.toFixed(dec)}%` : '—';

const marginColor = (pct) => {
    if (pct == null) return 'text-gray-400';
    if (pct >= 30)  return 'text-emerald-600';
    if (pct >= 15)  return 'text-yellow-600';
    if (pct >= 0)   return 'text-orange-500';
    return 'text-red-500';
};

// ─── Linha da tabela ──────────────────────────────────────────────────────────

const FtRow = React.memo(({ ft, platform, savedData, onDataChange }) => {
    // Estado local do campo de rankeamento (input livre em R$)
    const [rankInput, setRankInput] = useState('');

    const { fixedCosts, percentRate } = useMemo(() => calcFtCosts(ft), [ft]);
    const salePrice   = parseNum(ft.salePrice);
    const currentPct  = useMemo(() => calcMarginPct(salePrice, fixedCosts, percentRate), [salePrice, fixedCosts, percentRate]);
    const queimaPrice = useMemo(() => calcQueima(fixedCosts, percentRate),               [fixedCosts, percentRate]);

    // Calcula margem do valor de rankeamento em tempo real
    const rankPrice = useMemo(() => {
        const n = parseFloat(rankInput.replace(/[R$\s.]/g, '').replace(',', '.'));
        return !isNaN(n) && n > 0 ? n : null;
    }, [rankInput]);

    const rankPct = useMemo(
        () => rankPrice ? calcMarginPct(rankPrice, fixedCosts, percentRate) : null,
        [rankPrice, fixedCosts, percentRate]
    );

    // Campos salvos (medidas / peso)
    const d = savedData || {};
    const field = (name) => ({
        value: d[name] ?? '',
        onChange: (e) => onDataChange(ft.id, name, e.target.value),
    });

    const inputCls = 'w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all bg-white hover:border-gray-300';

    return (
        <tr className={clsx(
            'border-b border-gray-100 hover:bg-gray-50/60 transition-colors',
            `border-l-4 ${platform.borderAccent}`
        )}>
            {/* Nº FT */}
            <td className="px-4 py-3 w-24">
                <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide', platform.badgeBg, platform.badgeText)}>
                    {ft.ftCode}
                </span>
            </td>

            {/* Produto */}
            <td className="px-4 py-3">
                <div className="font-semibold text-sm text-gray-800 leading-tight">{ft.name}</div>
                {ft.variation && <div className="text-xs text-gray-400 mt-0.5">{ft.variation}</div>}
                {ft.isOverride && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">
                        Preço customizado
                    </span>
                )}
            </td>

            {/* Valor de Venda + Margem % abaixo */}
            <td className="px-4 py-3 text-right w-36">
                <div className="font-bold text-gray-800 text-sm">{fmtBRL(salePrice)}</div>
                {currentPct != null && (
                    <div className={clsx('text-xs font-bold mt-0.5', marginColor(currentPct))}>
                        {fmtPct(currentPct)}
                    </div>
                )}
            </td>

            {/* Valor de Rankeamento — input R$ + % abaixo */}
            <td className="px-4 py-3 w-40">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-semibold">R$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={rankInput}
                        onChange={e => setRankInput(e.target.value)}
                        className={clsx(
                            'flex-1 border rounded-lg px-2 py-1.5 text-sm text-right font-semibold outline-none transition-all',
                            rankPct != null
                                ? 'border-indigo-200 bg-indigo-50/50 focus:ring-2 focus:ring-indigo-300'
                                : 'border-gray-200 bg-white focus:ring-2 focus:ring-gray-200'
                        )}
                    />
                </div>
                {rankPct != null && (
                    <div className={clsx('mt-1 text-xs font-black text-right', marginColor(rankPct))}>
                        {fmtPct(rankPct)}
                    </div>
                )}
            </td>

            {/* Valor de Queima */}
            <td className="px-4 py-3 text-right w-36">
                {queimaPrice != null ? (
                    <>
                        <div className="font-bold text-red-500 text-sm">{fmtBRL(queimaPrice)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Margem 0%</div>
                    </>
                ) : (
                    <span className="text-gray-300 text-sm">—</span>
                )}
            </td>

            {/* Medidas com caixa */}
            <td className="px-3 py-3 text-center">
                <input {...field('medidasComCaixa')} placeholder="ex: 30x20x15" className={inputCls} />
            </td>

            {/* Medidas sem caixa */}
            <td className="px-3 py-3 text-center">
                <input {...field('medidasSemCaixa')} placeholder="ex: 28x18x12" className={inputCls} />
            </td>

            {/* Peso com caixa */}
            <td className="px-3 py-3 text-center">
                <input {...field('pesoComCaixa')} placeholder="ex: 0,85 kg" className={inputCls} />
            </td>

            {/* Peso sem caixa */}
            <td className="px-3 py-3 text-center">
                <input {...field('pesoSemCaixa')} placeholder="ex: 0,60 kg" className={inputCls} />
            </td>
        </tr>
    );
});

FtRow.displayName = 'FtRow';

// ─── Página principal ─────────────────────────────────────────────────────────

const SETTINGS_KEY = 'precificacao_product_data';

const Precificacao = ({ readOnly }) => {
    const [activePlatform, setActivePlatform] = useState('meli');
    const [ftsData, setFtsData]     = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState(null);
    const [search, setSearch]       = useState('');

    // productData: { [ftId]: { medidasComCaixa, medidasSemCaixa, pesoComCaixa, pesoSemCaixa } }
    const [productData, setProductData] = useState({});
    const saveTimerRef = useRef(null);

    // Carrega FTs + overrides ao trocar marketplace
    const loadFts = useCallback(async (platformId) => {
        setIsLoading(true);
        setError(null);
        try {
            const [fts, overrides] = await Promise.all([
                api.getFts(),
                api.getSettings(`ft_overrides_${platformId}`).catch(() => ({})),
            ]);

            const overridesData = overrides || {};
            const enriched = fts
                .map(ft => ({
                    ...ft,
                    ...(overridesData[ft.ftCode] ? { ...overridesData[ft.ftCode], isOverride: true } : { isOverride: false }),
                }))
                // Oculta FTs suspensas (marcadas como "Não à Venda") neste marketplace
                .filter(ft => !ft.notForSale)
                .sort((a, b) => a.ftCode.localeCompare(b.ftCode, 'pt-BR', { numeric: true }));

            setFtsData(enriched);
        } catch (err) {
            console.error('Erro ao carregar FTs:', err);
            setError('Não foi possível carregar os produtos. Verifique a conexão.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Carrega medidas/pesos salvos (uma única vez, independente do marketplace)
    useEffect(() => {
        api.getSettings(SETTINGS_KEY)
            .then(data => { if (data) setProductData(data); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        loadFts(activePlatform);
    }, [activePlatform, loadFts]);

    // Callback dos campos salvos — debounce de 700ms para não sobrecarregar Supabase
    const handleDataChange = useCallback((ftId, field, value) => {
        setProductData(prev => {
            const updated = {
                ...prev,
                [ftId]: { ...(prev[ftId] || {}), [field]: value },
            };
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                api.saveSettings(SETTINGS_KEY, updated).catch(console.error);
            }, 700);
            return updated;
        });
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return ftsData;
        return ftsData.filter(ft =>
            ft.ftCode?.toLowerCase().includes(q) ||
            ft.name?.toLowerCase().includes(q) ||
            ft.variation?.toLowerCase().includes(q)
        );
    }, [ftsData, search]);

    const platform = PLATFORMS.find(pl => pl.id === activePlatform);

    return (
        <div className="space-y-5">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Tag className="w-6 h-6 text-indigo-600" />
                    Precificação
                </h1>
                <p className="text-gray-400 text-sm mt-0.5">
                    Margens, rankeamento, preço de queima e dados logísticos por marketplace
                </p>
            </div>

            {/* Seletor de Marketplace */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Marketplace</p>
                <div className="flex flex-wrap gap-2.5">
                    {PLATFORMS.map(pl => (
                        <button
                            key={pl.id}
                            onClick={() => { setActivePlatform(pl.id); setSearch(''); }}
                            className={clsx(
                                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                                pl.color, pl.textColor,
                                activePlatform === pl.id
                                    ? `ring-2 ${pl.ring} ring-offset-2 shadow-lg scale-105`
                                    : 'opacity-55 hover:opacity-100'
                            )}
                        >
                            <span className="text-base">{pl.emoji}</span>
                            {pl.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Cabeçalho da tabela */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">{platform?.emoji}</span>
                        <div>
                            <h2 className="font-bold text-gray-800 text-base leading-none">{platform?.label}</h2>
                            {!isLoading && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar FT, produto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none w-56 transition-all bg-gray-50 focus:bg-white"
                        />
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <span className="text-sm text-gray-400 font-medium">Carregando produtos...</span>
                    </div>
                )}

                {/* Erro */}
                {error && !isLoading && (
                    <div className="flex items-center gap-3 m-5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Tabela de produtos */}
                {!isLoading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Nº FT
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Produto
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Valor de Venda
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-1">
                                            <Target className="w-3 h-3 text-indigo-400" />
                                            Val. Rankeamento
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="flex items-center justify-end gap-1">
                                            <Zap className="w-3 h-3 text-red-400" />
                                            Val. Queima
                                        </span>
                                    </th>

                                    {/* Grupo: Medidas */}
                                    <th
                                        colSpan={2}
                                        className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border-l border-gray-200"
                                    >
                                        <span className="flex items-center justify-center gap-1">
                                            <Package className="w-3 h-3 text-blue-400" />
                                            Medidas (cm)
                                        </span>
                                    </th>

                                    {/* Grupo: Peso */}
                                    <th
                                        colSpan={2}
                                        className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border-l border-gray-200"
                                    >
                                        <span className="flex items-center justify-center gap-1">
                                            <Weight className="w-3 h-3 text-purple-400" />
                                            Peso (kg)
                                        </span>
                                    </th>
                                </tr>

                                {/* Sub-headers para Medidas e Peso */}
                                <tr className="bg-gray-50/40 border-b border-gray-100">
                                    <th colSpan={5} className="py-1" />
                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-blue-400 uppercase tracking-widest border-l border-gray-200">
                                        Com Caixa
                                    </th>
                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-blue-400 uppercase tracking-widest">
                                        Sem Caixa
                                    </th>
                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-purple-400 uppercase tracking-widest border-l border-gray-200">
                                        Com Caixa
                                    </th>
                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                                        Sem Caixa
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-20">
                                            <Tag className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                                            <p className="text-sm text-gray-400 font-medium">
                                                {search
                                                    ? 'Nenhum produto encontrado para esta busca.'
                                                    : 'Nenhuma FT cadastrada para este marketplace.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(ft => (
                                        <FtRow
                                            key={`${ft.id}-${activePlatform}`}
                                            ft={ft}
                                            platform={platform}
                                            savedData={productData[ft.id]}
                                            onDataChange={handleDataChange}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legenda */}
                {!isLoading && !error && filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-5 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legenda margem:</span>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ≥ 30%</span>
                        <span className="flex items-center gap-1.5 text-xs text-yellow-600 font-semibold"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 15–30%</span>
                        <span className="flex items-center gap-1.5 text-xs text-orange-500 font-semibold"><span className="w-2 h-2 rounded-full bg-orange-400" /> 0–15%</span>
                        <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt; 0%</span>
                        <span className="ml-auto text-[10px] text-gray-400 italic">Medidas e pesos são salvos automaticamente</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Precificacao;
