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
    Loader2,
    DollarSign,
    Percent,
    ChevronLeft,
    ChevronRight,
    Award
} from 'lucide-react';
import { api } from '../../services/api';

const PLATFORMS = [
    { id: 'meli', label: 'Mercado Livre', emoji: '🛒', color: '#EAB308', badgeBg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { id: 'shopee', label: 'Shopee', emoji: '🧡', color: '#F97316', badgeBg: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#1F2937', badgeBg: 'bg-gray-100 text-gray-800 border-gray-300' },
    { id: 'amazon', label: 'Amazon', emoji: '📦', color: '#D97706', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'site', label: 'Site', emoji: '🌐', color: '#4F46E5', badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const p = (v) => parseFloat(v) || 0;

const calculateCost = (ft) => {
    if (!ft) return 0;
    if (ft.materialsTotal !== undefined) {
        return p(ft.materialsTotal) + p(ft.directCostsTotal);
    }
    const mat = (ft.materials || []).reduce((a, c) => a + p(c.value), 0);
    const dir = (ft.directCostsRS || []).reduce((a, c) => a + p(c.value), 0);
    const perc = (ft.directCostsPercent || []).reduce((a, c) => a + (p(c.percentage) / 100 * p(ft.salePrice)), 0);
    return mat + dir + perc;
};

// Retorna informações do mês de vendas real a partir da chave de referência (ex: '2026-11' -> Vendas de Outubro de 2026)
const getSalesPeriodInfo = (refMonthStr) => {
    if (!refMonthStr) {
        const now = new Date();
        return {
            salesYear: now.getFullYear(),
            salesMonthIndex: now.getMonth(),
            salesMonthName: MONTH_NAMES[now.getMonth()],
            salesMonthShort: MONTH_SHORT[now.getMonth()],
            lastDay: 30,
            formattedTitle: ''
        };
    }
    const [yearStr, monthStrPart] = refMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStrPart, 10);

    // Mês anterior (m - 2 no Date constructor com base 0)
    const salesDate = new Date(year, month - 2, 1);
    const salesMonthIndex = salesDate.getMonth();
    const salesMonthName = MONTH_NAMES[salesMonthIndex];
    const salesMonthShort = MONTH_SHORT[salesMonthIndex];
    const salesYear = salesDate.getFullYear();
    const lastDay = new Date(year, month - 1, 0).getDate();

    return {
        salesYear,
        salesMonthIndex,
        salesMonthName,
        salesMonthShort,
        lastDay,
        formattedTitle: `VENDAS DE 01 A ${lastDay} DE ${salesMonthName.toUpperCase()} DE ${salesYear}`
    };
};

// Retorna a chave de referência do sistema onde as vendas do mês 'salesMonthIndex' do ano 'salesYear' são armazenadas
// (Regra de negócio: as vendas de Janeiro são lançadas na referência de Fevereiro (2026-02), etc.)
const getRefMonthForSalesMonth = (salesYear, salesMonthIndex) => {
    const targetDate = new Date(salesYear, salesMonthIndex + 1, 1);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const ResumoVendas = () => {
    // Modo de visualização: 'mes' ou 'ano'
    const [viewMode, setViewMode] = useState('mes');

    // Mês de referência de lançamento selecionado atualmente (ex: "2026-11" para vendas de Outubro)
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Informações do período de vendas correspondente ao mês de lançamento selecionado
    const currentSalesInfo = useMemo(() => getSalesPeriodInfo(currentMonth), [currentMonth]);

    // Ano selecionado atualmente para o gráfico e consolidação anual
    const [currentYear, setCurrentYear] = useState(() => {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return prev.getFullYear();
    });

    const [monthlySales, setMonthlySales] = useState({});
    const [fts, setFts] = useState([]);
    const [lockedMonths, setLockedMonths] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlatformFilter, setSelectedPlatformFilter] = useState('all');
    const [sortBy, setSortBy] = useState('val_desc'); // val_desc, val_asc, profit_desc, margin_desc, qtd_desc, code_asc, name_asc

    // Sincroniza a mudança de mês garantindo alinhamento de ano
    const handleMonthChange = (newRefMonth) => {
        setCurrentMonth(newRefMonth);
        const info = getSalesPeriodInfo(newRefMonth);
        if (info.salesYear && info.salesYear !== currentYear) {
            setCurrentYear(info.salesYear);
        }
    };

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

    // Dados agregados do Ano inteiro (12 meses de vendas reais de currentYear)
    const yearAggregation = useMemo(() => {
        const monthStats = MONTH_NAMES.map((fullLabel, salesMonthIdx) => {
            // Chave de referência onde as vendas deste mês real de vendas estão guardadas
            const refMonthStr = getRefMonthForSalesMonth(currentYear, salesMonthIdx);
            let val = 0;
            let qtd = 0;
            let cost = 0;
            const mkts = {};

            PLATFORMS.forEach(pObj => {
                const key = `${pObj.id}_${refMonthStr}`;
                const rows = Array.isArray(monthlySales[key]) ? monthlySales[key] : [];

                rows.forEach(row => {
                    const q = parseInt(row.quantity) || 0;
                    if (q <= 0) return;

                    const resolvedFt = row.snapshot || ftsMap[row.ftId] || {};
                    const uPrice = p(resolvedFt.salePrice);
                    const desc = p(row.discountPercent);
                    const finalPrice = uPrice * (1 - desc / 100);
                    const itemTotal = finalPrice * q;
                    const itemCost = calculateCost(resolvedFt) * q;

                    val += itemTotal;
                    qtd += q;
                    cost += itemCost;

                    if (!mkts[pObj.id]) mkts[pObj.id] = { val: 0, qtd: 0, cost: 0 };
                    mkts[pObj.id].val += itemTotal;
                    mkts[pObj.id].qtd += q;
                    mkts[pObj.id].cost += itemCost;
                });
            });

            const profit = val - cost;
            const margin = val > 0 ? (profit / val) * 100 : 0;

            return {
                salesMonthIndex: salesMonthIdx,
                salesYear: currentYear,
                refMonthStr,
                label: MONTH_SHORT[salesMonthIdx],
                fullLabel,
                val,
                qtd,
                cost,
                profit,
                margin,
                mkts
            };
        });

        const totalYearVal = monthStats.reduce((acc, curr) => acc + curr.val, 0);
        const totalYearQtd = monthStats.reduce((acc, curr) => acc + curr.qtd, 0);
        const totalYearCost = monthStats.reduce((acc, curr) => acc + curr.cost, 0);
        const totalYearProfit = totalYearVal - totalYearCost;
        const totalYearMargin = totalYearVal > 0 ? (totalYearProfit / totalYearVal) * 100 : 0;
        const maxMonthVal = Math.max(...monthStats.map(m => m.val), 1);

        return {
            monthStats,
            totalYearVal,
            totalYearQtd,
            totalYearCost,
            totalYearProfit,
            totalYearMargin,
            maxMonthVal
        };
    }, [currentYear, monthlySales, ftsMap]);

    // Consolidação de vendas do período ativo (Mês específico ou Ano inteiro de vendas reais)
    const summaryData = useMemo(() => {
        const itemsMap = {};
        let grandTotalQtd = 0;
        let grandTotalVal = 0;
        let grandTotalCost = 0;

        const platformTotals = {
            meli: { qtd: 0, val: 0, cost: 0, label: 'Mercado Livre', emoji: '🛒' },
            shopee: { qtd: 0, val: 0, cost: 0, label: 'Shopee', emoji: '🧡' },
            tiktok: { qtd: 0, val: 0, cost: 0, label: 'TikTok', emoji: '🎵' },
            amazon: { qtd: 0, val: 0, cost: 0, label: 'Amazon', emoji: '📦' },
            site: { qtd: 0, val: 0, cost: 0, label: 'Site', emoji: '🌐' }
        };

        // Define quais chaves de meses consultar
        const monthsToInclude = viewMode === 'mes'
            ? [currentMonth]
            : Array.from({ length: 12 }, (_, i) => getRefMonthForSalesMonth(currentYear, i));

        monthsToInclude.forEach(mStr => {
            PLATFORMS.forEach(pObj => {
                const key = `${pObj.id}_${mStr}`;
                const rows = Array.isArray(monthlySales[key]) ? monthlySales[key] : [];

                rows.forEach(row => {
                    const qtd = parseInt(row.quantity) || 0;
                    if (qtd <= 0) return;

                    const resolvedFt = row.snapshot || ftsMap[row.ftId] || {};
                    const code = resolvedFt.ftCode || row.ftId || 'SEM_COD';
                    const name = resolvedFt.name || 'Produto sem nome';
                    const variation = resolvedFt.variation || '';

                    const uPrice = p(resolvedFt.salePrice);
                    const desc = p(row.discountPercent);
                    const finalPrice = uPrice * (1 - desc / 100);
                    const itemTotal = finalPrice * qtd;
                    const uCost = calculateCost(resolvedFt);
                    const itemCostTotal = uCost * qtd;

                    if (!itemsMap[code]) {
                        itemsMap[code] = {
                            ftId: row.ftId,
                            code,
                            name,
                            variation,
                            totalQtd: 0,
                            totalVal: 0,
                            totalCost: 0,
                            platforms: {}
                        };
                    }

                    itemsMap[code].totalQtd += qtd;
                    itemsMap[code].totalVal += itemTotal;
                    itemsMap[code].totalCost += itemCostTotal;

                    grandTotalQtd += qtd;
                    grandTotalVal += itemTotal;
                    grandTotalCost += itemCostTotal;

                    if (!itemsMap[code].platforms[pObj.id]) {
                        itemsMap[code].platforms[pObj.id] = {
                            platformId: pObj.id,
                            label: pObj.label,
                            emoji: pObj.emoji,
                            qtd: 0,
                            val: 0,
                            cost: 0,
                            unitPrice: finalPrice
                        };
                    }

                    itemsMap[code].platforms[pObj.id].qtd += qtd;
                    itemsMap[code].platforms[pObj.id].val += itemTotal;
                    itemsMap[code].platforms[pObj.id].cost += itemCostTotal;

                    if (platformTotals[pObj.id]) {
                        platformTotals[pObj.id].qtd += qtd;
                        platformTotals[pObj.id].val += itemTotal;
                        platformTotals[pObj.id].cost += itemCostTotal;
                    }
                });
            });
        });

        // Calcula Lucro e Margem de cada item
        let itemsList = Object.values(itemsMap).map(item => {
            const profit = item.totalVal - item.totalCost;
            const margin = item.totalVal > 0 ? (profit / item.totalVal) * 100 : 0;
            return {
                ...item,
                profit,
                margin
            };
        });

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
            if (sortBy === 'profit_desc') return b.profit - a.profit;
            if (sortBy === 'profit_asc') return a.profit - b.profit;
            if (sortBy === 'margin_desc') return b.margin - a.margin;
            if (sortBy === 'qtd_desc') return b.totalQtd - a.totalQtd;
            if (sortBy === 'qtd_asc') return a.totalQtd - b.totalQtd;
            if (sortBy === 'code_asc') return a.code.localeCompare(b.code);
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            return 0;
        });

        const grandTotalProfit = grandTotalVal - grandTotalCost;
        const grandTotalMargin = grandTotalVal > 0 ? (grandTotalProfit / grandTotalVal) * 100 : 0;

        return {
            items: itemsList,
            grandTotalQtd,
            grandTotalVal,
            grandTotalCost,
            grandTotalProfit,
            grandTotalMargin,
            distinctCount: Object.keys(itemsMap).length,
            platformTotals
        };
    }, [viewMode, currentMonth, currentYear, monthlySales, ftsMap, searchQuery, selectedPlatformFilter, sortBy]);

    // Status de fechamento do mês (apenas no modo mensal)
    const lockStatusSummary = useMemo(() => {
        if (viewMode !== 'mes') return null;
        const lockedList = PLATFORMS.filter(p => lockedMonths.includes(`${p.id}_${currentMonth}`));
        const allLocked = lockedList.length === PLATFORMS.length;
        const someLocked = lockedList.length > 0;
        return { lockedList, allLocked, someLocked };
    }, [lockedMonths, currentMonth, viewMode]);

    return (
        <div className="space-y-4">
            {/* Header de Controle e Período */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:border-none print:shadow-none">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-800">
                                {viewMode === 'mes' ? 'Resumo Mensal de Vendas' : `Resumo Anual de Vendas — ${currentYear}`}
                            </h2>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {viewMode === 'mes'
                                ? 'Consolidação das vendas de todos os marketplaces para o mês selecionado.'
                                : `Consolidação anual completa de todos os 12 meses de vendas de ${currentYear}.`}
                        </p>
                    </div>

                    {/* Alternador de Modo: Mês vs Ano */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl print:hidden">
                        <button
                            type="button"
                            onClick={() => setViewMode('mes')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'mes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            📅 Mês
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('ano')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'ano' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            📆 Ano Inteiro
                        </button>
                    </div>

                    {/* Mês Formatado ou Ano */}
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold shadow-sm text-sm text-center whitespace-nowrap">
                        {viewMode === 'mes' ? currentSalesInfo.formattedTitle : `VENDAS DO ANO DE ${currentYear}`}
                    </div>

                    {/* Controles de Navegação (Mês ou Ano) */}
                    <div className="flex items-center gap-2 print:hidden">
                        {viewMode === 'mes' ? (
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1" title="Mês de referência onde as vendas foram lançadas no sistema">
                                    <Calendar size={14} /> Ref:
                                </label>
                                <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const [y, m] = currentMonth.split('-').map(Number);
                                            const prev = new Date(y, m - 2, 1);
                                            handleMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 cursor-pointer"
                                        title="Mês anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <input
                                        type="month"
                                        value={currentMonth}
                                        onChange={(e) => handleMonthChange(e.target.value)}
                                        className="text-xs bg-transparent border-none font-bold text-gray-800 outline-none cursor-pointer px-1 py-1"
                                        title="Mês de referência onde as vendas foram salvas"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const [y, m] = currentMonth.split('-').map(Number);
                                            const next = new Date(y, m, 1);
                                            handleMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 cursor-pointer"
                                        title="Próximo mês"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                                <button
                                    onClick={() => setCurrentYear(y => y - 1)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 cursor-pointer"
                                    title="Ano anterior"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm font-bold text-indigo-700 px-2">{currentYear}</span>
                                <button
                                    onClick={() => setCurrentYear(y => y + 1)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 cursor-pointer"
                                    title="Próximo ano"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}

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

                {/* Status de Fechamento do Mês (apenas no modo mensal) */}
                {lockStatusSummary && (
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
                        <div className="text-gray-500 text-[11px] flex items-center gap-1.5">
                            <span>Lançado na Referência:</span>
                            <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono font-bold">{currentMonth}</code>
                            <span className="text-indigo-600 font-semibold">↳ Vendas reais de {currentSalesInfo.salesMonthName}/{currentSalesInfo.salesYear}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Cards de Métricas Principais (KPIs) - Incluindo Lucro e Margem */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 print:grid-cols-5">
                {/* Faturamento */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Faturamento</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(summaryData.grandTotalVal)}</p>
                    </div>
                </div>

                {/* Lucro Bruto */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Lucro Bruto</p>
                        <p className="text-lg font-bold text-green-700">{formatCurrency(summaryData.grandTotalProfit)}</p>
                    </div>
                </div>

                {/* Margem Média */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                        <Percent size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Margem Média</p>
                        <p className="text-lg font-bold text-teal-700">{summaryData.grandTotalMargin.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Total de Peças */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Package size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Total de Peças</p>
                        <p className="text-lg font-bold text-indigo-700">
                            {summaryData.grandTotalQtd.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-gray-500">un</span>
                        </p>
                    </div>
                </div>

                {/* Modelos Distintos */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
                    <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                        <ShoppingCart size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Modelos Distintos</p>
                        <p className="text-lg font-bold text-purple-700">
                            {summaryData.distinctCount} <span className="text-[10px] font-normal text-gray-500">itens</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Gráfico 1: Evolução Mensal do Ano (12 meses de vendas reais) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-bold text-gray-800">
                                Evolução Mensal das Vendas em {currentYear}
                            </h3>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                            Total Ano: <strong className="text-gray-700">{formatCurrency(yearAggregation.totalYearVal)}</strong>
                        </span>
                    </div>

                    {/* Gráfico de Barras Responsivo */}
                    <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-1 border-b border-gray-100">
                        {yearAggregation.monthStats.map((mStat) => {
                            const heightPercent = yearAggregation.maxMonthVal > 0
                                ? (mStat.val / yearAggregation.maxMonthVal) * 100
                                : 0;
                            const isCurrentSelected = viewMode === 'mes' && mStat.refMonthStr === currentMonth;

                            return (
                                <div
                                    key={mStat.refMonthStr}
                                    onClick={() => {
                                        handleMonthChange(mStat.refMonthStr);
                                        setViewMode('mes');
                                    }}
                                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                                    title={`${mStat.fullLabel} de ${currentYear} (Lançado em ${mStat.refMonthStr}): ${formatCurrency(mStat.val)} (${mStat.qtd} un | Lucro: ${formatCurrency(mStat.profit)})`}
                                >
                                    {/* Tooltip / Valor acima da barra */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-indigo-700 mb-1 whitespace-nowrap pointer-events-none">
                                        {mStat.val > 0 ? (mStat.val >= 1000 ? `${(mStat.val / 1000).toFixed(1)}k` : mStat.val.toFixed(0)) : ''}
                                    </div>

                                    {/* Barra */}
                                    <div className="w-full max-w-[28px] bg-gray-100 rounded-t-md h-full flex items-end overflow-hidden">
                                        <div
                                            className={`w-full rounded-t-md transition-all duration-300 ${
                                                isCurrentSelected
                                                    ? 'bg-indigo-600 shadow-md ring-2 ring-indigo-300'
                                                    : mStat.val > 0
                                                    ? 'bg-indigo-400 hover:bg-indigo-500'
                                                    : 'bg-gray-200'
                                            }`}
                                            style={{ height: `${Math.max(heightPercent, mStat.val > 0 ? 6 : 2)}%` }}
                                        />
                                    </div>

                                    {/* Rótulo do Mês */}
                                    <span className={`text-[10px] mt-2 font-medium ${isCurrentSelected ? 'text-indigo-700 font-bold' : 'text-gray-500'}`}>
                                        {mStat.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                        <span>💡 Dica: Clique em qualquer barra para abrir os detalhes das vendas daquele mês.</span>
                        <span className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded bg-indigo-600" /> Mês Selecionado
                            <span className="inline-block w-2.5 h-2.5 rounded bg-indigo-400" /> Outros Meses
                        </span>
                    </div>
                </div>

                {/* Gráfico 2: Participação por Marketplace */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Store size={18} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-gray-800">Canais de Venda</h3>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500">
                                {viewMode === 'mes' ? 'No Mês' : 'No Ano'}
                            </span>
                        </div>

                        {/* Barra Segmentada de Participação */}
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex mb-4">
                            {PLATFORMS.map(pObj => {
                                const data = summaryData.platformTotals[pObj.id] || { val: 0 };
                                const share = summaryData.grandTotalVal > 0 ? (data.val / summaryData.grandTotalVal) * 100 : 0;
                                if (share <= 0) return null;
                                return (
                                    <div
                                        key={pObj.id}
                                        style={{ width: `${share}%`, backgroundColor: pObj.color }}
                                        className="h-full"
                                        title={`${pObj.label}: ${share.toFixed(1)}%`}
                                    />
                                );
                            })}
                        </div>

                        {/* Lista com Barras de Progresso por Canal */}
                        <div className="space-y-2.5">
                            {PLATFORMS.map(pObj => {
                                const data = summaryData.platformTotals[pObj.id] || { val: 0, qtd: 0, cost: 0 };
                                const profit = data.val - data.cost;
                                const margin = data.val > 0 ? (profit / data.val) * 100 : 0;
                                const share = summaryData.grandTotalVal > 0 ? (data.val / summaryData.grandTotalVal) * 100 : 0;

                                return (
                                    <div
                                        key={pObj.id}
                                        onClick={() => setSelectedPlatformFilter(selectedPlatformFilter === pObj.id ? 'all' : pObj.id)}
                                        className={`p-2 rounded-lg transition-all cursor-pointer ${selectedPlatformFilter === pObj.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                                                <span>{pObj.emoji}</span> {pObj.label}
                                            </span>
                                            <span className="font-bold text-gray-900">{formatCurrency(data.val)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                                            <span>{data.qtd} peças</span>
                                            <span>Lucro: <strong className="text-green-700">{formatCurrency(profit)}</strong> ({margin.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-1.5 rounded-full"
                                                style={{ width: `${share}%`, backgroundColor: pObj.color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-[10px] text-gray-400 mt-2 text-center">
                        Clique em um canal para filtrar a tabela abaixo.
                    </div>
                </div>
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
                        <option value="val_desc">💰 Maior Faturamento (R$)</option>
                        <option value="profit_desc">💵 Maior Lucro (R$)</option>
                        <option value="margin_desc">🎯 Maior Margem (%)</option>
                        <option value="qtd_desc">📦 Mais Vendidos (Qtd)</option>
                        <option value="val_asc">Menor Faturamento (R$)</option>
                        <option value="code_asc">🏷️ Código FT</option>
                        <option value="name_asc">🔤 Nome do Produto</option>
                    </select>
                </div>
            </div>

            {/* Listagem de Itens Vendidos (com Faturamento, Custo, Lucro e Margem) */}
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
                        Nenhuma venda registrada para os filtros selecionados no período.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase">Cód. FT</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase">Produto / Item</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase">Onde Vendeu</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase text-right">Qtd</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase text-right">Preço Médio</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase text-right">Faturamento</th>
                                    <th className="px-3 py-2.5 font-bold text-green-700 uppercase text-right">Lucro (R$)</th>
                                    <th className="px-3 py-2.5 font-bold text-teal-700 uppercase text-right">Margem (%)</th>
                                    <th className="px-3 py-2.5 font-bold text-gray-600 uppercase text-center w-24">% Fatur.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {summaryData.items.map(item => {
                                    const share = summaryData.grandTotalVal > 0 ? (item.totalVal / summaryData.grandTotalVal) * 100 : 0;
                                    const avgPrice = item.totalQtd > 0 ? item.totalVal / item.totalQtd : 0;

                                    return (
                                        <tr key={item.code} className="hover:bg-gray-50 transition-colors">
                                            {/* Código FT */}
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold rounded">
                                                    {item.code}
                                                </span>
                                            </td>

                                            {/* Nome / Variação */}
                                            <td className="px-3 py-2.5">
                                                <div className="font-semibold text-gray-900">{item.name}</div>
                                                {item.variation && (
                                                    <div className="text-[11px] text-gray-500">{item.variation}</div>
                                                )}
                                            </td>

                                            {/* Plataformas onde vendeu */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.values(item.platforms).map(pData => (
                                                        <span
                                                            key={pData.platformId}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200"
                                                            title={`${pData.label}: ${pData.qtd} un (${formatCurrency(pData.val)})`}
                                                        >
                                                            <span>{pData.emoji}</span>
                                                            <span>{pData.qtd}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Quantidade Total */}
                                            <td className="px-3 py-2.5 text-right font-bold text-indigo-700 whitespace-nowrap">
                                                {item.totalQtd} <span className="text-[10px] font-normal text-gray-400">un</span>
                                            </td>

                                            {/* Preço Médio */}
                                            <td className="px-3 py-2.5 text-right font-medium text-gray-600 whitespace-nowrap">
                                                {formatCurrency(avgPrice)}
                                            </td>

                                            {/* Faturamento */}
                                            <td className="px-3 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                                                {formatCurrency(item.totalVal)}
                                            </td>

                                            {/* Lucro (R$) */}
                                            <td className="px-3 py-2.5 text-right font-bold text-green-700 whitespace-nowrap">
                                                {formatCurrency(item.profit)}
                                            </td>

                                            {/* Margem (%) */}
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                                    item.margin >= 40
                                                        ? 'bg-green-100 text-green-800'
                                                        : item.margin >= 25
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {item.margin.toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* % Participação */}
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-500 h-1.5 rounded-full"
                                                            style={{ width: `${Math.min(share, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 min-w-[28px] text-right">
                                                        {share.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                                <tr>
                                    <td colSpan={3} className="px-3 py-3 text-right uppercase text-xs">
                                        Total Geral:
                                    </td>
                                    <td className="px-3 py-3 text-right text-indigo-700 text-sm">
                                        {summaryData.grandTotalQtd} un
                                    </td>
                                    <td className="px-3 py-3 text-right text-gray-500">
                                        —
                                    </td>
                                    <td className="px-3 py-3 text-right text-gray-900 text-sm">
                                        {formatCurrency(summaryData.grandTotalVal)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-green-700 text-sm">
                                        {formatCurrency(summaryData.grandTotalProfit)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-teal-700 text-sm">
                                        {summaryData.grandTotalMargin.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs">
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
