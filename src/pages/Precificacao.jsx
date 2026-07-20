import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Tag, Search, TrendingUp, Loader2, Zap, Target, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLATFORMS = [
    {
        id: 'meli',
        label: 'Mercado Livre',
        emoji: '🛒',
        color: 'bg-yellow-400 hover:bg-yellow-500',
        ring: 'ring-yellow-300',
        textColor: 'text-yellow-900',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-800',
        borderAccent: 'border-l-yellow-400',
    },
    {
        id: 'shopee',
        label: 'Shopee',
        emoji: '🧡',
        color: 'bg-orange-500 hover:bg-orange-600',
        ring: 'ring-orange-300',
        textColor: 'text-white',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-700',
        borderAccent: 'border-l-orange-400',
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        emoji: '🎵',
        color: 'bg-gray-900 hover:bg-black',
        ring: 'ring-gray-500',
        textColor: 'text-white',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-700',
        borderAccent: 'border-l-gray-600',
    },
    {
        id: 'amazon',
        label: 'Amazon',
        emoji: '📦',
        color: 'bg-amber-500 hover:bg-amber-600',
        ring: 'ring-amber-300',
        textColor: 'text-white',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-700',
        borderAccent: 'border-l-amber-400',
    },
    {
        id: 'site',
        label: 'Site',
        emoji: '🌐',
        color: 'bg-indigo-600 hover:bg-indigo-700',
        ring: 'ring-indigo-300',
        textColor: 'text-white',
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-700',
        borderAccent: 'border-l-indigo-500',
    },
];

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

/** Normaliza valor monetário (aceita vírgula ou ponto como decimal) */
const parseNum = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).replace(/[R$\s]/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
};

/**
 * Retorna os custos fixos (R$) e percentuais do produto naquele marketplace.
 * - fixedCosts: materiais + custos diretos R$  (não dependem do preço)
 * - percentRate: somatório dos custos percentuais (0‒1)  (dependem do preço)
 */
const calcFtCosts = (ft) => {
    const materialsTotal    = (ft.materials         || []).reduce((a, c) => a + parseNum(c.value),      0);
    const directCostsRS     = (ft.directCostsRS     || []).reduce((a, c) => a + parseNum(c.value),      0);
    const directCostsPerc   = (ft.directCostsPercent|| []).reduce((a, c) => a + parseNum(c.percentage), 0) / 100;
    const fixedCosts = materialsTotal + directCostsRS;
    return { materialsTotal, directCostsRS, fixedCosts, percentRate: directCostsPerc };
};

/**
 * Calcula margem de contribuição para um preço de venda dado.
 * MC (%) = (PV - Custos Variáveis) / PV × 100
 */
const calcMargin = (price, fixedCosts, percentRate) => {
    if (!price || price <= 0) return null;
    const totalCost = fixedCosts + percentRate * price;
    const marginRS  = price - totalCost;
    const margin    = (marginRS / price) * 100;
    return { margin, marginRS };
};

/**
 * Preço de queima = preço em que a margem é exatamente 0%.
 * 0 = PV - fixedCosts - percentRate × PV  →  PV = fixedCosts / (1 - percentRate)
 */
const calcQueima = (fixedCosts, percentRate) => {
    if (percentRate >= 1) return null;   // impossível (custos consomem 100%+ do preço)
    const queima = fixedCosts / (1 - percentRate);
    return queima > 0 ? queima : null;
};

const fmt = (v) =>
    v != null
        ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—';

const fmtPct = (v, decimals = 1) =>
    v != null ? `${v.toFixed(decimals)}%` : '—';

/** Cor da margem conforme faixa */
const marginColor = (pct) => {
    if (pct == null) return 'text-gray-400';
    if (pct >= 30)  return 'text-emerald-600';
    if (pct >= 15)  return 'text-yellow-600';
    if (pct >= 0)   return 'text-orange-500';
    return 'text-red-600';
};

const marginBg = (pct) => {
    if (pct == null) return '';
    if (pct >= 30)  return 'bg-emerald-50';
    if (pct >= 15)  return 'bg-yellow-50';
    if (pct >= 0)   return 'bg-orange-50';
    return 'bg-red-50';
};

