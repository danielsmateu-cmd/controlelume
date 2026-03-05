import React, { useState, useEffect } from 'react';
import { BarChart3, Activity, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';

const PLATFORMS = [
    { id: 'meli', label: 'Mercado Livre', emoji: '🛒', headerBg: 'bg-yellow-400', headerText: 'text-yellow-900', rowBg: 'bg-yellow-50', border: 'border-yellow-200' },
    { id: 'shopee', label: 'Shopee', emoji: '🧡', headerBg: 'bg-orange-500', headerText: 'text-white', rowBg: 'bg-orange-50', border: 'border-orange-200' },
    { id: 'tiktok', label: 'TikTok', emoji: '🎵', headerBg: 'bg-gray-800', headerText: 'text-white', rowBg: 'bg-gray-50', border: 'border-gray-200' },
    { id: 'amazon', label: 'Amazon', emoji: '📦', headerBg: 'bg-amber-500', headerText: 'text-white', rowBg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'site', label: 'Site', emoji: '🌐', headerBg: 'bg-indigo-600', headerText: 'text-white', rowBg: 'bg-indigo-50', border: 'border-indigo-200' },
];

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

const VisaoGeral = () => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) =>
        `${currentYear}-${String(i + 1).padStart(2, '0')}`
    );
    const p = (v) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        const clean = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const [vendasData, setVendasData] = useState({});
    const [custosData, setCustosData] = useState({});
    const [ftsData, setFtsData] = useState([]);
    const [mktFtsData, setMktFtsData] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const fts = await api.getFts();
                setFtsData(fts);

                const mktFts = {};
                PLATFORMS.forEach(p => {
                    const raw = localStorage.getItem(`fts_mkt_${p.id}`);
                    mktFts[p.id] = raw ? JSON.parse(raw) : fts;
                });
                setMktFtsData(mktFts);

                let dbSales = await api.getMonthlySales();
                const localSales = localStorage.getItem('ecommerce_vendas');
                if (localSales && Object.keys(dbSales).length === 0) dbSales = JSON.parse(localSales);
                setVendasData(dbSales);

                let dbCosts = await api.getMonthlyCosts();
                const localCosts = localStorage.getItem('ecommerce_empresas_custos_mensal');
                if (localCosts && Object.keys(dbCosts).length === 0) dbCosts = JSON.parse(localCosts);
                setCustosData(dbCosts);
            } catch (err) {
                console.error('Erro ao carregar Visão Geral:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
        window.addEventListener('focus', load);
        return () => window.removeEventListener('focus', load);
    }, []);

    // Breakdown detalhado por marketplace / mês
    const getMktDetail = (platformId, month) => {
        const key = `${platformId}_${month}`;
        const vendas = Array.isArray(vendasData[key]) ? vendasData[key] : [];
        const fts = mktFtsData[platformId] || ftsData;

        let faturamento = 0, itens = 0, horasConsumidas = 0;
        let custoMateriais = 0, custosDiretosRS = 0, custosDiretosPerc = 0;

        vendas.forEach(row => {
            const ft = fts.find(f => f.id === row.ftId);
            if (!ft) return;
            const qtd = parseInt(row.quantity) || 0;
            const precoBase = p(ft.salePrice);
            const desconto = p(row.discountPercent);
            const precoEfet = precoBase * (1 - desconto / 100);

            const mat = (ft.materials || []).reduce((a, c) => a + p(c.value), 0);
            const dir = (ft.directCostsRS || []).reduce((a, c) => a + p(c.value), 0);
            const pct = (ft.directCostsPercent || []).reduce((a, c) => a + (p(c.percentage) / 100 * precoBase), 0);

            const tempoMin = parseFloat(ft.productionTime) || 0;
            horasConsumidas += (tempoMin / 60) * qtd;

            itens += qtd;
            faturamento += precoEfet * qtd;
            custoMateriais += mat * qtd;
            custosDiretosRS += dir * qtd;
            custosDiretosPerc += pct * qtd;
        });

        // Ads + Extras deste marketplace no mês
        const costData = custosData[month];
        const adsArr = Array.isArray(costData?.ads) ? costData.ads : [];
        const extrasArr = Array.isArray(costData?.gastosExtras) ? costData.gastosExtras : [];

        // Soma os ads cujo marketplace é este (ou 'geral')
        const adsExtras =
            adsArr.filter(a => a.marketplace === platformId || a.marketplace === 'geral')
                .reduce((a, c) => a + p(c.value), 0)
            + extrasArr.filter(e => e.marketplace === platformId || e.marketplace === 'geral')
                .reduce((a, c) => a + p(c.value), 0);

        const totalCustosDiretos = custosDiretosRS + custosDiretosPerc;
        return { faturamento, itens, custoMateriais, totalCustosDiretos, adsExtras, horasConsumidas, custoInevShare: 0 }; // Placeholder para evitar erro no return
    };

    // Helper para retornar a tabela enriquecida do mês com Custo Inevitável calculado por tempo/rateio
    const getMonthDetails = (month) => {
        const costData = custosData[month];
        const empresas = costData?.empresas || [];
        const monthHours = getWorkHoursInMonth(month);

        let custoHoraEmp1 = 0;
        if (empresas.length > 0) {
            const emp1 = empresas[0]; // Empresa 1 (Lume)
            const totalEmp1 = (emp1.expenses || []).reduce((a, c) => a + p(c.value), 0);
            const dispEmp1 = (emp1.productionFactor || 0) * monthHours;
            custoHoraEmp1 = dispEmp1 > 0 ? totalEmp1 / dispEmp1 : 0;
        }

        // Tudo que não é a Empresa 0 (Lume) entra no grupo de Rateio/Bureau
        let rateioRestantesPorMkt = 0;
        if (empresas.length > 1 && PLATFORMS.length > 0) {
            empresas.forEach((emp, idx) => {
                if (idx === 0) return;
                const totalEmp = (emp.expenses || []).reduce((a, c) => a + p(c.value), 0);
                const percentualRepasse = emp.ecommerceShare || 0;
                const valorIrParaEcommerce = totalEmp * (percentualRepasse / 100);
                rateioRestantesPorMkt += valorIrParaEcommerce / PLATFORMS.length;
            });
        }

        return PLATFORMS.map(pObj => {
            const d = getMktDetail(pObj.id, month);
            const custoInevLume = d.horasConsumidas * custoHoraEmp1;
            const custoInevBureau = rateioRestantesPorMkt;
            const totalCustosDiretos = d.totalCustosDiretos;
            const custoInevShare = custoInevLume + custoInevBureau;
            const lucroLiquido = d.faturamento - d.custoMateriais - totalCustosDiretos - d.adsExtras - custoInevShare;
            return { ...pObj, ...d, totalCustosDiretos, custoInevLume, custoInevBureau, custoInevShare, lucroLiquido };
        });
    };

    const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtN = (v) => v > 0 ? fmt(v) : '—';

    const formatMonthName = (monthStr) => {
        const [yearStr, monthStrPart] = monthStr.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStrPart);
        const name = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
        const prev = new Date(year, month - 2);
        const prevM = String(prev.getMonth() + 1).padStart(2, '0');
        const last = new Date(year, month - 1, 0).getDate();
        return `${name} DE ${year} — VENDAS DE 01/${prevM} A ${last}/${prevM}`;
    };

    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const orderedMonths = [currentMonthStr, ...months.filter(m => m !== currentMonthStr)];

    // Totais do ano
    const yearTotals = months.reduce((acc, month) => {
        const rows = getMonthDetails(month);
        let fatMes = 0, custosMes = 0, adsExtrasMes = 0, inevMes = 0;
        rows.forEach(r => {
            fatMes += r.faturamento;
            custosMes += r.custoMateriais + r.totalCustosDiretos;
            adsExtrasMes += r.adsExtras;
            inevMes += r.custoInevShare;
        });
        acc.faturamento += fatMes;
        acc.custoInev += inevMes;
        acc.lucroLiquido += fatMes - custosMes - adsExtrasMes - inevMes;
        return acc;
    }, { faturamento: 0, custoInev: 0, lucroLiquido: 0 });

    // Colunas da tabela
    const COLS = [
        { key: 'platform', label: 'Marketplace', align: 'left' },
        { key: 'faturamento', label: 'Faturamento', align: 'right' },
        { key: 'itens', label: 'Qtd Vendas', align: 'right' },
        { key: 'custoMateriais', label: 'Custo Mater.', align: 'right' },
        { key: 'totalCustosDiretos', label: 'C. Diretos', align: 'right' },
        { key: 'adsExtras', label: 'Ads+Extras', align: 'right' },
        { key: 'custoInevLume', label: 'Inev. Lume', align: 'right' },
        { key: 'custoInevBureau', label: 'Inev. Bureau', align: 'right' },
        { key: 'lucroLiquido', label: 'Lucro Líquido', align: 'right' },
    ];

    return (
        <div className="space-y-6">
            {/* Título */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-indigo-600" />
                        Visão Geral e Ponto de Equilíbrio
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Acompanhamento de faturamento, custos e margens de {currentYear}.</p>
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="ml-2 text-indigo-600 font-medium">Carregando dados...</span>
                </div>
            )}

            {/* Resumo do Ano */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 text-white shadow-md overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-5">
                    <Activity className="w-48 h-48" />
                </div>
                <h3 className="text-lg font-bold mb-4 uppercase tracking-wider text-slate-300">Resumo do Ano ({currentYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    <div>
                        <div className="text-slate-400 text-xs font-bold mb-1 uppercase">Faturamento Anual</div>
                        <div className="text-3xl font-bold">{fmt(yearTotals.faturamento)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs font-bold mb-1 uppercase">Custo Inevitável Anual</div>
                        <div className="text-3xl font-bold text-orange-300">{fmt(yearTotals.custoInev)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs font-bold mb-1 uppercase">Lucro Líquido</div>
                        <div className={clsx('text-3xl font-bold', yearTotals.lucroLiquido >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {fmt(yearTotals.lucroLiquido)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Meses */}
            <div className="space-y-8">
                {orderedMonths.map((month) => {
                    const isCurrent = month === currentMonthStr;
                    const rows = getMonthDetails(month);

                    // Totais da linha de rodapé
                    const totals = rows.reduce((a, r) => ({
                        faturamento: a.faturamento + r.faturamento,
                        itens: a.itens + r.itens,
                        custoMateriais: a.custoMateriais + r.custoMateriais,
                        totalCustosDiretos: a.totalCustosDiretos + r.totalCustosDiretos,
                        adsExtras: a.adsExtras + r.adsExtras,
                        custoInevLume: a.custoInevLume + r.custoInevLume,
                        custoInevBureau: a.custoInevBureau + r.custoInevBureau,
                        custoInevShare: a.custoInevShare + r.custoInevShare,
                        lucroLiquido: a.lucroLiquido + r.lucroLiquido,
                    }), { faturamento: 0, itens: 0, custoMateriais: 0, totalCustosDiretos: 0, adsExtras: 0, custoInevLume: 0, custoInevBureau: 0, custoInevShare: 0, lucroLiquido: 0 });

                    return (
                        <div key={month} className={clsx('bg-white rounded-xl overflow-hidden', isCurrent ? 'border-2 border-indigo-500 ring-4 ring-indigo-100 shadow-xl' : 'border border-gray-200 shadow-sm')}>

                            {/* Cabeçalho */}
                            <div className={clsx('p-4 border-b flex items-center gap-3', isCurrent ? 'bg-indigo-600 border-indigo-700' : 'bg-gray-50 border-gray-100')}>
                                {isCurrent && <span className="px-2 py-0.5 bg-yellow-400 text-indigo-900 text-[10px] uppercase font-bold rounded">Mês Atual</span>}
                                <h4 className={clsx('font-bold text-base', isCurrent ? 'text-white' : 'text-gray-700')}>{formatMonthName(month)}</h4>
                            </div>

                            {/* Tabela */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    {/* Cabeçalho colunas */}
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            {COLS.map(col => (
                                                <th key={col.key} className={clsx('px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap', col.align === 'right' ? 'text-right' : 'text-left')}>
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {rows.map(r => {
                                            const hasData = r.faturamento > 0 || r.custoInevShare > 0 || r.adsExtras > 0;
                                            return (
                                                <tr key={r.id} className={clsx('transition-colors', r.rowBg, hasData ? 'opacity-100' : 'opacity-50')}>
                                                    {/* Nome */}
                                                    <td className={clsx('px-4 py-3 font-bold border-l-4', r.border)}>
                                                        <span className="mr-1.5">{r.emoji}</span>
                                                        <span>{r.label}</span>
                                                    </td>
                                                    {/* Faturamento */}
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtN(r.faturamento)}</td>
                                                    {/* Qtd */}
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{r.itens > 0 ? r.itens : '—'}</td>
                                                    {/* Custo Materiais */}
                                                    <td className="px-4 py-3 text-right text-orange-600">{fmtN(r.custoMateriais)}</td>
                                                    {/* Total Custos Diretos */}
                                                    <td className="px-4 py-3 text-right text-orange-500">{fmtN(r.totalCustosDiretos)}</td>
                                                    {/* Ads+Extras */}
                                                    <td className="px-4 py-3 text-right text-purple-500 font-medium">{fmtN(r.adsExtras)}</td>
                                                    {/* Custo Inev Lume */}
                                                    <td className="px-4 py-3 text-right text-red-400">{fmtN(r.custoInevLume)}</td>
                                                    {/* Custo Inev Bureau */}
                                                    <td className="px-4 py-3 text-right text-red-500">{fmtN(r.custoInevBureau)}</td>
                                                    {/* Lucro Líquido */}
                                                    <td className={clsx('px-4 py-3 text-right font-bold', r.lucroLiquido >= 0 && (r.faturamento > 0 || hasData) ? 'text-emerald-600' : (r.lucroLiquido < 0 ? 'text-red-600' : 'text-gray-400'))}>
                                                        {(r.faturamento > 0 || r.custoInevShare > 0 || r.adsExtras > 0) ? fmt(r.lucroLiquido) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>

                                    {/* Rodapé — Totais */}
                                    <tfoot>
                                        <tr className="bg-indigo-600 text-white font-bold border-t-2 border-indigo-700">
                                            <td className="px-4 py-3 uppercase text-xs tracking-wide">Total do Mês</td>
                                            <td className="px-4 py-3 text-right">{fmtN(totals.faturamento)}</td>
                                            <td className="px-4 py-3 text-right">{totals.itens > 0 ? totals.itens : '—'}</td>
                                            <td className="px-4 py-3 text-right text-orange-200">{fmtN(totals.custoMateriais)}</td>
                                            <td className="px-4 py-3 text-right text-orange-200">{fmtN(totals.totalCustosDiretos)}</td>
                                            <td className="px-4 py-3 text-right text-purple-200">{fmtN(totals.adsExtras)}</td>
                                            <td className="px-4 py-3 text-right text-red-200">{fmtN(totals.custoInevLume)}</td>
                                            <td className="px-4 py-3 text-right text-red-200">{fmtN(totals.custoInevBureau)}</td>
                                            <td className={clsx('px-4 py-3 text-right text-base', totals.lucroLiquido >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                                                {fmt(totals.lucroLiquido)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VisaoGeral;
