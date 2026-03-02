import React, { useState, useEffect } from 'react';
import { Save, Building2, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const EmpresasCustos = () => {
    // Column 1: Fixed base costs (12 lines)
    const initialBaseCosts = [
        { id: 'base-1', name: 'Lume', value: 0 },
        { id: 'base-2', name: 'Energia', value: 0 },
        { id: 'base-3', name: 'Agua', value: 0 },
        { id: 'base-4', name: 'Internet', value: 0 },
        { id: 'base-5', name: 'Contador', value: 0 },
        { id: 'base-6', name: 'IPTU', value: 0 },
        { id: 'base-7', name: 'Limpeza', value: 0 },
        { id: 'base-8', name: 'Folha de funcionarios', value: 0 },
        { id: 'base-9', name: 'Extra funcionarios', value: 0 },
        { id: 'base-10', name: 'Aluguel', value: 0 },
        { id: 'base-11', name: '', value: 0 },
        { id: 'base-12', name: '', value: 0 },
    ];

    const [baseCosts, setBaseCosts] = useState(() => {
        const saved = localStorage.getItem('ecommerce_custos_base');
        return saved ? JSON.parse(saved) : initialBaseCosts;
    });

    // Column 2: Additional Free Costs
    const [additionalCosts, setAdditionalCosts] = useState(() => {
        const saved = localStorage.getItem('ecommerce_custos_adicionais');
        // default 11 empty lines to start if none
        return saved ? JSON.parse(saved) : Array.from({ length: 11 }, (_, i) => ({ id: `add-${Date.now()}-${i}`, name: '', value: 0 }));
    });

    // Column 3: Percentage Costs
    const [percentCosts, setPercentCosts] = useState(() => {
        const saved = localStorage.getItem('ecommerce_custos_perc');
        // default matching initial base names + some empty lines
        const initial = [
            { id: 'perc-1', name: 'Lume', percent: 0 },
            { id: 'perc-2', name: 'Imposto', percent: 0 },
            { id: 'perc-3', name: 'Taxa Cartão', percent: 0 },
            { id: 'perc-4', name: 'Comissão', percent: 0 },
            { id: 'perc-5', name: '', percent: 0 },
            { id: 'perc-6', name: '', percent: 0 },
            { id: 'perc-7', name: '', percent: 0 },
            { id: 'perc-8', name: '', percent: 0 },
        ];
        return saved ? JSON.parse(saved) : initial;
    });

    const totalBase = baseCosts.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
    const totalAdditional = additionalCosts.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
    const totalPerc = percentCosts.reduce((acc, curr) => acc + (parseFloat(curr.percent) || 0), 0);

    // total value for percentages is calculated theoretically against some gross value, for now just sum the percentages
    // However, user requested "na frente a conta do total". If it's a fixed R$ total, percent makes calculation hard without a base value.
    // Assuming they just want to see the total % sum for now based on "na frente a conta do total" + "valores totais".

    const handleSave = () => {
        localStorage.setItem('ecommerce_custos_base', JSON.stringify(baseCosts));
        localStorage.setItem('ecommerce_custos_adicionais', JSON.stringify(additionalCosts));
        localStorage.setItem('ecommerce_custos_perc', JSON.stringify(percentCosts));
        alert('Custos da empresa salvos com sucesso!');
    };

    const updateBase = (id, field, value) => {
        setBaseCosts(baseCosts.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const updateAdditional = (id, field, value) => {
        setAdditionalCosts(additionalCosts.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const updatePercent = (id, field, value) => {
        setPercentCosts(percentCosts.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const addAddRow = () => setAdditionalCosts([...additionalCosts, { id: `add-${Date.now()}`, name: '', value: 0 }]);
    const removeAddRow = (id) => setAdditionalCosts(additionalCosts.filter(item => item.id !== id));

    const addPercRow = () => setPercentCosts([...percentCosts, { id: `perc-${Date.now()}`, name: '', percent: 0 }]);
    const removePercRow = (id) => setPercentCosts(percentCosts.filter(item => item.id !== id));

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                            Empresas e Custos Inevitáveis
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gerencie as despesas fixas, adicionais e as taxas percentuais do seu negócio.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Save size={18} />
                        Salvar Alterações
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA 1: Custos Base */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                        <h3 className="font-bold text-gray-700">Custos Padrões</h3>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-semibold uppercase">Total Base</div>
                            <div className="text-lg font-bold text-indigo-700">R$ {totalBase.toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="space-y-2 flex-grow">
                        {baseCosts.map((item, index) => (
                            <div key={item.id} className="flex gap-2 items-center pb-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-1 rounded transition-colors">
                                <input
                                    type="text"
                                    value={item.name}
                                    placeholder={`Custo Base ${index + 1}`}
                                    onChange={(e) => updateBase(item.id, 'name', e.target.value)}
                                    className="w-1/2 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                                />
                                <div className="flex items-center w-1/2">
                                    <span className="text-gray-400 font-medium text-sm mr-2 w-6 text-right">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.value === 0 ? '' : item.value}
                                        onChange={(e) => updateBase(item.id, 'value', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full text-right text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 font-medium"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUNA 2: Custos Adicionais */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                        <h3 className="font-bold text-gray-700">Custos Adicionais</h3>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-semibold uppercase">Total Adicional</div>
                            <div className="text-lg font-bold text-emerald-700">R$ {totalAdditional.toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="space-y-2 flex-grow max-h-[500px] overflow-y-auto pr-1">
                        {additionalCosts.map((item) => (
                            <div key={item.id} className="flex gap-2 items-center pb-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-1 rounded transition-colors">
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateAdditional(item.id, 'name', e.target.value)}
                                    placeholder="Nome do custo"
                                    className="w-[45%] text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                                />
                                <div className="flex items-center flex-grow">
                                    <span className="text-gray-400 font-medium text-sm mr-2">R$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.value === 0 ? '' : item.value}
                                        onChange={(e) => updateAdditional(item.id, 'value', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full text-right text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 font-medium"
                                    />
                                </div>
                                <button onClick={() => removeAddRow(item.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded bg-white">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addAddRow}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                    >
                        <Plus size={14} /> Adicionar Nova Linha
                    </button>
                </div>

                {/* COLUNA 3: Custos em % */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                        <h3 className="font-bold text-gray-700">Custos em Porcentagem</h3>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-semibold uppercase">Soma %</div>
                            <div className="text-lg font-bold text-orange-600">{totalPerc.toFixed(1)}%</div>
                        </div>
                    </div>
                    <div className="space-y-2 flex-grow max-h-[500px] overflow-y-auto pr-1">
                        {percentCosts.map((item) => (
                            <div key={item.id} className="flex gap-2 items-center pb-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-1 rounded transition-colors group">
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updatePercent(item.id, 'name', e.target.value)}
                                    placeholder="Nome (ex: Simples)"
                                    className="w-[45%] text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                                />
                                <div className="flex items-center flex-grow">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={item.percent === 0 ? '' : item.percent}
                                        onChange={(e) => updatePercent(item.id, 'percent', e.target.value)}
                                        placeholder="0.0"
                                        className="w-full text-right text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 font-medium text-indigo-700"
                                    />
                                    <span className="text-gray-500 font-bold ml-2">%</span>
                                </div>
                                <button onClick={() => removePercRow(item.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addPercRow}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 rounded border border-orange-100 hover:bg-orange-100 transition-colors"
                    >
                        <Plus size={14} /> Adicionar Taxa %
                    </button>
                </div>

            </div>
        </div>
    );
};

export default EmpresasCustos;