// ─── Linha da tabela (estado local do Valor de Rankeamento) ───────────────────

const FtRow = React.memo(({ ft, platform }) => {
    const [rankInput, setRankInput] = useState('');

    const { fixedCosts, percentRate } = useMemo(() => calcFtCosts(ft), [ft]);
    const salePrice = parseNum(ft.salePrice);

    const currentMargin = useMemo(
        () => calcMargin(salePrice, fixedCosts, percentRate),
        [salePrice, fixedCosts, percentRate]
    );

    const queimaPrice = useMemo(
        () => calcQueima(fixedCosts, percentRate),
        [fixedCosts, percentRate]
    );

    // Calcula margem do Valor de Rankeamento conforme o usuário digita
    const rankPrice = useMemo(() => {
        const raw = rankInput.replace(',', '.');
        const n = parseFloat(raw);
        return !isNaN(n) && n > 0 ? n : null;
    }, [rankInput]);

    const rankMargin = useMemo(
        () => rankPrice ? calcMargin(rankPrice, fixedCosts, percentRate) : null,
        [rankPrice, fixedCosts, percentRate]
    );

    return (
        <tr className={clsx(
            'border-b border-gray-100 hover:bg-gray-50/70 transition-colors group',
            `border-l-4 ${platform.borderAccent}`
        )}>
            {/* FT Code */}
            <td className="px-4 py-3.5 w-24">
                <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide',
                    platform.badgeBg,
                    platform.badgeText
                )}>
                    {ft.ftCode}
                </span>
            </td>

            {/* Nome */}
            <td className="px-4 py-3.5">
                <div className="font-semibold text-sm text-gray-800 leading-tight">{ft.name}</div>
                {ft.variation && (
                    <div className="text-xs text-gray-400 mt-0.5">{ft.variation}</div>
                )}
                {ft.isOverride && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">
                        Preço customizado
                    </span>
                )}
            </td>

            {/* Valor de Venda */}
            <td className="px-4 py-3.5 text-right w-32">
                <div className="font-bold text-gray-800 text-sm">{fmt(salePrice)}</div>
            </td>

            {/* Margem Atual */}
            <td className={clsx('px-4 py-3.5 text-right w-36', currentMargin ? marginBg(currentMargin.margin) : '')}>
                {currentMargin ? (
                    <>
                        <div className={clsx('font-black text-base leading-tight', marginColor(currentMargin.margin))}>
                            {fmtPct(currentMargin.margin)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-medium">
                            {fmt(currentMargin.marginRS)}
                        </div>
                    </>
                ) : (
                    <span className="text-gray-300 text-sm">—</span>
                )}
            </td>

            {/* Valor de Rankeamento */}
            <td className="px-4 py-3.5 w-44">
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={rankInput}
                    onChange={e => setRankInput(e.target.value)}
                    className={clsx(
                        'w-32 border rounded-lg px-3 py-1.5 text-sm text-right font-semibold',
                        'focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all',
                        rankMargin
                            ? 'border-indigo-200 bg-indigo-50/40'
                            : 'border-gray-200 bg-white'
                    )}
                />
                {rankMargin && (
                    <div className={clsx(
                        'mt-1.5 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5',
                        marginBg(rankMargin.margin)
                    )}>
                        <span className={clsx('text-xs font-black', marginColor(rankMargin.margin))}>
                            {fmtPct(rankMargin.margin)}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                            {fmt(rankMargin.marginRS)}
                        </span>
                    </div>
                )}
            </td>

            {/* Valor de Queima */}
            <td className="px-4 py-3.5 text-right w-36">
                {queimaPrice != null ? (
                    <>
                        <div className="font-bold text-red-500 text-sm">{fmt(queimaPrice)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">Margem 0%</div>
                    </>
                ) : (
                    <span className="text-gray-300 text-sm">—</span>
                )}
            </td>
        </tr>
    );
});

FtRow.displayName = 'FtRow';

// ─── Página principal ─────────────────────────────────────────────────────────

