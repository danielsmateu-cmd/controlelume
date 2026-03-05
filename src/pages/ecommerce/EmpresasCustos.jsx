import React, { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Loader2, Megaphone, Package, BarChart3 } from 'lucide-react';
import { api } from '../../services/api';

const MARKETPLACES = [
    { id: 'meli', label: '🛒 Mercado Livre' },
    { id: 'shopee', label: '🧡 Shopee' },
    { id: 'tiktok', label: '🎵 TikTok' },
    { id: 'amazon', label: '📦 Amazon' },
    { id: 'site', label: '🌐 Site' },
    { id: 'geral', label: '🏢 Geral (todas)' },
];

const EMPRESA_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', text: 'text-blue-800', total: 'text-blue-700', btn: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100', text: 'text-emerald-800', total: 'text-emerald-700', btn: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100', text: 'text-purple-800', total: 'text-purple-700', btn: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100', text: 'text-amber-800', total: 'text-amber-700', btn: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
];

const getColor = (i) => EMPRESA_COLORS[i % EMPRESA_COLORS.length];

const getInitData = () => ({
    empresas: [
        {
            id: 'emp-1', name: 'LUME', expenses: [
                { id: '1-e', name: 'Energia', value: 0 },
                { id: '1-a', name: 'Agua', value: 0 },
                { id: '1-i', name: 'Internet', value: 0 },
                { id: '1-c', name: 'Contador', value: 0 },
                { id: '1-ip', name: 'IPTU', value: 0 },
                { id: '1-l', name: 'Limpeza', value: 0 },
                { id: '1-f', name: 'Folha', value: 0 },
                { id: '1-al', name: 'Aluguel', value: 0 },
            ]
        },
        { id: 'emp-2', name: 'Bureau', expenses: [] },
    ],
    ads: [],
    gastosExtras: [],
});

const migrateData = (saved) => {
    if (!saved || typeof saved !== 'object') return getInitData();

    // Já está no novo formato com empresas válidas
    if (Array.isArray(saved.empresas) && saved.empresas.length > 0) {
        return {
            empresas: saved.empresas,
            ads: Array.isArray(saved.ads) ? saved.ads : [],
            gastosExtras: Array.isArray(saved.gastosExtras) ? saved.gastosExtras : [],
        };
    }

    // Migrar formato legado (empresa1 / empresa2 / somatoria)
    const defaults = getInitData();
    const empresas = [];
    if (saved.empresa1) {
        empresas.push({
            id: 'emp-1',
            name: saved.empresa1.name || 'LUME',
            expenses: Array.isArray(saved.empresa1.expenses) ? saved.empresa1.expenses : defaults.empresas[0].expenses,
        });
    }
    if (saved.empresa2) {
        empresas.push({
            id: 'emp-2',
            name: saved.empresa2.name || 'Bureau',
            expenses: Array.isArray(saved.empresa2.expenses) ? saved.empresa2.expenses : [],
        });
    }

    return {
        empresas: empresas.length > 0 ? empresas : defaults.empresas,
        ads: Array.isArray(saved.ads) ? saved.ads : [],
        gastosExtras: Array.isArray(saved.gastosExtras) ? saved.gastosExtras : [],
    };
};

const fmt = (val) => {
    const n = parseFloat(val) || 0;
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val) => {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const getWorkHoursInMonth = (monthStr) => {
    if (!monthStr) return 0;
    const [year, month] = monthStr.split('-').map(Number);

    // Calcula para o mês *anterior* ao selecionado
    // Se monthStr = '2026-03', prevDate = '2026-02-01'
    const prevDate = new Date(year, month - 2, 1);
    const targetYear = prevDate.getFullYear();
    const targetMonthIndex = prevDate.getMonth();

    // Quantidade de dias no mês alvo
    const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    let weekdays = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(targetYear, targetMonthIndex, i).getDay();
        if (d !== 0 && d !== 6) weekdays++;
    }
    return weekdays * 7;
};

