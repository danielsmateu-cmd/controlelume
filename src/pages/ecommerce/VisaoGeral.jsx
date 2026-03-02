import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react';

const VisaoGeral = () => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
        return `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    });

    const [vendasData, setVendasData] = useState({});
    const [custosData, setCustosData] = useState({});

    // Carregar dados de vendas e custos
    useEffect(() => {
        const loadDados = () => {
            const savedVendas = localStorage.getItem('ecommerce_vendas_mensal');
            const savedCustos = localStorage.getItem('ecommerce_empresas_custos_mensal');

            if (savedVendas) setVendasData(JSON.parse(savedVendas));
            if (savedCustos) setCustosData(JSON.parse(savedCustos));
        };

        loadDados();
        window.addEventListener('storage', loadDados);
        return () => window.removeEventListener('storage', loadDados);
    }, []);

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

        return totalEmpresa1 + totalEmpresa2 + totalPercentRS + totalFixedRS;
    };

    // Função para calcular resumo do mês
    const getMonthSummary = (month) => {
        const vendas = Array.isArray(vendasData[month]) ? vendasData[month] : [];

        let faturamento = 0;
        let custoTotalProdutos = 0;
        let margemSum = 0;
        let qtdComMargem = 0;

        vendas.forEach(venda => {
            const qtd = parseFloat(venda.qtd) || 0;
            const preco = parseFloat(venda.preco) || 0;
            const custoUnitario = parseFloat(venda.custoUnitario) || 0;

            faturamento += qtd * preco;
            custoTotalProdutos += qtd * custoUnitario;

            if (qtd > 0) {
                const lucro = (preco - custoUnitario) * qtd;
                const faturamentoItem = preco * qtd;
                const margemPerc = faturamentoItem > 0 ? (lucro / faturamentoItem) * 100 : 0;
                margemSum += margemPerc;
                qtdComMargem++;
            }
        });

        const margemMedia = qtdComMargem > 0 ? margemSum / qtdComMargem : 0;
        const custoInevitavel = getCustoInevitalel(month);
        const pontoEquilibrio = faturamento - custoTotalProdutos - custoInevitavel;

        return {
            faturamento,
            custoTotalProdutos,
            custoInevitavel,
            pontoEquilibrio,
            margemMedia
        };
    };

    // Resumo do Ano
    const yearSummary = months.reduce((acc, month) => {
        const summ = getMonthSummary(month);
        acc.faturamento += summ.faturamento;
        acc.custoInevitavel += summ.custoInevitavel;
        acc.pontoEquilibrio += summ.pontoEquilibrio;
        if (summ.faturamento > 0) {
            acc.margemSum += summ.margemMedia;
            acc.mesesComVenda++;
        }
        return acc;
    }, { faturamento: 0, custoInevitavel: 0, pontoEquilibrio: 0, margemSum: 0, mesesComVenda: 0 });

    const margemMediaAno = yearSummary.mesesComVenda > 0 ? yearSummary.margemSum / yearSummary.mesesComVenda : 0;

    // Ordered months: Current active month first, then the rest of the year sequentially
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const orderedMonths = [currentMonthStr, ...months.filter(m => m !== currentMonthStr)];

    const formatCurrency = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatPercent = (val) => `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    const formatMonthName = (monthStr) => {
        const date = new Date(monthStr + '-01T00:00:00');
        return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
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

            {/* RESUMO DO ANO */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                    <Activity className="w-48 h-48" />
                </div>
                <h3 className="text-lg font-bold mb-4 opacity-90 uppercase tracking-wider">Resumo do Ano ({currentYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    <div>
                        <div className="text-indigo-200 text-sm font-semibold mb-1 uppercase">Faturamento Anual</div>
                        <div className="text-3xl font-bold">{formatCurrency(yearSummary.faturamento)}</div>
                    </div>
                    <div>
                        <div className="text-indigo-200 text-sm font-semibold mb-1 uppercase">Custos Inevitáveis</div>
                        <div className="text-3xl font-bold text-red-300">{formatCurrency(yearSummary.custoInevitavel)}</div>
                    </div>
                    <div>
                        <div className="text-indigo-200 text-sm font-semibold mb-1 uppercase">Resultado Líquido (Equilíbrio)</div>
                        <div className={clsx("text-3xl font-bold", yearSummary.pontoEquilibrio >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatCurrency(yearSummary.pontoEquilibrio)}
                        </div>
                    </div>
                    <div>
                        <div className="text-indigo-200 text-sm font-semibold mb-1 uppercase">Margem Média</div>
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
                        <div key={month} className={clsx("bg-white rounded-xl shadow-sm border overflow-hidden", isCurrent ? "border-indigo-300 ring-4 ring-indigo-50" : "border-gray-200")}>

                            {/* Cabeçalho do Mês */}
                            <div className={clsx("p-4 border-b flex justify-between items-center", isCurrent ? "bg-indigo-50 border-indigo-100" : "bg-gray-50 border-gray-100")}>
                                <div className="flex items-center gap-3">
                                    {isCurrent && <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] uppercase font-bold rounded">Mês Atual</span>}
                                    <h4 className={clsx("font-bold text-lg", isCurrent ? "text-indigo-900" : "text-gray-700")}>{formatMonthName(month)}</h4>
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

                                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                        <div className="flex items-center gap-2 text-red-500 mb-2">
                                            <Building2 size={16} />
                                            <span className="text-xs font-bold uppercase">Custo Inevitável</span>
                                        </div>
                                        <div className="text-xl font-bold text-red-700">{formatCurrency(sum.custoInevitavel)}</div>
                                    </div>

                                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 col-span-2">
                                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                                            <DollarSign size={16} />
                                            <span className="text-xs font-bold uppercase">Faturamento (Total Vendas)</span>
                                        </div>
                                        <div className="text-2xl font-bold text-emerald-700">{formatCurrency(sum.faturamento)}</div>
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
