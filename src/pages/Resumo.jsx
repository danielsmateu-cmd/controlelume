import React, { useState } from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Clock, BarChart2 } from 'lucide-react';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const StatCard = ({ title, value, type, icon: Icon }) => {
    const styles = {
        positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', muted: 'text-emerald-500' },
        negative: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', muted: 'text-red-400' },
        warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', muted: 'text-amber-500' },
        neutral: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', muted: 'text-slate-500' },
    };
    const s = styles[type] || styles.neutral;

    return (
        <div className={clsx("rounded-xl border p-5 flex flex-col gap-3", s.bg, s.border)}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
                {Icon && <Icon size={16} className={s.muted} />}
            </div>
            <p className={clsx("text-2xl font-black mono-num", s.text)}>{value}</p>
        </div>
    );
};

const Resumo = ({ expenses, orders }) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const years = Array.from({ length: 13 }, (_, i) => 2024 + i);

    const getMonthlyData = (monthIndex, year) => {
        const entradas = orders
            .filter(o => {
                const m = o.paymentDate ? new Date(o.paymentDate).getUTCMonth() : new Date(o.orderDate).getUTCMonth();
                const y = o.paymentDate ? new Date(o.paymentDate).getUTCFullYear() : new Date(o.orderDate).getUTCFullYear();
                return m === monthIndex && y === year && o.isPaid;
            })
            .reduce((sum, o) => sum + o.value, 0);

        const entradasPendentes = orders
            .filter(o => {
                const m = o.paymentDate ? new Date(o.paymentDate).getUTCMonth() : new Date(o.orderDate).getUTCMonth();
                const y = o.paymentDate ? new Date(o.paymentDate).getUTCFullYear() : new Date(o.orderDate).getUTCFullYear();
                return m === monthIndex && y === year && !o.isPaid;
            })
            .reduce((sum, o) => sum + o.value, 0);

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

    const annualTotals = months.reduce((acc, _, index) => {
        const data = getMonthlyData(index, selectedYear);
        acc.entradas += data.entradas;
        acc.entradasPendentes += data.entradasPendentes;
        acc.totalSaidas += data.totalSaidas;
        acc.saldo += data.saldo;
        return acc;
    }, { entradas: 0, entradasPendentes: 0, totalSaidas: 0, saldo: 0 });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart2 size={20} className="text-indigo-500" />
                        Resumo Financeiro
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">Visão consolidada do ano</p>
                </div>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title={`Entradas Pagas · ${selectedYear}`} value={fmt(annualTotals.entradas)} type="positive" icon={TrendingUp} />
                <StatCard title={`Entradas Pendentes · ${selectedYear}`} value={fmt(annualTotals.entradasPendentes)} type="warning" icon={Clock} />
                <StatCard title={`Total Saídas · ${selectedYear}`} value={fmt(annualTotals.totalSaidas)} type="negative" icon={TrendingDown} />
                <StatCard
                    title={`Saldo Geral · ${selectedYear}`}
                    value={fmt(annualTotals.saldo)}
                    type={annualTotals.saldo >= 0 ? 'positive' : 'negative'}
                    icon={annualTotals.saldo >= 0 ? TrendingUp : TrendingDown}
                />
            </div>

            {/* Tabela Mensal */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,.06)' }}>
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 text-sm">Cálculo Mensal — {selectedYear}</h3>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Relatório Consolidado
                    </span>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="th-cell">Mês</th>
                                <th className="th-cell text-right text-emerald-600">Entradas (+)</th>
                                <th className="th-cell text-right text-amber-600">Pendentes</th>
                                <th className="th-cell text-right">Fixo/Extra</th>
                                <th className="th-cell text-right">Mercado</th>
                                <th className="th-cell text-right">Fornecedores</th>
                                <th className="th-cell text-right">Retirada</th>
                                <th className="th-cell text-right text-red-600 border-l border-slate-100">Saídas (−)</th>
                                <th className="th-cell text-right border-l border-slate-100">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {months.map((monthName, index) => {
                                const data = getMonthlyData(index, selectedYear);
                                const isPositive = data.saldo >= 0;
                                const isCurrent = index === currentDate.getMonth() && selectedYear === currentDate.getFullYear();

                                return (
                                    <tr key={monthName} className={clsx("hover:bg-slate-50/80 transition-colors", isCurrent && "bg-indigo-50/40")}>
                                        <td className="td-cell font-semibold text-slate-700">
                                            {monthName}
                                            {isCurrent && <span className="ml-2 text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase">Atual</span>}
                                        </td>
                                        <td className="td-cell text-right text-emerald-600 font-semibold mono-num">{fmt(data.entradas)}</td>
                                        <td className="td-cell text-right text-amber-600 mono-num">{fmt(data.entradasPendentes)}</td>
                                        <td className="td-cell text-right text-slate-500 mono-num">{fmt(data.fixos)}</td>
                                        <td className="td-cell text-right text-slate-500 mono-num">{fmt(data.mercado)}</td>
                                        <td className="td-cell text-right text-slate-500 mono-num">{fmt(data.fornecedores)}</td>
                                        <td className="td-cell text-right text-slate-500 mono-num">{fmt(data.retirada)}</td>
                                        <td className="td-cell text-right font-bold text-red-600 border-l border-slate-100 mono-num">{fmt(data.totalSaidas)}</td>
                                        <td className={clsx(
                                            "td-cell text-right font-bold border-l border-slate-100 mono-num",
                                            isPositive ? "text-emerald-700" : "text-red-700"
                                        )}>
                                            {fmt(data.saldo)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* Footer totais */}
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                            <tr className="font-bold text-slate-700">
                                <td className="th-cell">TOTAL</td>
                                <td className="th-cell text-right text-emerald-700 mono-num">{fmt(annualTotals.entradas)}</td>
                                <td className="th-cell text-right text-amber-700 mono-num">{fmt(annualTotals.entradasPendentes)}</td>
                                <td colSpan={4} className="th-cell text-right text-slate-400">—</td>
                                <td className="th-cell text-right text-red-700 border-l border-slate-200 mono-num">{fmt(annualTotals.totalSaidas)}</td>
                                <td className={clsx("th-cell text-right border-l border-slate-200 mono-num", annualTotals.saldo >= 0 ? "text-emerald-700" : "text-red-700")}>
                                    {fmt(annualTotals.saldo)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Resumo;
