import React, { useState, useEffect, useCallback } from 'react';
import { Save, Building2, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const EmpresasCustos = () => {
    // Current month state
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // All monthly data
    const [monthlyData, setMonthlyData] = useState(() => {
        const saved = localStorage.getItem('ecommerce_empresas_custos_mensal');
        return saved ? JSON.parse(saved) : {};
    });

    const initData = {
        empresa1: {
            name: 'Empresa 1',
            expenses: [
                { id: '1-e', name: 'Energia', value: 0 },
                { id: '1-a', name: 'Agua', value: 0 },
                { id: '1-i', name: 'Internet', value: 0 },
                { id: '1-c', name: 'Contador', value: 0 },
                { id: '1-ip', name: 'IPTU', value: 0 },
                { id: '1-l', name: 'Limpeza', value: 0 },
                { id: '1-f', name: 'Folha', value: 0 },
                { id: '1-ex', name: 'Extra', value: 0 },
                { id: '1-al', name: 'Aluguel', value: 0 }
            ]
        },
        empresa2: {
            name: 'Empresa 2',
            expenses: []
        },
        somatoria: {
            percent: [
                { id: 'p-1', name: 'Imposto', percent: 0 },
                { id: 'p-2', name: 'Cartão', percent: 0 }
            ],
            fixedRS: []
        }
    };

    const [data, setData] = useState(initData);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        if (monthlyData[currentMonth]) {
            setData(monthlyData[currentMonth]);
        } else {
            setData(initData);
        }
        setHasUnsavedChanges(false);
    }, [currentMonth, monthlyData]);

    // Handle beforeunload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleSave = () => {
        if (window.confirm(`Deseja salvar os dados no mês: ${currentMonth}?`)) {
            const updated = { ...monthlyData, [currentMonth]: data };
            setMonthlyData(updated);
            localStorage.setItem('ecommerce_empresas_custos_mensal', JSON.stringify(updated));
            setHasUnsavedChanges(false);
            alert('Salvo com sucesso!');
        }
    };

    const mutateData = (updater) => {
        setData((prev) => {
            const next = updater(prev);
            return next;
        });
        setHasUnsavedChanges(true);
    };

    // Calculate totals
    const totalEmpresa1 = data.empresa1.expenses.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
    const totalEmpresa2 = data.empresa2.expenses.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

    // Percent totals
    let percentCalcEmpresa1 = 0;
    let percentCalcEmpresa2 = 0;

    data.somatoria.percent.forEach(p => {
        const perc = parseFloat(p.percent) || 0;
        percentCalcEmpresa1 += totalEmpresa1 * (perc / 100);
        percentCalcEmpresa2 += totalEmpresa2 * (perc / 100);
    });

    const totalPercentRS = percentCalcEmpresa1 + percentCalcEmpresa2;
    const totalFixedRS = data.somatoria.fixedRS.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

    const generalTotal = totalEmpresa1 + totalEmpresa2 + totalPercentRS + totalFixedRS;

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                            Empresas e Custos Inevitáveis
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-600">Mês:</label>
                            <input
                                type="month"
                                value={currentMonth}
                                onChange={(e) => setCurrentMonth(e.target.value)}
                                className="text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 px-2 py-1"
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Save size={16} />
                            Salvar Mês
                        </button>
                    </div>
                </div>
                {hasUnsavedChanges && (
                    <p className="text-xs text-orange-500 mt-2 font-semibold">⚠️ Você tem alterações não salvas neste mês.</p>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* EMPRESA 1 */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                    <div className="bg-gray-50 p-2 rounded border border-gray-100 mb-2 flex justify-between items-center">
                        <input
                            type="text"
                            value={data.empresa1.name}
                            onChange={(e) => mutateData(d => ({ ...d, empresa1: { ...d.empresa1, name: e.target.value } }))}
                            className="font-bold text-gray-700 bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-indigo-500 w-1/2"
                            placeholder="Nome Empresa 1"
                        />
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase">Total</div>
                            <div className="text-sm font-bold text-indigo-700">R$ {totalEmpresa1.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="space-y-1 flex-grow max-h-[60vh] overflow-y-auto pr-1">
                        {data.empresa1.expenses.map((exp) => (
                            <div key={exp.id} className="flex gap-1 items-center pb-1 border-b border-gray-50 group">
                                <input
                                    type="text"
                                    value={exp.name}
                                    placeholder="Nome do custo"
                                    onChange={(e) => mutateData(d => ({
                                        ...d, empresa1: { ...d.empresa1, expenses: d.empresa1.expenses.map(x => x.id === exp.id ? { ...x, name: e.target.value } : x) }
                                    }))}
                                    className="w-1/2 text-xs border border-gray-300 rounded p-1"
                                />
                                <div className="flex items-center flex-grow">
                                    <span className="text-gray-400 text-xs mr-1">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={exp.value === 0 ? '' : exp.value}
                                        onChange={(e) => mutateData(d => ({
                                            ...d, empresa1: { ...d.empresa1, expenses: d.empresa1.expenses.map(x => x.id === exp.id ? { ...x, value: e.target.value } : x) }
                                        }))}
                                        placeholder="0.00"
                                        className="w-full text-right text-xs border border-gray-300 rounded p-1"
                                    />
                                </div>
                                <button
                                    onClick={() => mutateData(d => ({ ...d, empresa1: { ...d.empresa1, expenses: d.empresa1.expenses.filter(x => x.id !== exp.id) } }))}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => mutateData(d => ({ ...d, empresa1: { ...d.empresa1, expenses: [...d.empresa1.expenses, { id: `e1-${Date.now()}`, name: '', value: 0 }] } }))}
                        className="mt-2 w-full flex items-center justify-center gap-1 py-1 text-xs text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                    >
                        <Plus size={12} /> Add Despesa
                    </button>
                </div>

                {/* EMPRESA 2 */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                    <div className="bg-gray-50 p-2 rounded border border-gray-100 mb-2 flex justify-between items-center">
                        <input
                            type="text"
                            value={data.empresa2.name}
                            onChange={(e) => mutateData(d => ({ ...d, empresa2: { ...d.empresa2, name: e.target.value } }))}
                            className="font-bold text-gray-700 bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-indigo-500 w-1/2"
                            placeholder="Nome Empresa 2"
                        />
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase">Total</div>
                            <div className="text-sm font-bold text-emerald-700">R$ {totalEmpresa2.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="space-y-1 flex-grow max-h-[60vh] overflow-y-auto pr-1">
                        {data.empresa2.expenses.map((exp) => (
                            <div key={exp.id} className="flex gap-1 items-center pb-1 border-b border-gray-50 group">
                                <input
                                    type="text"
                                    value={exp.name}
                                    placeholder="Nome do custo"
                                    onChange={(e) => mutateData(d => ({
                                        ...d, empresa2: { ...d.empresa2, expenses: d.empresa2.expenses.map(x => x.id === exp.id ? { ...x, name: e.target.value } : x) }
                                    }))}
                                    className="w-1/2 text-xs border border-gray-300 rounded p-1"
                                />
                                <div className="flex items-center flex-grow">
                                    <span className="text-gray-400 text-xs mr-1">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={exp.value === 0 ? '' : exp.value}
                                        onChange={(e) => mutateData(d => ({
                                            ...d, empresa2: { ...d.empresa2, expenses: d.empresa2.expenses.map(x => x.id === exp.id ? { ...x, value: e.target.value } : x) }
                                        }))}
                                        placeholder="0.00"
                                        className="w-full text-right text-xs border border-gray-300 rounded p-1"
                                    />
                                </div>
                                <button
                                    onClick={() => mutateData(d => ({ ...d, empresa2: { ...d.empresa2, expenses: d.empresa2.expenses.filter(x => x.id !== exp.id) } }))}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => mutateData(d => ({ ...d, empresa2: { ...d.empresa2, expenses: [...d.empresa2.expenses, { id: `e2-${Date.now()}`, name: '', value: 0 }] } }))}
                        className="mt-2 w-full flex items-center justify-center gap-1 py-1 text-xs text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"
                    >
                        <Plus size={12} /> Add Despesa
                    </button>
                </div>

                {/* SOMATÓRIA E CUSTOS GERAIS */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
                    <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-xl flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-sm">Somatória e Cálculos</h3>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase">Total Geral</div>
                            <div className="text-base font-bold text-indigo-900">R$ {generalTotal.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="p-3 space-y-4 flex-grow max-h-[60vh] overflow-y-auto">

                        {/* Seção Porcentagens */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-xs font-bold text-gray-600 uppercase">Custos em %</h4>
                                <span className="text-xs text-orange-600 font-medium">+ R$ {totalPercentRS.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1">
                                {data.somatoria.percent.map(p => (
                                    <div key={p.id} className="flex flex-col p-1 border border-gray-100 rounded bg-white shadow-sm hover:border-orange-200 transition-colors group">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={p.name}
                                                placeholder="Nome (ex: Imposto)"
                                                onChange={(e) => mutateData(d => ({
                                                    ...d, somatoria: { ...d.somatoria, percent: d.somatoria.percent.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) }
                                                }))}
                                                className="w-1/2 text-xs border-b border-gray-200 focus:outline-none focus:border-orange-500 py-0.5"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                value={p.percent === 0 ? '' : p.percent}
                                                onChange={(e) => mutateData(d => ({
                                                    ...d, somatoria: { ...d.somatoria, percent: d.somatoria.percent.map(x => x.id === p.id ? { ...x, percent: e.target.value } : x) }
                                                }))}
                                                placeholder="0%"
                                                className="w-1/3 text-right text-xs border-b border-gray-200 focus:outline-none focus:border-orange-500 py-0.5 text-orange-600 font-bold"
                                            />
                                            <span className="text-[10px] font-bold text-gray-400">%</span>
                                            <button
                                                onClick={() => mutateData(d => ({ ...d, somatoria: { ...d.somatoria, percent: d.somatoria.percent.filter(x => x.id !== p.id) } }))}
                                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
                                            <span>E1: R$ {(totalEmpresa1 * ((parseFloat(p.percent) || 0) / 100)).toFixed(2)}</span>
                                            <span>E2: R$ {(totalEmpresa2 * ((parseFloat(p.percent) || 0) / 100)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => mutateData(d => ({ ...d, somatoria: { ...d.somatoria, percent: [...d.somatoria.percent, { id: `p-${Date.now()}`, name: '', percent: 0 }] } }))}
                                className="mt-1 w-full flex items-center justify-center gap-1 py-1 text-[10px] uppercase font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded"
                            >
                                <Plus size={10} /> Add %
                            </button>
                        </div>

                        {/* Seção Custos Fixos em R$ */}
                        <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-xs font-bold text-gray-600 uppercase">Custos Extras em R$</h4>
                                <span className="text-xs text-blue-600 font-medium">+ R$ {totalFixedRS.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1">
                                {data.somatoria.fixedRS.map(f => (
                                    <div key={f.id} className="flex gap-1 items-center bg-white p-1 rounded border border-gray-100 shadow-sm group hover:border-blue-200 transition-colors">
                                        <input
                                            type="text"
                                            value={f.name}
                                            placeholder="Despesa extra"
                                            onChange={(e) => mutateData(d => ({
                                                ...d, somatoria: { ...d.somatoria, fixedRS: d.somatoria.fixedRS.map(x => x.id === f.id ? { ...x, name: e.target.value } : x) }
                                            }))}
                                            className="w-1/2 text-xs border border-gray-200 rounded p-1"
                                        />
                                        <div className="flex items-center flex-grow">
                                            <span className="text-gray-400 text-[10px] mr-1">R$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={f.value === 0 ? '' : f.value}
                                                onChange={(e) => mutateData(d => ({
                                                    ...d, somatoria: { ...d.somatoria, fixedRS: d.somatoria.fixedRS.map(x => x.id === f.id ? { ...x, value: e.target.value } : x) }
                                                }))}
                                                className="w-full text-right text-xs border border-gray-200 rounded p-1 text-blue-600 font-medium"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <button
                                            onClick={() => mutateData(d => ({ ...d, somatoria: { ...d.somatoria, fixedRS: d.somatoria.fixedRS.filter(x => x.id !== f.id) } }))}
                                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => mutateData(d => ({ ...d, somatoria: { ...d.somatoria, fixedRS: [...d.somatoria.fixedRS, { id: `f-${Date.now()}`, name: '', value: 0 }] } }))}
                                className="mt-1 w-full flex items-center justify-center gap-1 py-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                            >
                                <Plus size={10} /> Add R$
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default EmpresasCustos;
