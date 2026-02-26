import React, { useState } from 'react';
import clsx from 'clsx';

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
        const fixos = expenses
            .filter(e => (e.type === 'fixos' || e.type === 'fixos_extra') && e.month === monthIndex && e.year === year)
            .reduce((sum, e) => sum + e.amount, 0);

        const mercado = expenses
            .filter(e => e.type === 'mercado' && new Date(e.date + 'T00:00:00').getUTCMonth() === monthIndex && new Date(e.date + 'T00:00:00').getUTCFullYear() === year)
            .reduce((sum, e) => sum + e.amount, 0);

        const fornecedores = expenses
            .filter(e => e.type === 'fornecedores' && e.month === monthIndex && e.year === year)
            .reduce((sum, e) => sum + e.amount, 0);

        const retirada = expenses
            .filter(e => e.type === 'retirada' && new Date(e.date + 'T00:00:00').getUTCMonth() === monthIndex && new Date(e.date + 'T00:00:00').getUTCFullYear() === year)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalSaidas = fixos + mercado + fornecedores + retirada;
        const saldo = entradas - totalSaidas;

        return { entradas, entradasPendentes, fixos, mercado, fornecedores, retirada, totalSaidas, saldo };
    };

    // Calcular totais anuais
    const annualTotals = months.reduce((acc, _, index) => {
        const data = getMonthlyData(index, selectedYear);
        acc.entradas += data.entradas;
        acc.entradasPendentes += data.entradasPendentes;
        acc.totalSaidas += data.totalSaidas;
        acc.saldo += data.saldo;
        return acc;
    }, { entradas: 0, entradasPendentes: 0, totalSaidas: 0, saldo: 0 });

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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard
                    title={`Total Entradas (Pagas) - Ano ${selectedYear}`}
                    value={annualTotals.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="positive"
                />
                <StatCard
                    title={`Entradas Pendentes - Ano ${selectedYear}`}
                    value={annualTotals.entradasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="warning"
                />
                <StatCard
                    title={`Total Saídas - Ano ${selectedYear}`}
                    value={annualTotals.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    type="negative"
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
                                <th className="px-6 py-4 text-right text-orange-500">Entradas Pendentes</th>
                                <th className="px-6 py-4 text-right">Fixo/Extra</th>
                                <th className="px-6 py-4 text-right">Mercado</th>
                                <th className="px-6 py-4 text-right">Fornecedores</th>
                                <th className="px-6 py-4 text-right">Retirada</th>
                                <th className="px-6 py-4 text-right font-bold text-red-600 border-l border-gray-100 bg-red-50/10">Total Saídas (-)</th>
                                <th className="px-6 py-4 text-right font-bold border-l border-gray-100">Saldo Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {months.map((monthName, index) => {
                                const data = getMonthlyData(index, selectedYear);
                                const isPositive = data.saldo >= 0;

                                return (
                                    <tr key={monthName} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-700">{monthName}</td>
                                        <td className="px-6 py-4 text-right text-green-600 font-medium">
                                            {data.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
