import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit, FileText } from 'lucide-react';
import clsx from 'clsx';

const CadastrosFTs = () => {
    const [fts, setFts] = useState(() => {
        const saved = localStorage.getItem('ecommerce_fts');
        return saved ? JSON.parse(saved) : [];
    });

    const getNewFtCode = (currentFts = fts) => {
        for (let i = 0; i <= 999; i++) {
            const code = `FT${String(i).padStart(3, '0')}`;
            if (!currentFts.some(ft => ft.ftCode === code)) {
                return code;
            }
        }
        const lastFt = currentFts[currentFts.length - 1];
        if (!lastFt) return 'FT100';
        const num = parseInt(lastFt.ftCode.replace('FT', ''), 10);
        return `FT${String(num + 1).padStart(3, '0')}`;
    };

    const initialFormState = {
        id: '',
        ftCode: '',
        name: '',
        variation: '',
        productionTime: '',
        salePrice: 0,
        materials: [],
        directCostsRS: [],
        directCostsPercent: []
    };

    const [form, setForm] = useState({ ...initialFormState, ftCode: getNewFtCode() });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        localStorage.setItem('ecommerce_fts', JSON.stringify(fts));
    }, [fts]);

    const handleSave = () => {
        if (!form.name || form.salePrice <= 0) {
            alert('Por favor, preencha o nome e o preço de venda válido.');
            return;
        }

        let updatedFts;
        if (isEditing) {
            updatedFts = fts.map(ft => ft.id === form.id ? form : ft);
            setFts(updatedFts);
            setIsEditing(false);
        } else {
            updatedFts = [...fts, { ...form, id: Date.now().toString() }];
            setFts(updatedFts);
        }
        setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
    };

    const handleEdit = (ft) => {
        setForm(ft);
        setIsEditing(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta FT?')) {
            const updatedFts = fts.filter(ft => ft.id !== id);
            setFts(updatedFts);
            if (isEditing && form.id === id) {
                setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                setIsEditing(false);
            }
        }
    };

    const handleCancel = () => {
        setForm({ ...initialFormState, ftCode: getNewFtCode(fts) });
        setIsEditing(false);
    };

    // dynamic lists handlers
    const addListItem = (listName, template) => {
        setForm({ ...form, [listName]: [...form[listName], { ...template, id: Date.now().toString() }] });
    };

    const removeListItem = (listName, id) => {
        setForm({ ...form, [listName]: form[listName].filter(item => item.id !== id) });
    };

    const updateListItem = (listName, id, field, value) => {
        setForm({
            ...form,
            [listName]: form[listName].map(item => item.id === id ? { ...item, [field]: value } : item)
        });
    };

    // calculations
    const totalMaterials = form.materials.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
    const totalDirectRS = form.directCostsRS.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
    const totalDirectPercentValue = form.directCostsPercent.reduce((acc, curr) => {
        const perc = parseFloat(curr.percentage) || 0;
        return acc + ((perc / 100) * (parseFloat(form.salePrice) || 0));
    }, 0);

    const marginRS = (parseFloat(form.salePrice) || 0) - totalMaterials - totalDirectRS - totalDirectPercentValue;
    const marginPercent = parseFloat(form.salePrice) > 0 ? (marginRS / parseFloat(form.salePrice)) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        {isEditing ? `Editar Ficha Técnica` : 'Nova Ficha Técnica (FT)'}
                    </h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-sm font-semibold text-gray-600 whitespace-nowrap hidden sm:block">Selecionar FT:</label>
                        <select
                            value={form.ftCode}
                            onChange={(e) => {
                                const selectedCode = e.target.value;
                                const existingFt = fts.find(ft => ft.ftCode === selectedCode);
                                if (existingFt) {
                                    setForm(existingFt);
                                    setIsEditing(true);
                                } else {
                                    setForm({ ...initialFormState, ftCode: selectedCode });
                                    setIsEditing(false);
                                }
                            }}
                            className="w-full sm:w-auto text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 font-medium py-1.5"
                        >
                            {Array.from({ length: 1000 }, (_, i) => {
                                const code = `FT${String(i).padStart(3, '0')}`;
                                const existingFt = fts.find(ft => ft.ftCode === code);
                                return (
                                    <option key={code} value={code}>
                                        {existingFt ? `${code} - ${existingFt.name}` : `${code} - Limpa`}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* Info Básica */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Produto</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: Luminária X"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Variação / Subcategoria <span className="text-gray-400 font-normal">(Opcional)</span></label>
                        <input
                            type="text"
                            value={form.variation}
                            onChange={(e) => setForm({ ...form, variation: e.target.value })}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: Preto"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tempo Prod. (min)</label>
                        <input
                            type="number"
                            value={form.productionTime || ''}
                            onChange={(e) => setForm({ ...form, productionTime: e.target.value })}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: 30"
                            min="0"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Preço de Venda (R$)</label>
                        <input
                            type="number"
                            value={form.salePrice || ''}
                            onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0,00"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Custo Materiais */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Materiais</h3>
                            <button onClick={() => addListItem('materials', { name: '', value: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.materials.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Material"
                                        value={item.name}
                                        onChange={(e) => updateListItem('materials', item.id, 'name', e.target.value)}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="R$"
                                        value={item.value || ''}
                                        onChange={(e) => updateListItem('materials', item.id, 'value', parseFloat(e.target.value) || 0)}
                                        className="w-24 text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                        step="0.01"
                                    />
                                    <button onClick={() => removeListItem('materials', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {form.materials.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Nenhum material</p>}
                        </div>
                        <div className="mt-3 text-right text-xs font-semibold text-gray-700 pt-2 border-t border-gray-200">
                            Total: R$ {totalMaterials.toFixed(2)}
                        </div>
                    </div>

                    {/* Custo Direto R$ */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Custos Diretos (R$)</h3>
                            <button onClick={() => addListItem('directCostsRS', { name: '', value: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.directCostsRS.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Custo (ex: Frete)"
                                        value={item.name}
                                        onChange={(e) => updateListItem('directCostsRS', item.id, 'name', e.target.value)}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="R$"
                                        value={item.value || ''}
                                        onChange={(e) => updateListItem('directCostsRS', item.id, 'value', parseFloat(e.target.value) || 0)}
                                        className="w-24 text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                        step="0.01"
                                    />
                                    <button onClick={() => removeListItem('directCostsRS', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {form.directCostsRS.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Nenhum custo R$</p>}
                        </div>
                        <div className="mt-3 text-right text-xs font-semibold text-gray-700 pt-2 border-t border-gray-200">
                            Total: R$ {totalDirectRS.toFixed(2)}
                        </div>
                    </div>

                    {/* Custo Direto % */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Custos Diretos (%)</h3>
                            <button onClick={() => addListItem('directCostsPercent', { name: '', percentage: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.directCostsPercent.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Custo (ex: Imposto)"
                                        value={item.name}
                                        onChange={(e) => updateListItem('directCostsPercent', item.id, 'name', e.target.value)}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <div className="w-24 relative">
                                        <input
                                            type="number"
                                            placeholder="%"
                                            value={item.percentage || ''}
                                            onChange={(e) => updateListItem('directCostsPercent', item.id, 'percentage', parseFloat(e.target.value) || 0)}
                                            className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 pr-6"
                                            step="0.1"
                                        />
                                        <span className="absolute right-2 top-1.5 text-xs text-gray-500">%</span>
                                    </div>
                                    <button onClick={() => removeListItem('directCostsPercent', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {form.directCostsPercent.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Nenhum custo %</p>}
                        </div>
                        <div className="mt-3 text-right text-xs font-semibold text-gray-700 pt-2 border-t border-gray-200">
                            Equivalente: R$ {totalDirectPercentValue.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Margem de contribuição */}
                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-indigo-900">
                        <span className="font-semibold block mb-1">Resumo da Margem de Contribuição:</span>
                        Venda: R$ {(form.salePrice || 0).toFixed(2)} - Custos Totais: R$ {(totalMaterials + totalDirectRS + totalDirectPercentValue).toFixed(2)}
                    </div>
                    <div className="flex gap-6 text-right">
                        <div>
                            <span className="block text-xs text-indigo-600 font-medium">Margem (R$)</span>
                            <span className={clsx("text-xl font-bold", marginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                R$ {marginRS.toFixed(2)}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs text-indigo-600 font-medium">Margem (%)</span>
                            <span className={clsx("text-xl font-bold", marginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                {marginPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="mt-6 flex justify-end gap-3">
                    {isEditing && (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Save size={16} />
                        {isEditing ? 'Atualizar FT' : 'Salvar nova FT'}
                    </button>
                </div>
            </div>

            {/* Tabela de FTs Salvas */}
            {fts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Fichas Técnicas Cadastradas</h3>
                        <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full">{fts.length} itens</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-white uppercase">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Cód / Nome</th>
                                    <th className="px-6 py-3 font-medium text-right">Preço de Venda</th>
                                    <th className="px-6 py-3 font-medium text-right">M. Contribuição (R$)</th>
                                    <th className="px-6 py-3 font-medium text-right">M. Contribuição (%)</th>
                                    <th className="px-6 py-3 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {fts.map((ft) => {
                                    // Cálculo rápido da margem para a tabela (já poderia estar salvo na FT, mas vamos calcular para garantir)
                                    const ftTotalMat = ft.materials.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
                                    const ftTotalDir = ft.directCostsRS.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
                                    const ftTotalPerc = ft.directCostsPercent.reduce((acc, curr) => {
                                        return acc + (((parseFloat(curr.percentage) || 0) / 100) * (parseFloat(ft.salePrice) || 0));
                                    }, 0);
                                    const ftMarginRS = (parseFloat(ft.salePrice) || 0) - ftTotalMat - ftTotalDir - ftTotalPerc;
                                    const ftMarginPercent = parseFloat(ft.salePrice) > 0 ? (ftMarginRS / parseFloat(ft.salePrice)) * 100 : 0;

                                    return (
                                        <tr key={ft.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">
                                                    <span className="text-gray-500 mr-2">{ft.ftCode}</span>
                                                    {ft.name} {ft.variation && <span className="text-gray-500 font-normal ml-1">({ft.variation})</span>}
                                                </div>
                                                {ft.productionTime && <div className="text-xs text-gray-500 mt-1">Tempo Prod.: {ft.productionTime} min</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                R$ {parseFloat(ft.salePrice).toFixed(2)}
                                            </td>
                                            <td className={clsx("px-6 py-4 text-right font-semibold", ftMarginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                R$ {ftMarginRS.toFixed(2)}
                                            </td>
                                            <td className={clsx("px-6 py-4 text-right font-bold", ftMarginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {ftMarginPercent.toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setForm({
                                                                ...ft,
                                                                id: '',
                                                                ftCode: getNewFtCode(),
                                                                variation: ''
                                                            });
                                                            setIsEditing(false);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                        title="Criar Variação / Duplicar"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                    <button onClick={() => handleEdit(ft)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Editar">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(ft.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CadastrosFTs;
