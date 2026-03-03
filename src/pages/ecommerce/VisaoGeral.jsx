import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Activity, Building2, ShoppingCart, Wallet, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';

const VisaoGeral = () => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
        return `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    });

    const [vendasData, setVendasData] = useState({});
    const [custosData, setCustosData] = useState({});

    const [ftsData, setFtsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Carregar dados de vendas, custos e fts
    useEffect(() => {
        const loadDados = async () => {
            setIsLoading(true);
            try {
                // Buscar FTs da API (Supabase)
                const fts = await api.getFts();
                setFtsData(fts);

                let dbSales = await api.getMonthlySales();
                const savedVendas = localStorage.getItem('ecommerce_vendas');
                if (savedVendas && Object.keys(dbSales).length === 0) {
                    dbSales = JSON.parse(savedVendas);
                }
                setVendasData(dbSales);

                let dbCosts = await api.getMonthlyCosts();
                const savedCustos = localStorage.getItem('ecommerce_empresas_custos_mensal');
                if (savedCustos && Object.keys(dbCosts).length === 0) {
                    dbCosts = JSON.parse(savedCustos);
                }
                setCustosData(dbCosts);
            } catch (error) {
                console.error("Erro ao carregar dados na Visão Geral:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDados();
        // Nota: storage manager local não detectaria mudanças no db, 
        // idealmente usariamos realtime do supabase aqui, mas pra simplificar vamos recarregar ao focar na janela.
        window.addEventListener('focus', loadDados);
        return () => window.removeEventListener('focus', loadDados);
    }, []);

    // Função auxiliar para calcular custo da FT
    const calculateCost = (ft) => {
        if (!ft) return 0;
        const totalMat = ft.materials?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
        const totalDir = ft.directCostsRS?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
        const totalPerc = ft.directCostsPercent?.reduce((acc, curr) => {
            return acc + (((parseFloat(curr.percentage) || 0) / 100) * (parseFloat(ft.salePrice) || 0));
        }, 0) || 0;
        return totalMat + totalDir + totalPerc;
    };

    // Função para calcular os totais de custo inevitável do mês
    const getCustoInevitalel = (month) => {
        const data = custosData[month];
        if (!data) return 0;

        const expenses1 = data.empresa1?.expenses || [];
        const totalEmpresa1 = expenses1.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;

        const expenses2 = data.empresa2?.expenses || [];
        const totalEmpresa2 = expenses2.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;

        let percentCalcEmpresa1 = 0;
        let percentCalcEmpresa2 = 0;
        const percents = data.somatoria?.percent || [];
        percents.forEach(p => {
            const perc = parseFloat(p.percent) || 0;
            percentCalcEmpresa1 += totalEmpresa1 * (perc / 100);
            percentCalcEmpresa2 += totalEmpresa2 * (perc / 100);
        });

        const totalPercentRS = percentCalcEmpresa1 + percentCalcEmpresa2;
        const fixedRs = data.somatoria?.fixedRS || [];
        const totalFixedRS = fixedRs.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;

        return totalPercentRS + totalFixedRS;
    };

    // Função para calcular resumo do mês
    const getMonthSummary = (month) => {
        const vendas = Array.isArray(vendasData[month]) ? vendasData[month] : [];

        let faturamento = 0;
        let custoTotalProdutos = 0;
        let qtdItensVendidos = 0;

        vendas.forEach(row => {
            const ft = ftsData.find(f => f.id === row.ftId);
            if (ft) {
                const qtd = parseInt(row.quantity) || 0;
                qtdItensVendidos += qtd;

                const precoBase = parseFloat(ft.salePrice) || 0;
                const desconto = parseFloat(row.discountPercent) || 0;
                const precoEfetivo = precoBase * (1 - desconto / 100);

                const custoUnitario = calculateCost(ft);

                faturamento += precoEfetivo * qtd;
                custoTotalProdutos += custoUnitario * qtd;
            }
        });

        const lucroBruto = faturamento - custoTotalProdutos;
        const margemMedia = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
        const custoInevitavel = getCustoInevitalel(month);
        const pontoEquilibrio = lucroBruto - custoInevitavel;

        return {
            faturamento,
            custoTotalProdutos,
            custoInevitavel,
            lucroLiquido: pontoEquilibrio, // lucro = faturamento - custo produto - custo inevitavel
            margemMedia,
            qtdItensVendidos,
            lucroBruto
        };
    };

    // Resumo do Ano
    const yearSummary = months.reduce((acc, month) => {
        const summ = getMonthSummary(month);
        acc.faturamento += summ.faturamento;
        acc.custoInevitavel += summ.custoInevitavel;
        acc.lucroLiquido += summ.lucroLiquido;
        if (summ.faturamento > 0) {
            acc.margemSum += summ.margemMedia;
            acc.mesesComVenda++;
        }
        return acc;
    }, { faturamento: 0, custoInevitavel: 0, lucroLiquido: 0, margemSum: 0, mesesComVenda: 0 });

    const margemMediaAno = yearSummary.mesesComVenda > 0 ? yearSummary.margemSum / yearSummary.mesesComVenda : 0;

    // Ordered months: Current active month first, then the rest of the year sequentially
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const orderedMonths = [currentMonthStr, ...months.filter(m => m !== currentMonthStr)];

    const formatCurrency = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatPercent = (val) => `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [yearStr, monthStrPart] = monthStr.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStrPart);

        const date = new Date(year, month - 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();

        const prevDate = new Date(year, month - 2);
        const prevMonthNum = String(prevDate.getMonth() + 1).padStart(2, '0');
        const currMonthNum = String(date.getMonth() + 1).padStart(2, '0');

        return `${monthName} DE ${year} - VENDAS DE 06/${prevMonthNum} A 06/${currMonthNum}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
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

            {/* RESUMO DO ANO */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 text-white shadow-md overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-5">
                    <Activity className="w-48 h-48" />
                </div>
                <h3 className="text-lg font-bold mb-4 opacity-90 uppercase tracking-wider text-slate-200">Resumo do Ano ({currentYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    <div>
                        <div className="text-slate-400 text-sm font-semibold mb-1 uppercase">Faturamento Anual</div>
                        <div className="text-3xl font-bold">{formatCurrency(yearSummary.faturamento)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-sm font-semibold mb-1 uppercase">Custos Inevitáveis</div>
                        <div className="text-3xl font-bold text-red-300">{formatCurrency(yearSummary.custoInevitavel)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-sm font-semibold mb-1 uppercase">Resultado Líquido (Equilíbrio)</div>
                        <div className={clsx("text-3xl font-bold", yearSummary.pontoEquilibrio >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatCurrency(yearSummary.pontoEquilibrio)}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-sm font-semibold mb-1 uppercase">Margem Média</div>
                        <div className="text-3xl font-bold text-blue-300">{formatPercent(margemMediaAno)}</div>
                    </div>
                </div>
            </div>

            {/* LISTA DE MESES */}
            <div className="space-y-8">
                {orderedMonths.map((month, index) => {
                    const sum = getMonthSummary(month);
                    const isCurrent = month === currentMonthStr;

                    return (
                        <div key={month} className={clsx("bg-white rounded-xl overflow-hidden", isCurrent ? "border-2 border-indigo-500 ring-4 ring-indigo-100 shadow-xl shadow-indigo-100/50 transform scale-[1.01] transition-all" : "border border-gray-200 shadow-sm")}>

                            {/* Cabeçalho do Mês */}
                            <div className={clsx("p-4 border-b flex justify-between items-center", isCurrent ? "bg-indigo-600 border-indigo-700" : "bg-gray-50 border-gray-100")}>
                                <div className="flex items-center gap-3">
                                    {isCurrent && <span className="px-2 py-0.5 bg-yellow-400 text-indigo-900 text-[10px] uppercase font-bold rounded shadow-sm">Mês Atual</span>}
                                    <h4 className={clsx("font-bold text-lg", isCurrent ? "text-white tracking-wide" : "text-gray-700")}>{formatMonthName(month)}</h4>
                                </div>
                            </div>

                            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* KPIs Principais */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                                            <TrendingUp size={16} />
                                            <span className="text-xs font-bold uppercase">Margem de Contribuição</span>
                                        </div>
                                        <div className="text-xl font-bold text-gray-800">{formatPercent(sum.margemMedia)}</div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <div className="flex items-center gap-2 text-blue-500 mb-2">
                                            <ShoppingCart size={16} />
                                            <span className="text-xs font-bold uppercase">Itens Vendidos</span>
                                        </div>
                                        <div className="text-xl font-bold text-blue-800">{sum.qtdItensVendidos} un</div>
                                    </div>

                                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                                            <Wallet size={16} />
                                            <span className="text-xs font-bold uppercase">Lucro</span>
                                        </div>
                                        <div className="text-xl font-bold text-emerald-700">{formatCurrency(sum.lucroBruto)}</div>
                                    </div>

                                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                            <DollarSign size={16} />
                                            <span className="text-xs font-bold uppercase">Faturamento Total</span>
                                        </div>
                                        <div className="text-xl font-bold text-indigo-700">{formatCurrency(sum.faturamento)}</div>
                                    </div>
                                </div>

                                {/* Ponto de Equilíbrio / Conta Simples */}
                                <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100 flex flex-col justify-between">
                                    <div className="mb-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <h5 className="text-sm font-bold text-gray-700 uppercase">Demonstrativo Simplificado</h5>
                                        </div>
                                        <div className="space-y-2 text-sm font-medium">
                                            <div className="flex justify-between text-gray-600">
                                                <span>(+) Faturamento</span>
                                                <span className="text-emerald-600">{formatCurrency(sum.faturamento)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600">
                                                <span>(-) Custo Total dos Produtos</span>
                                                <span className="text-red-500">{formatCurrency(sum.custoTotalProdutos)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600 border-b border-blue-200 pb-2">
                                                <span>(-) Custo Inevitável</span>
                                                <span className="text-red-500">{formatCurrency(sum.custoInevitavel)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg font-bold pt-2">
                                                <span className="text-gray-800">(=) Ponto de Equilíbrio</span>
                                                <span className={sum.pontoEquilibrio >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                    {formatCurrency(sum.pontoEquilibrio)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {sum.pontoEquilibrio < 0 && (
                                        <div className="text-xs text-red-600 bg-red-100 p-2 rounded text-center font-semibold">
                                            ⚠️ O resultado do mês está negativo.
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default VisaoGeral;
