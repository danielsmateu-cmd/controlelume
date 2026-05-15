import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { api } from '../services/api';

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

const p = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let clean = String(v).replace(/[R$\s]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
};

const calcMaterials = (ft) => ft?.materials?.reduce((a, c) => a + p(c.value), 0) || 0;
const calcDirectCostsRS = (ft) => ft?.directCostsRS?.reduce((a, c) => a + p(c.value), 0) || 0;
const calcDirectCostsPerc = (ft, precoEfet) => {
    if (!ft) return 0;
    const percTotal = ft.directCostsPercent?.reduce((a, c) => a + p(c.percentage), 0) || 0;
    return (percTotal / 100) * (p(ft.salePrice) || precoEfet);
};

const StatCard = ({ title, value, type }) => {
    const isPositive = type === 'positive';
    const isNegative = type === 'negative';
    const isWarning = type === 'warning';

    let colorClass = "text-gray-600";
    if (isPositive) colorClass = "text-green-600";
    if (isNegative) colorClass = "text-red-600";
    if (isWarning) colorClass = "text-orange-500";

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">{title}</h3>
            <div className={`mt-1 text-2xl font-bold ${colorClass}`}>
                {value}
            </div>
        </div>
    );
};

const Resumo = ({ expenses, orders }) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    const [ftsData, setFtsData] = useState([]);
    const [vendasData, setVendasData] = useState({});
    const [custosData, setCustosData] = useState({});
    const [percentConfig, setPercentConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem('parcerias_percent_config')) || {}; }
        catch { return {}; }
    });

    useEffect(() => {
        const loadEcomData = async () => {
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
                
                try {
                    setPercentConfig(JSON.parse(localStorage.getItem('parcerias_percent_config')) || {});
                } catch (e) {}
            } catch (err) {
                console.error("Erro ao carregar ecom:", err);
            }
        };
        loadEcomData();
        
        const updateStorage = () => {
            try {
                setPercentConfig(JSON.parse(localStorage.getItem('parcerias_percent_config')) || {});
            } catch(e) {}
        };
        window.addEventListener('focus', updateStorage);
        return () => window.removeEventListener('focus', updateStorage);
    }, []);

    const getEcommTotalLume = (monthIndex, year) => {
        // No Parcerias, as vendas de um mês (ex: Abril, index 3) ficam registradas no mês seguinte (Maio, '05')
        let targetMonth = monthIndex + 2; 
        let targetYear = year;
        if (targetMonth > 12) {
            targetMonth -= 12;
            targetYear += 1;
        }
        const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        
        let totalFaturamento = 0, totalMateriais = 0, totalCustosDiretosRS = 0, totalCustosDiretosPerc = 0;
        const PLATFORMS_ID = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];

        PLATFORMS_ID.forEach(pid => {
            const key = `${pid}_${monthStr}`;
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

        const costData = custosData[monthStr];
        let lumeRS = 0, bureauRS = 0, custosExtrasRS = 0;

        if (costData) {
            const monthHours = getWorkHoursInMonth(monthStr);
            const empresas = costData.empresas || [];

            let custoHoraEmp1 = 0;
            if (empresas.length > 0) {
                const emp1 = empresas[0];
                const totalEmp1 = (emp1.expenses || []).reduce((a, c) => a + p(c.value), 0);
                const dispEmp1 = (emp1.productionFactor || 0) * monthHours;
                custoHoraEmp1 = dispEmp1 > 0 ? totalEmp1 / dispEmp1 : 0;
            }

            let rateioRestantesTotal = 0;
            if (empresas.length > 1) {
                empresas.forEach((emp, idx) => {
                    if (idx === 0) return;
                    const totalEmp = (emp.expenses || []).reduce((a, c) => a + p(c.value), 0);
                    const perc = emp.ecommerceShare || 0;
                    rateioRestantesTotal += totalEmp * (perc / 100);
                });
            }

            const adsArr = Array.isArray(costData?.ads) ? costData.ads : [];
            const extrasArr = Array.isArray(costData?.gastosExtras) ? costData.gastosExtras : [];
            custosExtrasRS = adsArr.reduce((a, c) => a + p(c.value), 0) +
                extrasArr.reduce((a, c) => a + p(c.value), 0);

            let horasTotaisConsumidas = 0;
            PLATFORMS_ID.forEach(pid => {
                const key = `${pid}_${monthStr}`;
                const vendas = Array.isArray(vendasData[key]) ? vendasData[key] : [];

                vendas.forEach(row => {
                    const ft = ftsData.find(f => f.id === row.ftId);
                    if (ft) {
                        const tempoMin = parseFloat(ft.productionTime) || 0;
                        const qty = parseInt(row.quantity) || 0;
                        horasTotaisConsumidas += (tempoMin / 60) * qty;
                    }
                });
            });

            lumeRS = horasTotaisConsumidas * custoHoraEmp1;
            bureauRS = rateioRestantesTotal;
        }

        const custoTotal = totalMateriais + totalCustosDiretosRS + totalCustosDiretosPerc + custosExtrasRS;
        const custoInevitavel = lumeRS + bureauRS;
        const lucroLiquido = totalFaturamento - custoTotal - custoInevitavel;

        const pLume = parseFloat(percentConfig[monthStr]?.percentLume) || 0;
        const lucroLiquidoPerc = (pLume / 100) * (parseFloat(lucroLiquido) || 0);
        const lumeEcomm = (parseFloat(lumeRS) || 0) + 
                          (parseFloat(custosExtrasRS) || 0) + 
                          (parseFloat(totalMateriais) || 0) + 
                          (parseFloat(totalCustosDiretosRS) || 0) + 
                          (parseFloat(totalCustosDiretosPerc) || 0) + 
                          lucroLiquidoPerc;
        
        return lumeEcomm || 0;
    };

    const getMonthlyData = (monthIndex, year) => {
        // INCOME
        const entradas = orders
            .filter(o => {
                const m = o.paymentDate ? new Date(o.paymentDate).getUTCMonth() : new Date(o.orderDate).getUTCMonth();
                const y = o.paymentDate ? new Date(o.paymentDate).getUTCFullYear() : new Date(o.orderDate).getUTCFullYear();
                return m === monthIndex && y === year && o.isPaid; // Apenas entradas pagas
            })
            .reduce((sum, o) => sum + o.value, 0);

        const entradasPendentes = orders
            .filter(o => {
                const m = o.paymentDate ? new Date(o.paymentDate).getUTCMonth() : new Date(o.orderDate).getUTCMonth();
                const y = o.paymentDate ? new Date(o.paymentDate).getUTCFullYear() : new Date(o.orderDate).getUTCFullYear();
                return m === monthIndex && y === year && !o.isPaid; // Apenas entradas não pagas
            })
            .reduce((sum, o) => sum + o.value, 0);

        // EXPENSES Breakdown
        const monthExpenses = expenses.filter(e => {
            if (e.type === 'fixos' || e.type === 'fixos_extra' || e.type === 'fornecedores') {
                return e.month === monthIndex && e.year === year;
            } else {
                if (!e.date) return false;
                const d = new Date(e.date + 'T00:00:00');
                return d.getUTCMonth() === monthIndex && d.getUTCFullYear() === year;
            }
        });

        const fixos = monthExpenses
            .filter(e => (e.type === 'fixos' || e.type === 'fixos_extra') && e.paid)
            .reduce((sum, e) => sum + e.amount, 0);

        const mercado = monthExpenses
            .filter(e => e.type === 'mercado' && e.paid !== false) // Any added before fix lacked 'paid'
            .reduce((sum, e) => sum + e.amount, 0);

        const fornecedores = monthExpenses
            .filter(e => e.type === 'fornecedores' && e.paid)
            .reduce((sum, e) => sum + e.amount, 0);

        const retirada = monthExpenses
            .filter(e => e.type === 'retirada' && e.paid !== false) // Any added before fix lacked 'paid'
            .reduce((sum, e) => sum + e.amount, 0);

        const saidasPendentes = monthExpenses
            .filter(e => e.paid === false)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalSaidas = fixos + mercado + fornecedores + retirada;
        const lumeEcomm = getEcommTotalLume(monthIndex, year);
        const saldo = entradas + lumeEcomm - totalSaidas;

        return { entradas, entradasPendentes, fixos, mercado, fornecedores, retirada, saidasPendentes, totalSaidas, saldo, lumeEcomm };
    };

    // Calcular totais anuais
    const annualTotals = months.reduce((acc, _, index) => {
        const data = getMonthlyData(index, selectedYear);
        acc.entradas += parseFloat(data.entradas) || 0;
        acc.entradasEcomm += parseFloat(data.lumeEcomm) || 0;
        acc.entradasPendentes += parseFloat(data.entradasPendentes) || 0;
        acc.totalSaidas += parseFloat(data.totalSaidas) || 0;
        acc.saidasPendentes += parseFloat(data.saidasPendentes) || 0;
        acc.saldo += parseFloat(data.saldo) || 0;
        return acc;
    }, { entradas: 0, entradasEcomm: 0, entradasPendentes: 0, totalSaidas: 0, saidasPendentes: 0, saldo: 0 });

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Resumo Financeiro</h2>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <StatCard
                    title={`Total Entradas (Pagas) - Ano ${selectedYear}`}
                    value={annualTotals.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="positive"
                />
                <StatCard
                    title={`Total E-Commerce - Ano ${selectedYear}`}
                    value={annualTotals.entradasEcomm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="positive"
                />
                <StatCard
                    title={`Entradas Pendentes - Ano ${selectedYear}`}
                    value={annualTotals.entradasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="warning"
                />
                <StatCard
                    title={`Total Saídas (Pagas) - Ano ${selectedYear}`}
                    value={annualTotals.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="negative"
                />
                <StatCard
                    title={`Saídas Pendentes - Ano ${selectedYear}`}
                    value={annualTotals.saidasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="warning"
                />
                <StatCard
                    title={`Saldo Geral - Ano ${selectedYear}`}
                    value={annualTotals.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type={annualTotals.saldo >= 0 ? "positive" : "negative"}
                />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Cálculo Mensal - Ano {selectedYear}</h3>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Relatório Consolidado</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4">Mês</th>
                                <th className="px-6 py-4 text-right text-green-600">Entradas (+)</th>
                                <th className="px-6 py-4 text-right text-indigo-600">Entrada E-Commerce</th>
                                <th className="px-6 py-4 text-right text-orange-500">Entradas Pendentes</th>
                                <th className="px-6 py-4 text-right">Fixo/Extra</th>
                                <th className="px-6 py-4 text-right">Extras (Avulso)</th>
                                <th className="px-6 py-4 text-right">Fornecedores</th>
                                <th className="px-6 py-4 text-right">Retirada</th>
                                <th className="px-6 py-4 text-right font-bold text-red-600 border-l border-gray-100 bg-red-50/10">Total Saídas (-)</th>
                                <th className="px-6 py-4 text-right font-bold text-orange-500 bg-orange-50/10">Saídas Pendentes</th>
                                <th className="px-6 py-4 text-right font-bold border-l border-gray-100">Saldo Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {months.map((monthName, index) => {
                                const data = getMonthlyData(index, selectedYear);
                                const isPositive = data.saldo >= 0;
                                const isCurrentMonth = index === new Date().getMonth() && selectedYear === new Date().getFullYear();

                                return (
                                    <tr key={monthName} className={clsx(
                                        "transition-colors",
                                        isCurrentMonth ? "bg-green-50 hover:bg-green-100" : "hover:bg-gray-50"
                                    )}>
                                        <td className={clsx(
                                            "px-6 py-4 font-semibold flex items-center gap-2",
                                            isCurrentMonth ? "text-indigo-700" : "text-gray-700"
                                        )}>
                                            {monthName}
                                            {isCurrentMonth && (
                                                <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded">
                                                    Mês Atual
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-green-600 font-medium">
                                            {data.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-indigo-600 font-medium">
                                            {data.lumeEcomm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-orange-500 font-medium">
                                            {data.entradasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {data.fixos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {data.mercado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {data.fornecedores.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {data.retirada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-red-600 border-l border-gray-100 bg-red-50/30">
                                            {data.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-orange-500 bg-orange-50/30">
                                            {data.saidasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className={clsx(
                                            "px-6 py-4 text-right font-bold border-l border-gray-100",
                                            isPositive ? "text-green-700 bg-green-50/30" : "text-red-700 bg-red-50/30"
                                        )}>
                                            {data.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Resumo;