const Precificacao = ({ readOnly }) => {
    const [activePlatform, setActivePlatform] = useState('meli');
    const [ftsData, setFtsData]   = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]       = useState(null);
    const [search, setSearch]     = useState('');

    // Carrega FTs + overrides do marketplace selecionado
    const load = useCallback(async (platformId) => {
        setIsLoading(true);
        setError(null);
        try {
            const [fts, overrides] = await Promise.all([
                api.getFts(),
                api.getSettings(`ft_overrides_${platformId}`).catch(() => ({})),
            ]);

            const overridesData = overrides || {};
            const enriched = fts.map(ft => {
                if (overridesData[ft.ftCode]) {
                    return { ...ft, ...overridesData[ft.ftCode], isOverride: true };
                }
                return { ...ft, isOverride: false };
            });

            // Ordena por código FT
            enriched.sort((a, b) => a.ftCode.localeCompare(b.ftCode, 'pt-BR', { numeric: true }));
            setFtsData(enriched);
        } catch (err) {
            console.error('Erro ao carregar FTs:', err);
            setError('Não foi possível carregar os produtos. Verifique a conexão e tente novamente.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load(activePlatform);
    }, [activePlatform, load]);

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

    // Estatísticas rápidas
    const stats = useMemo(() => {
        const valid = ftsData.filter(ft => parseNum(ft.salePrice) > 0);
        if (!valid.length) return null;

        const margins = valid.map(ft => {
            const { fixedCosts, percentRate } = calcFtCosts(ft);
            const m = calcMargin(parseNum(ft.salePrice), fixedCosts, percentRate);
            return m?.margin ?? 0;
        });

        const avg = margins.reduce((a, b) => a + b, 0) / margins.length;
        const above30 = margins.filter(m => m >= 30).length;
        const negative = margins.filter(m => m < 0).length;

        return { avg, above30, negative, total: valid.length };
    }, [ftsData]);

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Tag className="w-6 h-6 text-indigo-600" />
                        Precificação
                    </h1>
                    <p className="text-gray-400 text-sm mt-0.5">
                        Margens, rankeamento e preço de queima por marketplace
                    </p>
                </div>
            </div>

            {/* ── Seletor de Marketplace ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Selecionar Marketplace
                </p>
                <div className="flex flex-wrap gap-2.5">
                    {PLATFORMS.map(pl => (
                        <button
                            key={pl.id}
                            onClick={() => { setActivePlatform(pl.id); setSearch(''); }}
                            className={clsx(
                                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                                pl.color,
                                pl.textColor,
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

            {/* ── Cards de Estatísticas ── */}
            {stats && !isLoading && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margem Média</p>
                        <p className={clsx('text-2xl font-black mt-1', marginColor(stats.avg))}>
                            {fmtPct(stats.avg)}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acima de 30%</p>
                        <p className="text-2xl font-black mt-1 text-emerald-600">
                            {stats.above30} <span className="text-sm font-semibold text-gray-400">/ {stats.total}</span>
                        </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margem Negativa</p>
                        <p className={clsx('text-2xl font-black mt-1', stats.negative > 0 ? 'text-red-500' : 'text-gray-300')}>
                            {stats.negative}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Tabela ── */}
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

                {/* Estado de carregamento */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <span className="text-sm text-gray-400 font-medium">Carregando produtos...</span>
                    </div>
                )}

                {/* Estado de erro */}
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
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="flex items-center justify-end gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            Margem Atual
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-1">
                                            <Target className="w-3 h-3 text-indigo-400" />
                                            Valor de Rankeamento
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="flex items-center justify-end gap-1">
                                            <Zap className="w-3 h-3 text-red-400" />
                                            Valor de Queima
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20">
                                            <Tag className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                                            <p className="text-sm text-gray-400 font-medium">
                                                {search ? 'Nenhum produto encontrado para esta busca.' : 'Nenhuma FT cadastrada para este marketplace.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(ft => (
                                        <FtRow
                                            key={`${ft.id}-${activePlatform}`}
                                            ft={ft}
                                            platform={platform}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legenda das margens */}
                {!isLoading && !error && filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legenda margem:</span>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥ 30%
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-yellow-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 15–30%
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-orange-500 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> 0–15%
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt; 0%
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Precificacao;