// ─── Sub-componentes por aba ───────────────────────────────────────────────

const TabEmpresas = ({ empresas, mutateData, getEmpTotal, currentMonth, vendasData, ftsData, mktFtsData }) => {
    const monthHours = getWorkHoursInMonth(currentMonth);

    // Cálculo do Rateio da Empresa 2 (Bureau)
    const emp2 = empresas.length > 1 ? empresas[1] : null; // Assume que a 2ª é o Bureau
    let rateioEmp2PorMkt = 0;

    // Contar marketplaces ativos (excluindo 'geral')
    const mktsAtivos = MARKETPLACES.filter(m => m.id !== 'geral');

    if (emp2 && mktsAtivos.length > 0) {
        const totalEmp2 = getEmpTotal(emp2);
        const percentualRepasse = emp2.ecommerceShare || 0;
        const valorIrParaEcommerce = totalEmp2 * (percentualRepasse / 100);
        rateioEmp2PorMkt = valorIrParaEcommerce / mktsAtivos.length;
    }

    // Resumo de produção por marketplace
    const marketplacesResumo = mktsAtivos.map(mkt => {
        const key = `${mkt.id}_${currentMonth}`;
        const vendas = Array.isArray(vendasData[key]) ? vendasData[key] : [];
        const fts = mktFtsData[mkt.id] || ftsData;

        let horasConsumidas = 0;
        vendas.forEach(venda => {
            const ft = fts.find(f => f.id === venda.ftId);
            if (ft) {
                const tempoMin = parseFloat(ft.productionTime) || 0;
                const qtd = parseInt(venda.quantity) || 0;
                // Tempo na FT está em minutos. Dividimos por 60 para obter horas.
                horasConsumidas += (tempoMin / 60) * qtd;
            }
        });

        let custoHoraEmp1 = 0;
        let emp1Name = 'Empresa 1';
        if (empresas.length > 0) {
            const emp1 = empresas[0]; // Empresa 1 (Lume)
            emp1Name = emp1.name || 'Empresa 1';
            const totalEmp1 = getEmpTotal(emp1);
            const dispEmp1 = (emp1.productionFactor || 0) * monthHours;
            custoHoraEmp1 = dispEmp1 > 0 ? totalEmp1 / dispEmp1 : 0;
        }

        const valorEmp1 = horasConsumidas * custoHoraEmp1;
        const valorEmp2 = rateioEmp2PorMkt;
        const emp2Name = emp2 ? (emp2.name || 'Empresa 2') : 'Empresa 2';

        const custoTotalMkt = valorEmp1 + valorEmp2;

        return { ...mkt, horasConsumidas, custoTotalMkt, valorEmp1, valorEmp2, emp1Name, emp2Name };
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Botão Add Empresa no topo */}
            <div className="md:col-span-2 xl:col-span-3 flex justify-end">
                <button
                    onClick={() => mutateData(d => ({
                        ...d,
                        empresas: [...d.empresas, { id: `emp-${Date.now()}`, name: `Empresa ${d.empresas.length + 1}`, expenses: [] }],
                    }))}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold border border-indigo-200"
                >
                    <Plus size={13} /> Adicionar Empresa
                </button>
            </div>

            {empresas.map((emp, idx) => {
                const c = getColor(idx);
                const total = getEmpTotal(emp);
                return (
                    <div key={emp.id} className={`bg-white p-3 rounded-xl border ${c.border} shadow-sm flex flex-col`}>
                        <div className={`${c.header} p-2 rounded mb-2 flex justify-between items-center`}>
                            <input
                                type="text"
                                value={emp.name}
                                onChange={(e) => mutateData(d => ({
                                    ...d,
                                    empresas: d.empresas.map(x => x.id === emp.id ? { ...x, name: e.target.value } : x),
                                }))}
                                className={`font-bold bg-transparent border-b border-dashed border-gray-400 focus:outline-none text-sm ${c.text} w-2/3`}
                            />
                            <div className="text-right">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">Total</div>
                                <div className={`text-sm font-bold ${c.total}`}>{fmt(total)}</div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-2 rounded mb-2 border border-gray-100 flex justify-between items-center gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Fator de Produção (x)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={emp.productionFactor ?? ''}
                                    onChange={(e) => mutateData(d => ({
                                        ...d,
                                        empresas: d.empresas.map(x => x.id === emp.id ? { ...x, productionFactor: parseFloat(e.target.value) || 0 } : x)
                                    }))}
                                    placeholder="0"
                                    className="w-full text-xs border border-gray-200 rounded p-1 bg-white"
                                />
                            </div>
                            <div className="text-right flex-1">
                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Tempo Disp. (Mês)</div>
                                <div className="text-base font-bold text-indigo-700">
                                    {fmtNum((emp.productionFactor || 0) * monthHours)} <span className="text-[10px] font-normal text-gray-500">hrs</span>
                                </div>
                            </div>
                        </div>

                        {/* Custo por Hora ou Rateio */}
                        {(() => {
                            if (idx === 0) {
                                // Empresa 1: Custo por Hora
                                const horasDisp = (emp.productionFactor || 0) * monthHours;
                                const custoPorHora = horasDisp > 0 ? total / horasDisp : 0;
                                return (
                                    <div className="bg-indigo-50/50 p-2 rounded mb-2 border border-indigo-100 flex justify-between items-center">
                                        <div className="text-[10px] text-indigo-800 font-bold uppercase">Custo por Hora</div>
                                        <div className="text-sm font-bold text-indigo-700">{fmt(custoPorHora)}/h</div>
                                    </div>
                                );
                            } else {
                                // Demais Empresas (Ex: Bureau): % de Rateio E-commerce
                                return (
                                    <div className="bg-orange-50/50 p-2 rounded mb-2 border border-orange-100 flex justify-between items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-orange-800 font-bold uppercase block mb-1">% P/ E-commerce</label>
                                            <div className="flex items-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={emp.ecommerceShare ?? ''}
                                                    onChange={(e) => mutateData(d => ({
                                                        ...d,
                                                        empresas: d.empresas.map(x => x.id === emp.id ? { ...x, ecommerceShare: parseFloat(e.target.value) || 0 } : x)
                                                    }))}
                                                    placeholder="0"
                                                    className="w-full text-xs border border-orange-200 rounded p-1"
                                                />
                                                <span className="text-orange-600 font-bold text-xs ml-1">%</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-1">
                                            <div className="text-[10px] text-orange-800 font-bold uppercase mb-1">Valor Rateado</div>
                                            <div className="text-sm font-bold text-orange-700">
                                                {fmt(total * ((emp.ecommerceShare || 0) / 100))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        })()}

                        <div className="space-y-1 flex-grow max-h-[40vh] overflow-y-auto pr-1">
                            {(emp.expenses || []).map(exp => (
                                <div key={exp.id} className="flex gap-1 items-center pb-1 border-b border-gray-50 group">
                                    <input
                                        type="text"
                                        value={exp.name}
                                        placeholder="Nome"
                                        onChange={(e) => mutateData(d => ({
                                            ...d,
                                            empresas: d.empresas.map(x => x.id === emp.id
                                                ? { ...x, expenses: x.expenses.map(ex => ex.id === exp.id ? { ...ex, name: e.target.value } : ex) }
                                                : x),
                                        }))}
                                        className="w-1/2 text-xs border border-gray-200 rounded p-1"
                                    />
                                    <div className="flex items-center flex-grow">
                                        <span className="text-gray-400 text-xs mr-1">R$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={exp.value === 0 ? '' : exp.value}
                                            onChange={(e) => mutateData(d => ({
                                                ...d,
                                                empresas: d.empresas.map(x => x.id === emp.id
                                                    ? { ...x, expenses: x.expenses.map(ex => ex.id === exp.id ? { ...ex, value: e.target.value } : ex) }
                                                    : x),
                                            }))}
                                            placeholder="0.00"
                                            className="w-full text-right text-xs border border-gray-200 rounded p-1"
                                        />
                                    </div>
                                    <button
                                        onClick={() => mutateData(d => ({
                                            ...d,
                                            empresas: d.empresas.map(x => x.id === emp.id
                                                ? { ...x, expenses: x.expenses.filter(ex => ex.id !== exp.id) }
                                                : x),
                                        }))}
                                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 ml-1"
                                    ><Trash2 size={11} /></button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => mutateData(d => ({
                                    ...d,
                                    empresas: d.empresas.map(x => x.id === emp.id
                                        ? { ...x, expenses: [...(x.expenses || []), { id: `${emp.id}-${Date.now()}`, name: '', value: 0 }] }
                                        : x),
                                }))}
                                className={`flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded ${c.btn}`}
                            ><Plus size={11} /> Add Despesa</button>
                            {empresas.length > 1 && (
                                <button
                                    onClick={() => mutateData(d => ({ ...d, empresas: d.empresas.filter(x => x.id !== emp.id) }))}
                                    className="px-2 py-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 rounded"
                                ><Trash2 size={11} /></button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Nova Coluna: Custo Inevitável Total por Marketplace */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <div className="bg-gray-100 p-2 rounded mb-3 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">Custo Inevitável (Rateios)</h3>
                </div>
                <div className="space-y-3 flex-grow max-h-[40vh] overflow-y-auto pr-1">
                    {marketplacesResumo.map(res => (
                        <div key={res.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{res.label}</div>
                                    <div className="text-[10px] text-gray-500 font-semibold">{fmtNum(res.horasConsumidas)} horas prod.</div>
                                </div>
                                <div className="text-base font-black text-red-600">
                                    {fmt(res.custoTotalMkt)}
                                </div>
                            </div>

                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-gray-600 uppercase">{res.emp1Name}</span>
                                <span className="text-xs font-bold text-gray-700">{fmt(res.valorEmp1)}</span>
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-gray-600 uppercase">{res.emp2Name}</span>
                                <span className="text-xs font-bold text-orange-600">+{fmt(res.valorEmp2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TabAdsExtras = ({ ads, extras, empresas, mutateData, getEmpTotal }) => {
    const totalAds = ads.reduce((a, c) => a + (parseFloat(c.value) || 0), 0);
    const totalExtras = extras.reduce((a, c) => a + (parseFloat(c.value) || 0), 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* GASTOS COM ADS */}
            <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-sm flex flex-col">
                <div className="bg-purple-100 p-2 rounded mb-3 flex justify-between items-center">
                    <h3 className="font-bold text-purple-800 text-sm flex items-center gap-1.5">
                        <Megaphone size={14} /> Gastos com Ads
                    </h3>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Total</div>
                        <div className="text-sm font-bold text-purple-700">{fmt(totalAds)}</div>
                    </div>
                </div>

                <div className="flex-grow space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {ads.map(ad => (
                        <div key={ad.id} className="bg-purple-50/50 border border-purple-100 rounded-lg p-2">
                            <div className="flex gap-1 items-center mb-1.5">
                                <input
                                    type="text"
                                    value={ad.name}
                                    placeholder="Nome (ex: Google Ads, Meta Ads)"
                                    onChange={(e) => mutateData(d => ({ ...d, ads: d.ads.map(a => a.id === ad.id ? { ...a, name: e.target.value } : a) }))}
                                    className="flex-1 text-xs border border-gray-200 rounded p-1 font-semibold"
                                />
                                <div className="flex items-center">
                                    <span className="text-gray-400 text-xs mr-1">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={ad.value === 0 ? '' : ad.value}
                                        onChange={(e) => mutateData(d => ({ ...d, ads: d.ads.map(a => a.id === ad.id ? { ...a, value: e.target.value } : a) }))}
                                        placeholder="0.00"
                                        className="w-24 text-right text-xs border border-gray-200 rounded p-1 text-purple-700 font-bold"
                                    />
                                </div>
                                <button
                                    onClick={() => mutateData(d => ({ ...d, ads: d.ads.filter(a => a.id !== ad.id) }))}
                                    className="text-red-400 hover:text-red-600 ml-1"
                                ><Trash2 size={11} /></button>
                            </div>

                            {/* Marketplace deste Ad */}
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[9px] font-bold text-purple-500 uppercase whitespace-nowrap">Marketplace:</span>
                                <select
                                    value={ad.marketplace || 'geral'}
                                    onChange={(e) => mutateData(d => ({ ...d, ads: d.ads.map(a => a.id === ad.id ? { ...a, marketplace: e.target.value } : a) }))}
                                    className="flex-1 text-xs border border-purple-200 rounded p-1 bg-white text-purple-800 font-semibold"
                                >
                                    {MARKETPLACES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => mutateData(d => ({ ...d, ads: [...d.ads, { id: `ad-${Date.now()}`, name: '', value: 0, marketplace: 'geral' }] }))}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg font-semibold"
                ><Plus size={12} /> Add Gasto com Ads</button>
            </div>

            {/* GASTOS EXTRAS */}
            <div className="bg-white p-3 rounded-xl border border-orange-200 shadow-sm flex flex-col">
                <div className="bg-orange-100 p-2 rounded mb-3 flex justify-between items-center">
                    <h3 className="font-bold text-orange-800 text-sm flex items-center gap-1.5">
                        <Package size={14} /> Gastos Extras
                    </h3>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Total</div>
                        <div className="text-sm font-bold text-orange-700">{fmt(totalExtras)}</div>
                    </div>
                </div>

                <div className="flex-grow space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {extras.map(ex => (
                        <div key={ex.id} className="bg-orange-50/50 border border-orange-100 rounded-lg p-2 group">
                            <div className="flex gap-1 items-center mb-1.5">
                                <input
                                    type="text"
                                    value={ex.name}
                                    placeholder="Nome do gasto"
                                    onChange={(e) => mutateData(d => ({
                                        ...d,
                                        gastosExtras: d.gastosExtras.map(x => x.id === ex.id ? { ...x, name: e.target.value } : x),
                                    }))}
                                    className="flex-1 text-xs border border-gray-200 rounded p-1"
                                />
                                <button
                                    onClick={() => mutateData(d => ({ ...d, gastosExtras: d.gastosExtras.filter(x => x.id !== ex.id) }))}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                ><Trash2 size={11} /></button>
                            </div>
                            <div className="flex gap-1 items-center">
                                <select
                                    value={ex.marketplace || 'geral'}
                                    onChange={(e) => mutateData(d => ({
                                        ...d,
                                        gastosExtras: d.gastosExtras.map(x => x.id === ex.id ? { ...x, marketplace: e.target.value } : x),
                                    }))}
                                    className="flex-1 text-xs border border-gray-200 rounded p-1 bg-white"
                                >
                                    {MARKETPLACES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                                <div className="flex items-center">
                                    <span className="text-gray-400 text-xs mr-1">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={ex.value === 0 ? '' : ex.value}
                                        onChange={(e) => mutateData(d => ({
                                            ...d,
                                            gastosExtras: d.gastosExtras.map(x => x.id === ex.id ? { ...x, value: e.target.value } : x),
                                        }))}
                                        placeholder="0.00"
                                        className="w-24 text-right text-xs border border-gray-200 rounded p-1 text-orange-700 font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => mutateData(d => ({ ...d, gastosExtras: [...d.gastosExtras, { id: `ex-${Date.now()}`, name: '', value: 0, marketplace: 'geral' }] }))}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg font-semibold"
                ><Plus size={12} /> Add Gasto Extra</button>
            </div>
        </div>
    );
};

const TabResumoParcerias = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[200px] text-center">
        <BarChart3 className="w-12 h-12 text-indigo-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-600 mb-2">Resumo Parcerias</h3>
        <p className="text-sm text-gray-400">Esta seção será configurada em breve conforme acordado.</p>
    </div>
);

// ─── Componente Principal ──────────────────────────────────────────────────

const EmpresasCustos = () => {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [activeTab, setActiveTab] = useState('empresas');
    const [data, setData] = useState(getInitData);
    const [vendasData, setVendasData] = useState({});
    const [ftsData, setFtsData] = useState([]);
    const [mktFtsData, setMktFtsData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    const SUB_TABS = [
        { id: 'empresas', label: '🏢 Empresas' },
        { id: 'ads', label: '📣 Ads + Extras' },
        { id: 'resumo', label: '📊 Resumo Parcerias' },
    ];

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            setErrorMsg(null);
            try {
                const [allCosts, dbSales, fts] = await Promise.all([
                    api.getMonthlyCosts(),
                    api.getMonthlySales(),
                    api.getFts()
                ]);

                if (cancelled) return;

                // Fichas técnicas (globais e locais de cada marketplace)
                setFtsData(fts);
                const mktFts = {};
                MARKETPLACES.forEach(p => {
                    const raw = localStorage.getItem(`fts_mkt_${p.id}`);
                    mktFts[p.id] = raw ? JSON.parse(raw) : fts;
                });
                setMktFtsData(mktFts);

                // Vendas e custos
                setVendasData(dbSales);
                setData(migrateData(allCosts?.[currentMonth]));
            } catch (err) {
                if (!cancelled) {
                    console.error('Erro ao carregar custos:', err);
                    setErrorMsg(String(err));
                    setData(getInitData());
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [currentMonth]);

    const mutateData = (updater) => {
        setData((prev) => {
            const next = updater(prev);
            api.saveMonthlyCosts(currentMonth, next).catch(console.error);
            return next;
        });
    };

    const formatMonthDisplay = (monthStr) => {
        if (!monthStr) return '';
        const [yearStr, monthNumStr] = monthStr.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthNumStr, 10);
        const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
        const prevMonth = new Date(year, month - 2).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
        return `FECHAMENTO ${monthName} DE ${year} - CONTAS DE ${prevMonth}`;
    };

    const empresas = Array.isArray(data.empresas) ? data.empresas : [];
    const ads = Array.isArray(data.ads) ? data.ads : [];
    const extras = Array.isArray(data.gastosExtras) ? data.gastosExtras : [];

    const getEmpTotal = (emp) => (emp.expenses || []).reduce((a, c) => a + (parseFloat(c.value) || 0), 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-indigo-600" />
                        Empresas e Custos Inevitáveis
                    </h2>
                    <div className="flex-1 flex justify-center">
                        <div className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-sm text-sm text-center whitespace-nowrap">
                            {formatMonthDisplay(currentMonth)}
                        </div>
                    </div>
                    {activeTab !== 'resumo' && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-600">Referência:</label>
                            <input
                                type="month"
                                value={currentMonth}
                                onChange={(e) => setCurrentMonth(e.target.value)}
                                className="text-sm border-gray-300 rounded px-2 py-1"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-abas */}
            <div className="flex gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
                    Erro ao carregar dados: {errorMsg}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="ml-2 text-indigo-600 font-medium">Carregando...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'empresas' && (
                        <TabEmpresas
                            empresas={empresas}
                            mutateData={mutateData}
                            getEmpTotal={getEmpTotal}
                            currentMonth={currentMonth}
                            vendasData={vendasData}
                            ftsData={ftsData}
                            mktFtsData={mktFtsData}
                        />
                    )}
                    {activeTab === 'ads' && (
                        <TabAdsExtras ads={ads} extras={extras} empresas={empresas} mutateData={mutateData} getEmpTotal={getEmpTotal} />
                    )}
                    {activeTab === 'resumo' && (
                        <TabResumoParcerias />
                    )}
                </>
            )}
        </div>
    );
};

export default EmpresasCustos;
