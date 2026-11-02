import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart3,
    ShoppingCart,
    TrendingUp,
    Package,
    Search,
    ArrowUpDown,
    Printer,
    Lock,
    Unlock,
    Store,
    Filter,
    Calendar,
    Loader2
} from 'lucide-react';
import { api } from '../../services/api';

const PLATFORMS = [
    { id: 'meli', label: 'Mercado Livre', emoji: '🛒', badgeBg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { id: 'shopee', label: 'Shopee', emoji: '🧡', badgeBg: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: 'tiktok', label: 'TikTok', emoji: '🎵', badgeBg: 'bg-gray-100 text-gray-800 border-gray-300' },
    { id: 'amazon', label: 'Amazon', emoji: '📦', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'site', label: 'Site', emoji: '🌐', badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

const ResumoVendas = () => {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [monthlySales, setMonthlySales] = useState({});
    const [fts, setFts] = useState([]);
    const [lockedMonths, setLockedMonths] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlatformFilter, setSelectedPlatformFilter] = useState('all');
    const [sortBy, setSortBy] = useState('val_desc'); // val_desc, qtd_desc, name_asc, code_asc

    // Carrega dados do Supabase
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [fetchedSales, fetchedFts, lockedData] = await Promise.all([
                    api.getMonthlySales(),
                    api.getFts(),
                    api.getSettings('locked_ecommerce_months').catch(() => [])
                ]);

                setMonthlySales(fetchedSales || {});
                setFts(fetchedFts || []);
                setLockedMonths(lockedData || []);
            } catch (err) {
                console.error('Erro ao carregar dados do Resumo de Vendas:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // Formatação do título do período
    const formatMonthDisplay = (monthStr) => {
        if (!monthStr) return '';
        const [yearStr, monthStrPart] = monthStr.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStrPart, 10);

        const prevDate = new Date(year, month - 2);
        const prevMonthName = prevDate.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
        const prevYear = prevDate.getFullYear();
        const lastDayPrev = new Date(year, month - 1, 0).getDate();

        return `VENDAS DE 01 A ${lastDayPrev} DE ${prevMonthName} DE ${prevYear}`;
    };

    const formatCurrency = (val) => {
        return `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Mapa de FTs para busca rápida
    const ftsMap = useMemo(() => {
        const map = {};
        (fts || []).forEach(f => {
            if (f.id) map[f.id] = f;
            if (f.ftCode) map[f.ftCode] = f;
        });
        return map;
    }, [fts]);

    // Consolidação de vendas do mês selecionado
    const summaryData = useMemo(() => {
        const itemsMap = {};
        let grandTotalQtd = 0;
        let grandTotalVal = 0;

        const platformTotals = {
            meli: { qtd: 0, val: 0, label: 'Mercado Livre', emoji: '🛒' },
            shopee: { qtd: 0, val: 0, label: 'Shopee', emoji: '🧡' },
            tiktok: { qtd: 0, val: 0, label: 'TikTok', emoji: '🎵' },
            amazon: { qtd: 0, val: 0, label: 'Amazon', emoji: '📦' },
            site: { qtd: 0, val: 0, label: 'Site', emoji: '🌐' }
        };

        PLATFORMS.forEach(p => {
            const key = `${p.id}_${currentMonth}`;
            const rows = Array.isArray(monthlySales[key]) ? monthlySales[key] : [];

            rows.forEach(row => {
                const qtd = parseInt(row.quantity) || 0;
                if (qtd <= 0) return;

                const resolvedFt = row.snapshot || ftsMap[row.ftId] || {};
                const code = resolvedFt.ftCode || row.ftId || 'SEM_COD';
                const name = resolvedFt.name || 'Produto sem nome';
                const variation = resolvedFt.variation || '';

                const uPrice = parseFloat(resolvedFt.salePrice) || 0;
                const desc = parseFloat(row.discountPercent) || 0;
                const finalPrice = uPrice * (1 - desc / 100);
                const itemTotal = finalPrice * qtd;

                if (!itemsMap[code]) {
                    itemsMap[code] = {
                        ftId: row.ftId,
                        code,
                        name,
                        variation,
                        totalQtd: 0,
                        totalVal: 0,
                        platforms: {}
                    };
                }

                itemsMap[code].totalQtd += qtd;
                itemsMap[code].totalVal += itemTotal;

                grandTotalQtd += qtd;
                grandTotalVal += itemTotal;

                if (!itemsMap[code].platforms[p.id]) {
                    itemsMap[code].platforms[p.id] = {
                        platformId: p.id,
                        label: p.label,
                        emoji: p.emoji,
                        qtd: 0,
                        val: 0,
                        unitPrice: finalPrice
                    };
                }

                itemsMap[code].platforms[p.id].qtd += qtd;
                itemsMap[code].platforms[p.id].val += itemTotal;

                if (platformTotals[p.id]) {
                    platformTotals[p.id].qtd += qtd;
                    platformTotals[p.id].val += itemTotal;
                }
            });
        });

        // Converte para lista
        let itemsList = Object.values(itemsMap);

        // Filtro por Marketplace
        if (selectedPlatformFilter !== 'all') {
            itemsList = itemsList.filter(item => Boolean(item.platforms[selectedPlatformFilter]));
        }

        // Filtro por Busca
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            itemsList = itemsList.filter(item =>
                (item.code || '').toLowerCase().includes(q) ||
                (item.name || '').toLowerCase().includes(q) ||
                (item.variation || '').toLowerCase().includes(q)
            );
        }

        // Ordenação
        itemsList.sort((a, b) => {
            if (sortBy === 'val_desc') return b.totalVal - a.totalVal;
            if (sortBy === 'val_asc') return a.totalVal - b.totalVal;
            if (sortBy === 'qtd_desc') return b.totalQtd - a.totalQtd;
            if (sortBy === 'qtd_asc') return a.totalQtd - b.totalQtd;
            if (sortBy === 'code_asc') return a.code.localeCompare(b.code);
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            return 0;
        });

        return {
            items: itemsList,
            grandTotalQtd,
            grandTotalVal,
            distinctCount: Object.keys(itemsMap).length,
            platformTotals
        };
    }, [currentMonth, monthlySales, ftsMap, searchQuery, selectedPlatformFilter, sortBy]);

    // Status de fechamento por marketplace
    const lockStatusSummary = useMemo(() => {
        const lockedList = PLATFORMS.filter(p => lockedMonths.includes(`${p.id}_${currentMonth}`));
        const allLocked = lockedList.length === PLATFORMS.length;
        const someLocked = lockedList.length > 0;
        return { lockedList, allLocked, someLocked };
    }, [lockedMonths, currentMonth]);

    return (
        <div className="space-y-4">
            {/* Header de Controle e Período */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:border-none print:shadow-none">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-800">Resumo Geral de Vendas</h2>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Consolidação de todos os itens e canais vendidos no mês selecionado.
                        </p>
                    </div>

                    {/* Mês Formatado */}
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold shadow-sm text-sm text-center whitespace-nowrap">
                        {formatMonthDisplay(currentMonth)}
                    </div>

                    {/* Seletor de Mês e Impressão */}
                    <div className="flex items-center gap-2 print:hidden">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Calendar size={14} /> Mês:
                        </label>
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                        <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Imprimir relatório"
                        >
                            <Printer size={15} />
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* Status de Fechamento do Mês */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-600">Status do Mês:</span>
                        {lockStatusSummary.allLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-green-100 text-green-700 border border-green-200">
                                <Lock size={12} /> Mês Fechado / Travado em todas as plataformas
                            </span>
                        ) : lockStatusSummary.someLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Lock size={12} /> Parcialmente Fechado ({lockStatusSummary.lockedList.map(p => p.label).join(', ')})
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                <Unlock size={12} /> Mês em Aberto
                            </span>
                        )}
                    </div>
                    <div className="text-gray-400 text-[11px]">
                        Referência do sistema: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">{currentMonth}</code>
                    </div>
                </div>
            </div>

            {/* Cards de Métricas Principais (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Faturamento Consolidado</p>
                        <p className="text-xl font-bold text-emerald-700">{formatCurrency(summaryData.grandTotalVal)}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Total de Itens Vendidos</p>
                        <p className="text-xl font-bold text-indigo-700">
                            {summaryData.grandTotalQtd.toLocaleString('pt-BR')} <span className="text-xs font-normal text-gray-500">peças</span>
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Produtos Distintos Vendidos</p>
                        <p className="text-xl font-bold text-purple-700">
                            {summaryData.distinctCount} <span className="text-xs font-normal text-gray-500">modelos</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Breakdown Rápido por Marketplace */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {PLATFORMS.map(p => {
                    const data = summaryData.platformTotals[p.id] || { qtd: 0, val: 0 };
                    const share = summaryData.grandTotalVal > 0 ? (data.val / summaryData.grandTotalVal) * 100 : 0;
                    return (
                        <div
                            key={p.id}
                            onClick={() => setSelectedPlatformFilter(selectedPlatformFilter === p.id ? 'all' : p.id)}
                            className={`bg-white p-3 rounded-xl border transition-all cursor-pointer ${selectedPlatformFilter === p.id ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/20 shadow-md' : 'border-gray-100 hover:border-gray-300'}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">{p.emoji}</span>
                                <span className="text-[10px] font-bold text-gray-500">{share.toFixed(1)}%</span>
                            </div>
                            <div className="text-xs font-bold text-gray-700 truncate">{p.label}</div>
                            <div className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(data.val)}</div>
                            <div className="text-[10px] text-gray-500">{data.qtd} un vendidas</div>
                        </div>
                    );
                })}
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por código (ex: FT008) ou nome..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Filter size={14} className="text-gray-400" />
                        <select
                            value={selectedPlatformFilter}
                            onChange={(e) => setSelectedPlatformFilter(e.target.value)}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 font-medium outline-none"
                        >
                            <option value="all">🌐 Todas as Plataformas</option>
                            {PLATFORMS.map(p => (
                                <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <ArrowUpDown size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Ordenar por:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 font-medium outline-none"
                    >
                        <option value="val_desc">💰 Maior Valor (R$)</option>
                        <option value="val_asc">💰 Menor Valor (R$)</option>
                        <option value="qtd_desc">📦 Mais Vendidos (Qtd)</option>
                        <option value="qtd_asc">📦 Menos Vendidos (Qtd)</option>
                        <option value="code_asc">🏷️ Código FT</option>
                        <option value="name_asc">🔤 Nome do Produto</option>
                    </select>
                </div>
            </div>

            {/* Listagem de Itens Vendidos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Store size={16} className="text-indigo-600" />
                        Listagem Detalhada de Itens Vendidos
                        <span className="text-xs font-normal text-gray-500">({summaryData.items.length} itens)</span>
                    </h3>
                    {selectedPlatformFilter !== 'all' && (
                        <button
                            onClick={() => setSelectedPlatformFilter('all')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                            Limpar filtro de plataforma
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <span className="ml-2 text-indigo-600 font-medium text-sm">Carregando vendas...</span>
                    </div>
                ) : summaryData.items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        Nenhuma venda registrada para os filtros selecionados no mês de {formatMonthDisplay(currentMonth)}.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase">Cód. FT</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase">Produto / Item</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase">Onde Vendeu (Canais)</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase text-right">Qtd Total</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase text-right">Preço Médio</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase text-right">Total (R$)</th>
                                    <th className="px-4 py-2.5 font-bold text-gray-600 uppercase text-center w-28">% Faturamento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {summaryData.items.map(item => {
                                    const share = summaryData.grandTotalVal > 0 ? (item.totalVal / summaryData.grandTotalVal) * 100 : 0;
                                    const avgPrice = item.totalQtd > 0 ? item.totalVal / item.totalQtd : 0;

                                    return (
                                        <tr key={item.code} className="hover:bg-gray-50 transition-colors">
                                            {/* Código FT */}
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold rounded">
                                                    {item.code}
                                                </span>
                                            </td>

                                            {/* Nome / Variação */}
                                            <td className="px-4 py-2.5">
                                                <div className="font-semibold text-gray-900">{item.name}</div>
                                                {item.variation && (
                                                    <div className="text-[11px] text-gray-500">{item.variation}</div>
                                                )}
                                            </td>

                                            {/* Plataformas onde vendeu */}
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {Object.values(item.platforms).map(pData => (
                                                        <span
                                                            key={pData.platformId}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200"
                                                            title={`${pData.label}: ${pData.qtd} un (${formatCurrency(pData.val)})`}
                                                        >
                                                            <span>{pData.emoji}</span>
                                                            <span>{pData.qtd} un</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Quantidade Total */}
                                            <td className="px-4 py-2.5 text-right font-bold text-indigo-700 text-sm whitespace-nowrap">
                                                {item.totalQtd} <span className="text-[10px] font-normal text-gray-400">un</span>
                                            </td>

                                            {/* Preço Médio */}
                                            <td className="px-4 py-2.5 text-right font-medium text-gray-600 whitespace-nowrap">
                                                {formatCurrency(avgPrice)}
                                            </td>

                                            {/* Valor Total */}
                                            <td className="px-4 py-2.5 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                                                {formatCurrency(item.totalVal)}
                                            </td>

                                            {/* % Participação */}
                                            <td className="px-4 py-2.5 text-center">
                                                <div className="flex items-center gap-1.5 justify-center">
                                                    <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-500 h-1.5 rounded-full"
                                                            style={{ width: `${Math.min(share, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 min-w-[32px] text-right">
                                                        {share.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right uppercase text-xs">
                                        Total Geral do Período:
                                    </td>
                                    <td className="px-4 py-3 text-right text-indigo-700 text-sm">
                                        {summaryData.grandTotalQtd} un
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500">
                                        —
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-700 text-base">
                                        {formatCurrency(summaryData.grandTotalVal)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs">
                                        100%
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumoVendas;
