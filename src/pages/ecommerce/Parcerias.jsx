import React, { useState, useEffect } from 'react';
import { Handshake, Loader2, Building2, ShoppingCart, Package, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';

const LS_KEY = 'parcerias_percent_config';

const getWorkHoursInMonth = (monthStr) => {
    if (!monthStr) return 0;
    const [year, month] = monthStr.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const targetYear = prevDate.getFullYear();
    const targetMonthIndex = prevDate.getMonth();
    const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    let weekdays = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(targetYear, targetMonthIndex, i).getDay();
        if (d !== 0 && d !== 6) weekdays++;
    }
    return weekdays * 7;
};

const Parcerias = () => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) =>
        `${currentYear}-${String(i + 1).padStart(2, '0')}`
    );
    const p = (v) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        let clean = String(v).replace(/[R$\s]/g, ''); // Remove R$ e espaços
        // Se tiver tanto ponto quanto vírgula (ex: 1.234,56), o ponto é milhar.
        if (clean.includes(',') && clean.includes('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            // Se tiver apenas vírgula (ex: 1234,56), é o decimal.
            clean = clean.replace(',', '.');
        }
        // Se só tiver ponto (ex: 1234.56), parseFloat já cuida ou não mexemos.
        return parseFloat(clean) || 0;
    };

    const [vendasData, setVendasData] = useState({});
    const [custosData, setCustosData] = useState({});
    const [ftsData, setFtsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // percentConfig: { [month]: { percentLume: number, percentBureau: number } }
    const [percentConfig, setPercentConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
        catch { return {}; }
    });

    const updatePercent = (month, field, value) => {
        setPercentConfig(prev => {
            const next = { ...prev, [month]: { ...prev[month], [field]: parseFloat(value) || 0 } };
            localStorage.setItem(LS_KEY, JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        const loadDados = async () => {
            setIsLoading(true);
            try {
                const fts = await api.getFts();
                setFtsData(fts);

                let dbSales = await api.getMonthlySales();
                const savedVendas = localStorage.getItem('ecommerce_vendas');
                if (savedVendas && Object.keys(dbSales).length === 0) dbSales = JSON.parse(savedVendas);
                setVendasData(dbSales);

                let dbCosts = await api.getMonthlyCosts();
                const savedCustos = localStorage.getItem('ecommerce_empresas_custos_mensal');
                if (savedCustos && Object.keys(dbCosts).length === 0) dbCosts = JSON.parse(savedCustos);
                setCustosData(dbCosts);
            } catch (error) {
                console.error('Erro ao carregar dados em Parcerias:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadDados();
        window.addEventListener('focus', loadDados);
        return () => window.removeEventListener('focus', loadDados);
    }, []);

    // --- Helpers FTs ---
    const calcMaterials = (ft) => ft?.materials?.reduce((a, c) => a + p(c.value), 0) || 0;
    const calcDirectCostsRS = (ft) => ft?.directCostsRS?.reduce((a, c) => a + p(c.value), 0) || 0;
    const calcDirectCostsPerc = (ft, precoEfet) => {
        if (!ft) return 0;
        const percTotal = ft.directCostsPercent?.reduce((a, c) => a + p(c.percentage), 0) || 0;
        return (percTotal / 100) * (p(ft.salePrice) || precoEfet);
    };
    const calcCost = (ft) => calcMaterials(ft) + calcDirectCosts(ft);

    // --- Dados de Vendas + Lucro Líquido por mês ---
    // --- Dados de Vendas + Lucro Líquido por mês ---
    const getVendasSummary = (month) => {
        let totalFaturamento = 0, totalMateriais = 0, totalCustosDiretosRS = 0, totalCustosDiretosPerc = 0;
        const PLATFORMS_ID = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];

        PLATFORMS_ID.forEach(pid => {
            const key = `${pid}_${month}`;
            const rows = Array.isArray(vendasData[key]) ? vendasData[key] : [];

            rows.forEach(row => {
                const ft = ftsData.find(f => f.id === row.ftId);
                if (!ft) return;
                const qty = parseInt(row.quantity) || 0;
                const precoBase = p(ft.salePrice);
                const desconto = p(row.discountPercent);
                const precoEfetivo = precoBase * (1 - desconto / 100);

                totalFaturamento += precoEfetivo * qty;
                totalMateriais += calcMaterials(ft) * qty;
                totalCustosDiretosRS += calcDirectCostsRS(ft) * qty;
                totalCustosDiretosPerc += calcDirectCostsPerc(ft, precoEfetivo) * qty;
            });
        });

        return { totalFaturamento, totalMateriais, totalCustosDiretosRS, totalCustosDiretosPerc };
    };

    // --- Custos inevitáveis reais por mês (Horas + Rateio) ---
    const getMonthCustoInev = (month) => {
        const costData = custosData[month];
        if (!costData) return { lumeRS: 0, bureauRS: 0, custosExtrasRS: 0 };

        const monthHours = getWorkHoursInMonth(month);
        const empresas = costData.empresas || [];

        // 1. Custo Hora Empresa 1 (Lume)
        let custoHoraEmp1 = 0;
        if (empresas.length > 0) {
            const emp1 = empresas[0];
            const totalEmp1 = (emp1.expenses || []).reduce((a, c) => a + p(c.value), 0);
            const dispEmp1 = (emp1.productionFactor || 0) * monthHours;
            custoHoraEmp1 = dispEmp1 > 0 ? totalEmp1 / dispEmp1 : 0;
        }

        // 2. Rateio das demais empresas (Bureau e outras)
        let rateioRestantesTotal = 0;
        if (empresas.length > 1) {
            empresas.forEach((emp, idx) => {
                if (idx === 0) return;
                const totalEmp = (emp.expenses || []).reduce((a, c) => a + p(c.value), 0);
                const perc = emp.ecommerceShare || 0;
                rateioRestantesTotal += totalEmp * (perc / 100);
            });
        }

        // 3. Custos Extras Genéricos + Ads (agrupado aqui)
        const adsArr = Array.isArray(costData?.ads) ? costData.ads : [];
        const extrasArr = Array.isArray(costData?.gastosExtras) ? costData.gastosExtras : [];
        const custosExtrasRS = adsArr.reduce((a, c) => a + p(c.value), 0) +
            extrasArr.reduce((a, c) => a + p(c.value), 0);

        // 4. Somar horas consumidas de todas as vendas deste mês
        let horasTotaisConsumidas = 0;
        const PLATFORMS = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];

        PLATFORMS.forEach(pid => {
            const key = `${pid}_${month}`;
            const ftsLocal = ftsData; // Usa FTs globais para cálculo geral
            const vendas = Array.isArray(vendasData[key]) ? vendasData[key] : [];

            vendas.forEach(row => {
                const ft = ftsLocal.find(f => f.id === row.ftId);
                if (ft) {
                    const tempoMin = parseFloat(ft.productionTime) || 0;
                    const qtd = parseInt(row.quantity) || 0;
                    horasTotaisConsumidas += (tempoMin / 60) * qtd;
                }
            });
        });

        const lumeRS = horasTotaisConsumidas * custoHoraEmp1;
        const bureauRS = rateioRestantesTotal;

        return { lumeRS, bureauRS, custosExtrasRS };
    };

    // --- Lucro Líquido ---
    const getLucroLiquido = (month) => {
        const v = getVendasSummary(month);
        const c = getMonthCustoInev(month);
        const custoTotal = v.totalMateriais + v.totalCustosDiretosRS + v.totalCustosDiretosPerc + c.custosExtrasRS;
        const custoInevitavel = c.lumeRS + c.bureauRS;
        return v.totalFaturamento - custoTotal - custoInevitavel;
    };

    const fmt = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [y, m] = monthStr.split('-').map(Number);
        const date = new Date(y, m - 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
        const prevDate = new Date(y, m - 2);
        const prevMonthNum = String(prevDate.getMonth() + 1).padStart(2, '0');
        const lastDayPrev = new Date(y, m - 1, 0).getDate();
        return `${monthName} DE ${y} — VENDAS DE 01/${prevMonthNum} A ${lastDayPrev}/${prevMonthNum}`;
    };

    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const orderedMonths = [currentMonthStr, ...months.filter(m => m !== currentMonthStr)];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Handshake className="w-6 h-6 text-indigo-600" />
                        Parcerias
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Distribuição de custos e cálculos por parceiro — {currentYear}</p>
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="ml-2 text-indigo-600 font-medium">Carregando dados...</span>
                </div>
            )}

            {/* Lista de meses */}
            {!isLoading && (
                <div className="space-y-4">
                    {orderedMonths.map(month => {
                        const v = getVendasSummary(month);
                        const c = getMonthCustoInev(month);
                        const lucroLiquido = getLucroLiquido(month);
                        const isCurrent = month === currentMonthStr;
                        const hasData = v.totalFaturamento > 0 || c.lumeRS > 0 || c.bureauRS > 0;

                        const pLume = percentConfig[month]?.percentLume || 0;
                        const pBureau = percentConfig[month]?.percentBureau || 0;

                        // Cálculos E-Commerce
                        const lumeEcomm = c.lumeRS + c.custosExtrasRS + v.totalMateriais + v.totalCustosDiretosRS + v.totalCustosDiretosPerc + (pLume / 100) * lucroLiquido;
                        const bureauEcomm = c.bureauRS + (pBureau / 100) * lucroLiquido;

                        return (
                            <div
                                key={month}
                                className={clsx(
                                    'bg-white rounded-xl overflow-hidden',
                                    isCurrent
                                        ? 'border-2 border-indigo-500 ring-4 ring-indigo-100 shadow-xl shadow-indigo-100/50'
                                        : 'border border-gray-200 shadow-sm',
                                    !hasData && !isCurrent && 'opacity-50'
                                )}
                            >
                                {/* Cabeçalho do mês */}
                                <div className={clsx(
                                    'px-5 py-3 border-b flex items-center gap-3',
                                    isCurrent ? 'bg-indigo-600 border-indigo-700' : 'bg-gray-50 border-gray-100'
                                )}>
                                    {isCurrent && (
                                        <span className="px-2 py-0.5 bg-yellow-400 text-indigo-900 text-[10px] uppercase font-bold rounded">
                                            Mês Atual
                                        </span>
                                    )}
                                    <h4 className={clsx('font-bold text-sm', isCurrent ? 'text-white' : 'text-gray-700')}>
                                        {formatMonthName(month)}
                                    </h4>
                                </div>

                                {/* Conteúdo: 2 colunas */}
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* ===== COLUNA ESQUERDA — Dados ===== */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Dados do Mês</p>

                                        {/* Total Vendas / Faturamento */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                            <div className="flex items-center gap-1.5">
                                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-xs text-gray-600 font-medium">Faturamento</span>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-700">{fmt(v.totalFaturamento)}</span>
                                        </div>

                                        {/* Total Materiais */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-xs text-gray-600 font-medium">Custo Materiais</span>
                                            </div>
                                            <span className="text-sm font-bold text-blue-700">{fmt(v.totalMateriais)}</span>
                                        </div>

                                        {/* Total C. Diretos */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
                                            <span className="text-xs text-gray-600 font-medium">Custos Diretos (R$)</span>
                                            <span className="text-sm font-bold text-orange-600">{fmt(v.totalCustosDiretosRS)}</span>
                                        </div>
                                        <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
                                            <span className="text-xs text-gray-600 font-medium">Custos Diretos (%)</span>
                                            <span className="text-sm font-bold text-orange-600">{fmt(v.totalCustosDiretosPerc)}</span>
                                        </div>

                                        {/* Ads+Extras */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-100">
                                            <span className="text-xs text-gray-600 font-medium">Ads+Extras</span>
                                            <span className="text-sm font-bold text-yellow-700">{fmt(c.custosExtrasRS)}</span>
                                        </div>

                                        {/* LUME R$ */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                                                <span className="text-xs text-gray-600 font-medium">Inev. Lume</span>
                                            </div>
                                            <span className="text-sm font-bold text-indigo-700">{fmt(c.lumeRS)}</span>
                                        </div>

                                        {/* BUREAU R$ */}
                                        <div className="flex justify-between items-center px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                                                <span className="text-xs text-gray-600 font-medium">Inev. Bureau</span>
                                            </div>
                                            <span className="text-sm font-bold text-purple-700">{fmt(c.bureauRS)}</span>
                                        </div>

                                        {/* Lucro Líquido */}
                                        <div className={clsx(
                                            'flex justify-between items-center px-3 py-2 rounded-lg border',
                                            lucroLiquido >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'
                                        )}>
                                            <div className="flex items-center gap-1.5">
                                                <Wallet className={clsx('w-3.5 h-3.5', lucroLiquido >= 0 ? 'text-teal-500' : 'text-red-400')} />
                                                <span className="text-xs text-gray-600 font-medium">Lucro Líquido</span>
                                            </div>
                                            <span className={clsx('text-sm font-bold', lucroLiquido >= 0 ? 'text-teal-700' : 'text-red-600')}>
                                                {fmt(lucroLiquido)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ===== COLUNA DIREITA — E-Commerce ===== */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">E-Commerce</p>

                                        {/* LUME E-Commerce */}
                                        <div className="bg-indigo-50 rounded-xl border border-indigo-200 overflow-hidden">
                                            <div className="bg-indigo-600 px-4 py-2">
                                                <span className="text-white text-xs font-bold uppercase tracking-wide">LUME</span>
                                            </div>
                                            <div className="p-3 space-y-1.5 text-xs text-gray-500">
                                                <div className="flex justify-between"><span>Inev. Lume</span><span className="text-gray-700 font-medium">{fmt(c.lumeRS)}</span></div>
                                                <div className="flex justify-between"><span>+ Ads+Extras</span><span className="text-gray-700 font-medium">{fmt(c.custosExtrasRS)}</span></div>
                                                <div className="flex justify-between"><span>+ Custo Materiais</span><span className="text-gray-700 font-medium">{fmt(v.totalMateriais)}</span></div>
                                                <div className="flex justify-between"><span>+ Custos Diretos (R$)</span><span className="text-gray-700 font-medium">{fmt(v.totalCustosDiretosRS)}</span></div>
                                                <div className="flex justify-between"><span>+ Custos Diretos (%)</span><span className="text-gray-700 font-medium">{fmt(v.totalCustosDiretosPerc)}</span></div>

                                                {/* % Lucro Líquido LUME */}
                                                <div className="flex justify-between items-center pt-1 border-t border-indigo-100">
                                                    <span>+ % do Lucro Líquido</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={pLume === 0 ? '' : pLume}
                                                            onChange={e => updatePercent(month, 'percentLume', e.target.value)}
                                                            placeholder="0"
                                                            className="w-14 text-right border border-indigo-300 rounded px-1 py-0.5 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                        />
                                                        <span className="text-gray-400 text-[10px]">%</span>
                                                        <span className="text-indigo-600 font-semibold ml-1">= {fmt((pLume / 100) * lucroLiquido)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-4 py-2.5 bg-indigo-600">
                                                <span className="text-indigo-100 text-xs font-semibold uppercase">Total LUME</span>
                                                <span className="text-white text-base font-bold">{fmt(lumeEcomm)}</span>
                                            </div>
                                        </div>

                                        {/* BUREAU E-Commerce */}
                                        <div className="bg-purple-50 rounded-xl border border-purple-200 overflow-hidden">
                                            <div className="bg-purple-600 px-4 py-2">
                                                <span className="text-white text-xs font-bold uppercase tracking-wide">BUREAU</span>
                                            </div>
                                            <div className="p-3 space-y-1.5 text-xs text-gray-500">
                                                <div className="flex justify-between"><span>Inev. Bureau</span><span className="text-gray-700 font-medium">{fmt(c.bureauRS)}</span></div>

                                                {/* % Lucro Líquido BUREAU */}
                                                <div className="flex justify-between items-center pt-1 border-t border-purple-100">
                                                    <span>+ % do Lucro Líquido</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={pBureau === 0 ? '' : pBureau}
                                                            onChange={e => updatePercent(month, 'percentBureau', e.target.value)}
                                                            placeholder="0"
                                                            className="w-14 text-right border border-purple-300 rounded px-1 py-0.5 text-xs font-bold text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                                        />
                                                        <span className="text-gray-400 text-[10px]">%</span>
                                                        <span className="text-purple-600 font-semibold ml-1">= {fmt((pBureau / 100) * lucroLiquido)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-4 py-2.5 bg-purple-600">
                                                <span className="text-purple-100 text-xs font-semibold uppercase">Total BUREAU</span>
                                                <span className="text-white text-base font-bold">{fmt(bureauEcomm)}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Parcerias;
