import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit, FileText, Loader2, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';

const CadastrosFTs = ({ marketplace = 'geral', readOnly = false }) => {
    // Remove mktKey entirely
    const [fts, setFts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

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

    const [form, setForm] = useState({ ...initialFormState, ftCode: 'FT000' });
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [costModels, setCostModels] = useState([]);
    const [overrides, setOverrides] = useState({});

    useEffect(() => {
        loadData();
    }, [marketplace]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [dbFts, dbModels, mktOverrides] = await Promise.all([
                api.getFts(),
                api.getFtCostModels(),
                api.getSettings(`ft_overrides_${marketplace}`)
            ]);

            const overridesData = mktOverrides || {};
            setOverrides(overridesData);

            let finalFts = [...dbFts];

            // --- MIGRAÇÃO DE FTS PRESAS NO LOCALSTORAGE POR MARKETPLACE ---
            const knownMkts = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];
            let ftsMigrated = false;

            for (const mkt of knownMkts) {
                const key = `fts_mkt_${mkt}`;
                const mktData = localStorage.getItem(key);
                if (mktData) {
                    try {
                        const parsed = JSON.parse(mktData);
                        console.log(`Migrando FTs do marketplace ${mkt}...`);
                        for (const ft of parsed) {
                            // Only migrate FTs that don't already exist in Supabase (check by ft_code)
                            const exists = finalFts.some(dbFt => dbFt.ftCode === ft.ftCode);
                            if (!exists) {
                                const { id, _mkt, ...ftWithoutId } = ft;
                                const res = await api.saveFt({ ...ftWithoutId, id: null });
                                if (res.success) {
                                    finalFts.push({ ...ftWithoutId, id: res.newId, ftCode: ft.ftCode });
                                    ftsMigrated = true;
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Error migrating mkt data", e);
                    }
                    // Limpar do localStorage para nunca mais rodar
                    localStorage.removeItem(key);
                }
            }

            finalFts = finalFts.map(ft => {
                if (overridesData[ft.ftCode]) {
                    return { ...ft, ...overridesData[ft.ftCode], isOverride: true };
                }
                return ft;
            });

            finalFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));

            setFts(finalFts);
            setCostModels(dbModels);
            setForm({ ...initialFormState, ftCode: getNewFtCode(finalFts) });
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (readOnly) return;
        if (!form.name || form.salePrice <= 0) {
            alert('Por favor, preencha o nome e o preço de venda válido.');
            return;
        }

        setIsSaving(true);
        try {
            const formData = { ...form };

            if (!isEditing) {
                // NEW FT -> Save Globally
                formData.id = null; // Let the API generate a UUID
                const res = await api.saveFt(formData);

                if (res.success) {
                    const newFt = { ...formData, id: res.newId };
                    const updatedFts = [...fts, newFt];
                    updatedFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));
                    setFts(updatedFts);
                    setIsEditing(false);
                    setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                } else {
                    alert('Erro ao criar nova FT.');
                    console.error(res.error);
                }
            } else {
                // EDIT EXISTING FT -> Save as Override for this marketplace
                const nextOverrides = { ...overrides };
                nextOverrides[form.ftCode] = {
                    name: form.name,
                    variation: form.variation,
                    productionTime: form.productionTime,
                    salePrice: form.salePrice,
                    materials: form.materials,
                    directCostsRS: form.directCostsRS,
                    directCostsPercent: form.directCostsPercent
                };

                const success = await api.saveSettings(`ft_overrides_${marketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                    const updatedFts = fts.map(ft => ft.ftCode === form.ftCode ? { ...formData, isOverride: true } : ft);
                    updatedFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));
                    setFts(updatedFts);
                    setIsEditing(false);
                    setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                } else {
                    alert("Erro ao salvar alterações da FT no marketplace.");
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (ft) => {
        if (readOnly) return;
        setForm(ft);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (readOnly) return;
        const ftToDelete = fts.find(f => f.id === id);

        if (ftToDelete?.isOverride) {
            if (window.confirm(`Esta FT possui modificações APENAS neste marketplace (${marketplace}).\n\nDeseja restaurar as configurações originais (globais)?\n\nOK = Restaurar original\nCancelar = Manter como está`)) {
                const nextOverrides = { ...overrides };
                delete nextOverrides[ftToDelete.ftCode];
                const success = await api.saveSettings(`ft_overrides_${marketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                    // Recarregar os dados para pegar a versão original
                    loadData();
                    if (isEditing && form.id === id) {
                        setIsEditing(false);
                    }
                } else {
                    alert("Erro ao restaurar a FT original");
                }
                return;
            } else {
                return; // Cancelled
            }
        }

        if (window.confirm('Tem certeza que deseja EXCLUIR DEFINITIVAMENTE esta FT de TODOS os marketplaces?')) {
            const success = await api.deleteFt(id);
            if (success) {
                const updatedFts = fts.filter(ft => ft.id !== id);
                setFts(updatedFts);
                if (isEditing && form.id === id) {
                    setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                    setIsEditing(false);
                }
            } else {
                alert('Erro ao excluir FT.');
            }
        }
    };

    const handleCancel = () => {
        if (readOnly) return;
        setForm({ ...initialFormState, ftCode: getNewFtCode(fts) });
        setIsEditing(false);
    };

    const handleSaveCostModel = async () => {
        if (readOnly) return;
        const name = window.prompt('Digite um nome para este modelo de custos (ex: Revenda 30%):');
        if (!name || name.trim() === '') return;

        const newModel = {
            id: null,
            name: name.trim(),
            materials: form.materials.map(m => ({ id: m.id, name: m.name, value: 0 })),
            directCostsRS: form.directCostsRS,
            directCostsPercent: form.directCostsPercent
        };

        setIsSaving(true);
        const res = await api.saveFtCostModel(newModel);
        setIsSaving(false);

        if (res.success) {
            setCostModels([...costModels, res.data]);
            alert(`Modelo "${name.trim()}" salvo com sucesso!`);
        } else {
            alert("Erro ao salvar modelo na nuvem.");
        }
    };

    const handleLoadCostModel = (e) => {
        if (readOnly) return;
        const id = e.target.value;
        if (!id) return;
        const model = costModels.find(m => m.id === id);
        if (model) {
            if (window.confirm(`Deseja carregar o modelo "${model.name}"? Isso substituirá os materiais, custos R$ e % atuais.`)) {
                setForm({
                    ...form,
                    materials: model.materials && model.materials.length > 0 ? model.materials : form.materials,
                    directCostsRS: model.directCostsRS || [],
                    directCostsPercent: model.directCostsPercent || []
                });
            }
        }
        e.target.value = ''; // reset select
    };

    // dynamic lists handlers
    const addListItem = (listName, template) => {
        if (readOnly) return;
        setForm({ ...form, [listName]: [...form[listName], { ...template, id: Date.now().toString() }] });
    };

    const removeListItem = (listName, id) => {
        if (readOnly) return;
        setForm({ ...form, [listName]: form[listName].filter(item => item.id !== id) });
    };

    const updateListItem = (listName, id, field, value) => {
        if (readOnly) return;
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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

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
                            disabled={readOnly}
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
                            readOnly={readOnly}
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
                            readOnly={readOnly}
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
                            readOnly={readOnly}
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
                            readOnly={readOnly}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0,00"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 mt-8 gap-4 border-b border-gray-100 pb-4">
                    <h3 className="text-md font-bold text-gray-800">Composição de Custos</h3>
                    {!readOnly && (
                        <div className="flex flex-wrap items-center gap-3">
                            {costModels.length > 0 && (
                                <select
                                    onChange={handleLoadCostModel}
                                    defaultValue=""
                                    disabled={readOnly}
                                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="" disabled>Carregar Modelo...</option>
                                    {costModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                type="button"
                                onClick={handleSaveCostModel}
                                disabled={readOnly}
                                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                                Salvar como Modelo
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Custo Materiais */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Materiais</h3>
                            {!readOnly && (
                                <button onClick={() => addListItem('materials', { name: '', value: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {form.materials.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Material"
                                        value={item.name}
                                        onChange={(e) => updateListItem('materials', item.id, 'name', e.target.value)}
                                        readOnly={readOnly}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="R$"
                                        value={item.value || ''}
                                        onChange={(e) => updateListItem('materials', item.id, 'value', parseFloat(e.target.value) || 0)}
                                        readOnly={readOnly}
                                        className="w-24 text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                        step="0.01"
                                    />
                                    {!readOnly && (
                                        <button onClick={() => removeListItem('materials', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
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
                            {!readOnly && (
                                <button onClick={() => addListItem('directCostsRS', { name: '', value: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {form.directCostsRS.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Custo (ex: Frete)"
                                        value={item.name}
                                        onChange={(e) => updateListItem('directCostsRS', item.id, 'name', e.target.value)}
                                        readOnly={readOnly}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="R$"
                                        value={item.value || ''}
                                        onChange={(e) => updateListItem('directCostsRS', item.id, 'value', parseFloat(e.target.value) || 0)}
                                        readOnly={readOnly}
                                        className="w-24 text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                        step="0.01"
                                    />
                                    {!readOnly && (
                                        <button onClick={() => removeListItem('directCostsRS', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
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
                            {!readOnly && (
                                <button onClick={() => addListItem('directCostsPercent', { name: '', percentage: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {form.directCostsPercent.map(item => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Custo (ex: Imposto)"
                                        value={item.name}
                                        onChange={(e) => updateListItem('directCostsPercent', item.id, 'name', e.target.value)}
                                        readOnly={readOnly}
                                        className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <div className="w-24 relative">
                                        <input
                                            type="number"
                                            placeholder="%"
                                            value={item.percentage || ''}
                                            onChange={(e) => updateListItem('directCostsPercent', item.id, 'percentage', parseFloat(e.target.value) || 0)}
                                            readOnly={readOnly}
                                            className="w-full text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 pr-6"
                                            step="0.1"
                                        />
                                        <span className="absolute right-2 top-1.5 text-xs text-gray-500">%</span>
                                    </div>
                                    {!readOnly && (
                                        <button onClick={() => removeListItem('directCostsPercent', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
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
                    {isEditing && !readOnly && (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                    )}
                    {!readOnly && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || readOnly}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isEditing ? 'Atualizar FT' : 'Salvar nova FT'}
                        </button>
                    )}
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
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Matérias (R$)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">C. Dir. R$ (Fixo)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">C. Dir. R$ (%)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Margem (R$)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Margem (%)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Venda (R$)</th>
                                    <th className="px-6 py-3 font-medium text-center whitespace-nowrap">Tempo / Ações</th>
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
                                                <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                    <span className="text-gray-500">{ft.ftCode}</span>
                                                    {ft.isOverride && (
                                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                            Modificado Local
                                                        </span>
                                                    )}
                                                    <span>{ft.name} {ft.variation && <span className="text-gray-500 font-normal ml-1">({ft.variation})</span>}</span>
                                                </div>
                                                {ft.productionTime && <div className="text-xs text-gray-500 mt-1">Tempo Prod.: {ft.productionTime} min</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                R$ {ftTotalMat.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                R$ {ftTotalDir.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                R$ {ftTotalPerc.toFixed(2)}
                                            </td>
                                            <td className={clsx("px-6 py-4 text-right font-semibold", ftMarginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                R$ {ftMarginRS.toFixed(2)}
                                            </td>
                                            <td className={clsx("px-6 py-4 text-right font-bold", ftMarginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {ftMarginPercent.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap">
                                                R$ {parseFloat(ft.salePrice).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-2">
                                                    {ft.productionTime && (
                                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                                            {ft.productionTime}min
                                                        </span>
                                                    )}
                                                    <div className="flex justify-center gap-1">
                                                        {!readOnly && (
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
                                                        )}
                                                        <button
                                                            onClick={() => handleEdit(ft)}
                                                            disabled={readOnly}
                                                            className={clsx("p-1.5 rounded transition-colors", readOnly ? "opacity-30 cursor-not-allowed" : "text-indigo-600 hover:bg-indigo-50")}
                                                            title="Editar"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(ft.id)}
                                                            disabled={readOnly}
                                                            className={clsx("p-1.5 rounded transition-colors", readOnly ? "opacity-30 cursor-not-allowed" : "text-red-600 hover:bg-red-50")}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
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
