import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit, FileText, Loader2, Pencil, X, Search, Check } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';

// Helper to encode material configuration into the name string
const encodeMaterialName = (originalName, config) => {
    const metaParts = [];
    if (config.materialId) metaParts.push(`id:${config.materialId}`);
    if (config.type) metaParts.push(`t:${config.type}`);
    if (config.x !== undefined && config.x !== null) metaParts.push(`x:${config.x}`);
    if (config.y !== undefined && config.y !== null) metaParts.push(`y:${config.y}`);
    if (config.length !== undefined && config.length !== null) metaParts.push(`l:${config.length}`);
    if (config.quantity !== undefined && config.quantity !== null) metaParts.push(`q:${config.quantity}`);
    if (config.price !== undefined && config.price !== null) metaParts.push(`p:${config.price}`);
    if (config.pricePerM2 !== undefined && config.pricePerM2 !== null) metaParts.push(`pm2:${config.pricePerM2}`);
    
    let suffix = '';
    if (config.type === 'sheet') {
        suffix = ` (${config.x}x${config.y}cm)`;
    } else if (config.type === 'linear') {
        suffix = ` (${config.length}cm)`;
    } else if (config.type === 'unit') {
        suffix = ` (${config.quantity}un)`;
    }

    return `${originalName}${suffix} @meta:${metaParts.join(';')}`;
};

// Helper to parse material configuration from the name string
const parseMaterialName = (encodedName) => {
    if (!encodedName) return { name: '', displayName: '', config: { isLegacy: true } };
    
    const parts = encodedName.split(' @meta:');
    if (parts.length < 2) {
        return { name: encodedName, displayName: encodedName, config: { isLegacy: true } };
    }
    
    const nameWithSuffix = parts[0];
    const metaStr = parts[1];
    
    let originalName = nameWithSuffix;
    const suffixRegex = /\s\(\d+(\.\d+)?(x\d+(\.\d+)?)?(cm|un)\)$/;
    originalName = nameWithSuffix.replace(suffixRegex, '');

    const config = {};
    const metaPairs = metaStr.split(';');
    metaPairs.forEach(pair => {
        const [key, val] = pair.split(':');
        if (key === 'id') config.materialId = val;
        else if (key === 't') config.type = val;
        else if (key === 'x') config.x = parseFloat(val);
        else if (key === 'y') config.y = parseFloat(val);
        else if (key === 'l') config.length = parseFloat(val);
        else if (key === 'q') config.quantity = parseFloat(val);
        else if (key === 'p') config.price = parseFloat(val);
        else if (key === 'pm2') config.pricePerM2 = parseFloat(val);
    });
    
    return { name: originalName, displayName: nameWithSuffix, config };
};

const PLATFORMS = [
    { id: 'meli', label: 'Mercado Livre', emoji: '🛒', color: 'bg-yellow-400 hover:bg-yellow-500', activeColor: 'bg-yellow-500', ring: 'ring-yellow-300', textColor: 'text-yellow-900' },
    { id: 'shopee', label: 'Shopee', emoji: '🧡', color: 'bg-orange-500 hover:bg-orange-600', activeColor: 'bg-orange-600', ring: 'ring-orange-300', textColor: 'text-white' },
    { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: 'bg-gray-900 hover:bg-black', activeColor: 'bg-black', ring: 'ring-gray-500', textColor: 'text-white' },
    { id: 'amazon', label: 'Amazon', emoji: '📦', color: 'bg-amber-500 hover:bg-amber-600', activeColor: 'bg-amber-600', ring: 'ring-amber-300', textColor: 'text-white' },
    { id: 'site', label: 'Site', emoji: '🌐', color: 'bg-indigo-600 hover:bg-indigo-700', activeColor: 'bg-indigo-700', ring: 'ring-indigo-300', textColor: 'text-white' },
];

const CadastrosFTs = ({ marketplace = 'geral', readOnly = false }) => {
    const [currentMarketplace, setCurrentMarketplace] = useState(marketplace);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
    const [registeredMaterials, setRegisteredMaterials] = useState([]);
    const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
    const [tempMeasurements, setTempMeasurements] = useState({});
    const [tempUnitQtys, setTempUnitQtys] = useState({});
    const [tempLinearLengths, setTempLinearLengths] = useState({});
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [currentMarketplace]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [dbFts, dbModels, mktOverrides, dbMaterials] = await Promise.all([
                api.getFts(),
                api.getFtCostModels(),
                api.getSettings(`ft_overrides_${currentMarketplace}`),
                api.getMaterials()
            ]);

            setRegisteredMaterials(dbMaterials || []);

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

        if (isEditing) {
            const confirmed = window.confirm('Deseja realmente atualizar esta Ficha Técnica?');
            if (!confirmed) return;
        }

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
                    setIsModalOpen(false);
                } else {
                    alert('Erro ao criar nova FT.');
                    console.error(res.error);
                }
            } else if (currentMarketplace === 'geral') {
                // EDIT EXISTING FT GLOBALLY -> Save to Database
                const res = await api.saveFt(formData);

                if (res.success) {
                    // Propagate physical changes to all overrides (Mercado Livre, Shopee, etc.)
                    const knownMkts = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];
                    
                    await Promise.all(knownMkts.map(async (mkt) => {
                        try {
                            const mktOverrides = await api.getSettings(`ft_overrides_${mkt}`);
                            if (mktOverrides && mktOverrides[form.ftCode]) {
                                mktOverrides[form.ftCode] = {
                                    ...mktOverrides[form.ftCode],
                                    name: formData.name,
                                    variation: formData.variation,
                                    productionTime: formData.productionTime,
                                    materials: formData.materials
                                };
                                await api.saveSettings(`ft_overrides_${mkt}`, mktOverrides);
                            }
                        } catch (err) {
                            console.error(`Error propagating override to ${mkt}:`, err);
                        }
                    }));

                    const updatedFts = fts.map(ft => ft.ftCode === form.ftCode ? { ...formData, isOverride: ft.isOverride } : ft);
                    updatedFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));
                    setFts(updatedFts);
                    setIsEditing(false);
                    setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                    setIsModalOpen(false);
                } else {
                    alert('Erro ao atualizar FT global.');
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

                const success = await api.saveSettings(`ft_overrides_${currentMarketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                    const updatedFts = fts.map(ft => ft.ftCode === form.ftCode ? { ...formData, isOverride: true } : ft);
                    updatedFts.sort((a, b) => a.ftCode.localeCompare(b.ftCode));
                    setFts(updatedFts);
                    setIsEditing(false);
                    setForm({ ...initialFormState, ftCode: getNewFtCode(updatedFts) });
                    setIsModalOpen(false);
                } else {
                    alert("Erro ao salvar alterações da FT no marketplace.");
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleNewFt = () => {
        setForm({ ...initialFormState, ftCode: getNewFtCode() });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (ft) => {
        if (readOnly) return;
        setForm(ft);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleCreateVariation = (ft) => {
        setForm({
            ...ft,
            id: '',
            ftCode: getNewFtCode(),
            variation: ''
        });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (readOnly) return;
        const ftToDelete = fts.find(f => f.id === id);

        if (ftToDelete?.isOverride) {
            if (window.confirm(`Esta FT possui modificações APENAS neste marketplace (${currentMarketplace}).\n\nDeseja restaurar as configurações originais (globais)?\n\nOK = Restaurar original\nCancelar = Manter como está`)) {
                const nextOverrides = { ...overrides };
                delete nextOverrides[ftToDelete.ftCode];
                const success = await api.saveSettings(`ft_overrides_${currentMarketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                    // Recarregar os dados para pegar a versão original
                    loadData();
                    if (isEditing && form.id === id) {
                        setIsEditing(false);
                        setIsModalOpen(false);
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
                    setIsModalOpen(false);
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
        setIsModalOpen(false);
    };

    const handleInlineProductionTimeChange = async (ft, newValue) => {
        if (readOnly) return;
        const val = newValue === '' ? '' : parseInt(newValue, 10);
        if (newValue !== '' && isNaN(val)) return;

        try {
            if (ft.isOverride) {
                const nextOverrides = { ...overrides };
                nextOverrides[ft.ftCode] = {
                    ...overrides[ft.ftCode],
                    productionTime: val
                };
                const success = await api.saveSettings(`ft_overrides_${currentMarketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                } else {
                    alert("Erro ao salvar alteração de tempo no marketplace.");
                    loadData();
                }
            } else {
                const success = await api.updateFtProductionTime(ft.id, val);
                if (!success) {
                    alert("Erro ao atualizar tempo de produção global.");
                    loadData();
                }
            }
        } catch (err) {
            console.error("Erro ao atualizar tempo de produção:", err);
            alert("Erro ao salvar alteração.");
            loadData();
        }
    };

    const handleInlineSalePriceChange = async (ft, newValue) => {
        if (readOnly) return;
        const val = parseFloat(newValue) || 0;
        if (val <= 0) {
            alert("Preço de venda inválido.");
            loadData();
            return;
        }

        const confirmed = window.confirm(`Deseja realmente alterar o preço de venda da FT "${ft.name}" para R$ ${val.toFixed(2)}?`);
        if (!confirmed) {
            loadData();
            return;
        }

        try {
            if (ft.isOverride) {
                const nextOverrides = { ...overrides };
                nextOverrides[ft.ftCode] = {
                    ...overrides[ft.ftCode],
                    salePrice: val
                };
                const success = await api.saveSettings(`ft_overrides_${currentMarketplace}`, nextOverrides);
                if (success) {
                    setOverrides(nextOverrides);
                } else {
                    alert("Erro ao salvar alteração de preço no marketplace.");
                    loadData();
                }
            } else {
                const success = await api.updateFtSalePrice(ft.id, val);
                if (!success) {
                    alert("Erro ao atualizar preço de venda global.");
                    loadData();
                }
            }
        } catch (err) {
            console.error("Erro ao atualizar preço de venda:", err);
            alert("Erro ao salvar alteração.");
            loadData();
        }
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

    const handleSaveMaterialsModel = async () => {
        if (readOnly) return;
        const name = window.prompt('Digite um nome para o modelo de materiais:');
        if (!name || name.trim() === '') return;

        const newModel = {
            id: null,
            name: name.trim(),
            materials: form.materials,
            directCostsRS: [],
            directCostsPercent: []
        };

        setIsSaving(true);
        const res = await api.saveFtCostModel(newModel);
        setIsSaving(false);

        if (res.success) {
            setCostModels([...costModels, res.data]);
            alert(`Modelo de materiais "${name.trim()}" salvo com sucesso!`);
        } else {
            alert("Erro ao salvar modelo de materiais na nuvem.");
        }
    };

    const handleLoadMaterialsModel = (e) => {
        if (readOnly) return;
        const id = e.target.value;
        if (!id) return;
        const model = costModels.find(m => m.id === id);
        if (model) {
            if (window.confirm(`Deseja carregar os materiais do modelo "${model.name}"? Isso substituirá a lista de materiais atual.`)) {
                setForm({
                    ...form,
                    materials: model.materials || []
                });
            }
        }
        e.target.value = ''; // reset select
    };

    const handleSaveDirectCostsRSModel = async () => {
        if (readOnly) return;
        const name = window.prompt('Digite um nome para o modelo de custos R$:');
        if (!name || name.trim() === '') return;

        const newModel = {
            id: null,
            name: name.trim(),
            materials: [],
            directCostsRS: form.directCostsRS,
            directCostsPercent: []
        };

        setIsSaving(true);
        const res = await api.saveFtCostModel(newModel);
        setIsSaving(false);

        if (res.success) {
            setCostModels([...costModels, res.data]);
            alert(`Modelo de custos R$ "${name.trim()}" salvo com sucesso!`);
        } else {
            alert("Erro ao salvar modelo de custos R$ na nuvem.");
        }
    };

    const handleLoadDirectCostsRSModel = (e) => {
        if (readOnly) return;
        const id = e.target.value;
        if (!id) return;
        const model = costModels.find(m => m.id === id);
        if (model) {
            if (window.confirm(`Deseja carregar os custos R$ do modelo "${model.name}"? Isso substituirá os custos R$ atuais.`)) {
                setForm({
                    ...form,
                    directCostsRS: model.directCostsRS || []
                });
            }
        }
        e.target.value = ''; // reset select
    };

    const handleSaveDirectCostsPercentModel = async () => {
        if (readOnly) return;
        const name = window.prompt('Digite um nome para o modelo de custos %:');
        if (!name || name.trim() === '') return;

        const newModel = {
            id: null,
            name: name.trim(),
            materials: [],
            directCostsRS: [],
            directCostsPercent: form.directCostsPercent
        };

        setIsSaving(true);
        const res = await api.saveFtCostModel(newModel);
        setIsSaving(false);

        if (res.success) {
            setCostModels([...costModels, res.data]);
            alert(`Modelo de custos % "${name.trim()}" salvo com sucesso!`);
        } else {
            alert("Erro ao salvar modelo de custos % na nuvem.");
        }
    };

    const handleLoadDirectCostsPercentModel = (e) => {
        if (readOnly) return;
        const id = e.target.value;
        if (!id) return;
        const model = costModels.find(m => m.id === id);
        if (model) {
            if (window.confirm(`Deseja carregar os custos % do modelo "${model.name}"? Isso substituirá os custos % atuais.`)) {
                setForm({
                    ...form,
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

    const handleOpenMaterialSelector = () => {
        const initialMeasurements = {};
        const initialUnitQtys = {};
        const initialLinearLengths = {};

        form.materials.forEach(item => {
            const parsed = parseMaterialName(item.name);
            if (parsed.config && parsed.config.materialId) {
                const { materialId, type, x, y, length, quantity } = parsed.config;
                if (type === 'sheet') {
                    initialMeasurements[materialId] = { x: x || '', y: y || '' };
                } else if (type === 'unit') {
                    initialUnitQtys[materialId] = quantity || '';
                } else if (type === 'linear') {
                    initialLinearLengths[materialId] = length || '';
                }
            }
        });

        setTempMeasurements(initialMeasurements);
        setTempUnitQtys(initialUnitQtys);
        setTempLinearLengths(initialLinearLengths);
        setMaterialSearchTerm('');
        setIsMaterialSelectorOpen(true);
    };

    const handleConfirmMaterials = () => {
        const newMaterials = [];

        // 1. Preserve legacy manual materials (those without @meta:)
        form.materials.forEach(item => {
            const parsed = parseMaterialName(item.name);
            if (parsed.config.isLegacy) {
                newMaterials.push(item);
            }
        });

        // 2. Add selected database materials
        registeredMaterials.forEach(mat => {
            if (mat.type === 'sheet') {
                const m = tempMeasurements[mat.id];
                const x = parseFloat(m?.x);
                const y = parseFloat(m?.y);
                if (x > 0 && y > 0) {
                    const areaM2 = (x * y) / 10000;
                    const cost = areaM2 * mat.pricePerM2;
                    
                    const nameEncoded = encodeMaterialName(mat.name, {
                        materialId: mat.id,
                        type: 'sheet',
                        x,
                        y,
                        pricePerM2: mat.pricePerM2,
                        price: mat.price
                    });
                    
                    newMaterials.push({
                        id: 'db-' + mat.id,
                        name: nameEncoded,
                        value: parseFloat(cost.toFixed(2))
                    });
                }
            } else if (mat.type === 'unit') {
                const qty = parseFloat(tempUnitQtys[mat.id]);
                if (qty > 0) {
                    const cost = qty * mat.price;
                    
                    const nameEncoded = encodeMaterialName(mat.name, {
                        materialId: mat.id,
                        type: 'unit',
                        quantity: qty,
                        price: mat.price
                    });
                    
                    newMaterials.push({
                        id: 'db-' + mat.id,
                        name: nameEncoded,
                        value: parseFloat(cost.toFixed(2))
                    });
                }
            } else if (mat.type === 'linear') {
                const length = parseFloat(tempLinearLengths[mat.id]);
                if (length > 0) {
                    const cost = (length / 100) * mat.price;
                    
                    const nameEncoded = encodeMaterialName(mat.name, {
                        materialId: mat.id,
                        type: 'linear',
                        length: length,
                        price: mat.price
                    });
                    
                    newMaterials.push({
                        id: 'db-' + mat.id,
                        name: nameEncoded,
                        value: parseFloat(cost.toFixed(2))
                    });
                }
            }
        });

        setForm(prev => ({
            ...prev,
            materials: newMaterials
        }));
        setIsMaterialSelectorOpen(false);
    };

    const getTempCost = (mat) => {
        if (mat.type === 'sheet') {
            const m = tempMeasurements[mat.id];
            const x = parseFloat(m?.x) || 0;
            const y = parseFloat(m?.y) || 0;
            const areaM2 = (x * y) / 10000;
            return areaM2 * (mat.pricePerM2 || 0);
        } else if (mat.type === 'linear') {
            const length = parseFloat(tempLinearLengths[mat.id]) || 0;
            return (length / 100) * (mat.price || 0);
        } else if (mat.type === 'unit') {
            const qty = parseFloat(tempUnitQtys[mat.id]) || 0;
            return qty * (mat.price || 0);
        }
        return 0;
    };

    const handleTempMeasurementChange = (id, field, value) => {
        setTempMeasurements(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || { x: '', y: '' }),
                [field]: value
            }
        }));
    };

    const handleTempUnitQtyChange = (id, value) => {
        setTempUnitQtys(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleTempLinearLengthChange = (id, value) => {
        setTempLinearLengths(prev => ({
            ...prev,
            [id]: value
        }));
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

    const filteredMaterials = registeredMaterials.filter(m => 
        m.name.toLowerCase().includes(materialSearchTerm.toLowerCase())
    );

    const sheetMaterials = filteredMaterials.filter(m => !m.type || m.type === 'sheet');
    const linearMaterials = filteredMaterials.filter(m => m.type === 'linear');
    const unitMaterials = filteredMaterials.filter(m => m.type === 'unit');

    const totalSelectedMaterialsCost = registeredMaterials.reduce((acc, mat) => {
        return acc + getTempCost(mat);
    }, 0);

    const currentPlatform = PLATFORMS.find(p => p.id === currentMarketplace);
    const options = [
        { id: 'geral', label: 'Geral (Global)', emoji: '🌐', color: 'bg-slate-700 hover:bg-slate-800', activeColor: 'bg-slate-800', ring: 'ring-slate-300', textColor: 'text-white' },
        ...PLATFORMS
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Marketplace Selector */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Filtrar por Marketplace (Overrides)</p>
                <div className="flex flex-wrap gap-3">
                    {options.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setCurrentMarketplace(p.id)}
                            className={clsx(
                                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                                currentMarketplace === p.id 
                                    ? `${p.color} ${p.textColor} ring-2 ${p.ring} ring-offset-2 shadow-lg scale-105` 
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            )}
                        >
                            <span className="text-base">{p.emoji}</span>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Header Section */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Cadastro de Fichas Técnicas</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {currentMarketplace === 'geral'
                            ? 'Gerenciando Fichas Técnicas Globais (padrão para todas as plataformas)'
                            : `Gerenciando overrides para ${currentPlatform?.label}`}
                    </p>
                </div>
                {!readOnly && (
                    <button
                        onClick={handleNewFt}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition-all duration-200 hover:scale-105"
                    >
                        <Plus size={18} />
                        Nova Ficha Técnica
                    </button>
                )}
            </div>

            {/* Modal Popup Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleCancel}></div>

                    {/* Modal content */}
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-5xl max-h-[90vh] overflow-y-auto z-10 transition-all transform scale-100 flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10 bg-white">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" />
                                {isEditing ? `Editar Ficha Técnica (${form.ftCode})` : 'Nova Ficha Técnica (FT)'}
                                {currentMarketplace !== 'geral' && (
                                    <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full ml-2 uppercase">
                                        Override: {currentPlatform?.label}
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-3">
                                {!isEditing && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Código:</label>
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
                                            className="text-xs border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 font-medium py-1"
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
                                )}
                                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-3">
                            {/* Info Básica */}
                            <div className="space-y-2">
                                <div className="bg-indigo-50/20 px-3 py-2 rounded-xl border border-indigo-100/70 shadow-sm hover:shadow-md transition-all">
                                    <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Nome do Produto</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        readOnly={readOnly}
                                        className="w-full text-sm font-semibold text-gray-800 border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white/90 py-1 px-2.5 transition-colors"
                                        placeholder="Ex: Luminária X"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-indigo-50/20 px-3 py-2 rounded-xl border border-indigo-100/70 shadow-sm hover:shadow-md transition-all">
                                        <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Variação <span className="text-indigo-400 font-normal lowercase italic">(opcional)</span></label>
                                        <input
                                            type="text"
                                            value={form.variation}
                                            onChange={(e) => setForm({ ...form, variation: e.target.value })}
                                            readOnly={readOnly}
                                            className="w-full text-sm font-semibold text-gray-800 border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white/90 py-1 px-2.5 transition-colors"
                                            placeholder="Ex: Preto"
                                        />
                                    </div>
                                    <div className="bg-indigo-50/20 px-3 py-2 rounded-xl border border-indigo-100/70 shadow-sm hover:shadow-md transition-all">
                                        <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Tempo Prod. (min)</label>
                                        <input
                                            type="number"
                                            value={form.productionTime || ''}
                                            onChange={(e) => setForm({ ...form, productionTime: e.target.value })}
                                            readOnly={readOnly}
                                            className="w-full text-sm font-bold text-indigo-900 border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white/90 py-1 px-2.5 transition-colors"
                                            placeholder="Ex: 30"
                                            min="0"
                                        />
                                    </div>
                                    <div className="bg-indigo-50/20 px-3 py-2 rounded-xl border border-indigo-100/70 shadow-sm hover:shadow-md transition-all">
                                        <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Preço de Venda (R$)</label>
                                        <input
                                            type="number"
                                            value={form.salePrice || ''}
                                            onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })}
                                            readOnly={readOnly}
                                            className="w-full text-sm font-black text-indigo-900 border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white/90 py-1 px-2.5 transition-colors"
                                            placeholder="0,00"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {/* Margem de contribuição */}
                                <div className="p-3 bg-indigo-50/30 border border-indigo-100/80 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-inner">
                                    <div className="text-[11px] text-indigo-900">
                                        <span className="font-semibold block mb-0.5">Resumo da Margem de Contribuição:</span>
                                        Venda: R$ {(form.salePrice || 0).toFixed(2)} - Custos Totais: R$ {(totalMaterials + totalDirectRS + totalDirectPercentValue).toFixed(2)}
                                    </div>
                                    <div className="flex gap-4 text-right">
                                        <div>
                                            <span className="block text-[9px] text-indigo-600 font-medium">Margem (R$)</span>
                                            <span className={clsx("text-base font-bold", marginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                R$ {marginRS.toFixed(2)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] text-indigo-600 font-medium">Margem (%)</span>
                                            <span className={clsx("text-base font-bold", marginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {marginPercent.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 gap-4 border-b border-gray-100 pb-4">
                                <h3 className="text-sm font-bold text-gray-800">Composição de Custos</h3>
                                {!readOnly && (
                                    <div className="flex flex-wrap items-center gap-3">
                                        {costModels.length > 0 && (
                                            <select
                                                onChange={handleLoadCostModel}
                                                defaultValue=""
                                                disabled={readOnly}
                                                className="px-2 py-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
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
                                            className="px-2 py-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
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
                                        <h3 className="text-xs font-semibold text-gray-800">Materiais</h3>
                                        {!readOnly && (
                                            <div className="flex items-center gap-2">
                                                {costModels.filter(m => m.materials && m.materials.length > 0).length > 0 && (
                                                    <select
                                                        onChange={handleLoadMaterialsModel}
                                                        defaultValue=""
                                                        className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                                    >
                                                        <option value="" disabled>Carregar...</option>
                                                        {costModels.filter(m => m.materials && m.materials.length > 0).map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleSaveMaterialsModel}
                                                    className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                                                    title="Salvar apenas materiais como modelo"
                                                >
                                                    Salvar Modelo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenMaterialSelector}
                                                    className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 rounded hover:bg-indigo-100 transition-colors"
                                                >
                                                    Selecionar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addListItem('materials', { name: '', value: 0 })}
                                                    className="text-indigo-600 hover:text-indigo-800 p-1"
                                                    title="Adicionar Manual (Legado)"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {form.materials.map(item => {
                                            const parsed = parseMaterialName(item.name);
                                            if (parsed.config.isLegacy) {
                                                return (
                                                    <div key={item.id} className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="Material Manual"
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
                                                            <button type="button" onClick={() => removeListItem('materials', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            } else {
                                                let badgeText = '';
                                                if (parsed.config.type === 'sheet') {
                                                    badgeText = `${parsed.config.x} x ${parsed.config.y} cm`;
                                                } else if (parsed.config.type === 'linear') {
                                                    badgeText = `${parsed.config.length} cm`;
                                                } else if (parsed.config.type === 'unit') {
                                                    badgeText = `${parsed.config.quantity} un`;
                                                }

                                                return (
                                                    <div key={item.id} className="flex gap-2 items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-150 shadow-sm">
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span className="font-bold text-xs text-gray-800 truncate" title={parsed.name}>
                                                                {parsed.name}
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded self-start mt-0.5 border border-indigo-100/30">
                                                                {badgeText}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                                                                R$ {item.value.toFixed(2)}
                                                            </span>
                                                            {!readOnly && (
                                                                <button type="button" onClick={() => removeListItem('materials', item.id)} className="text-red-500 hover:text-red-700 p-1">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        })}
                                        {form.materials.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Nenhum material</p>}
                                    </div>
                                    <div className="mt-3 text-right text-xs font-semibold text-gray-700 pt-2 border-t border-gray-200">
                                        Total: R$ {totalMaterials.toFixed(2)}
                                    </div>
                                </div>

                                {/* Custo Direto R$ */}
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-semibold text-gray-800">Custos Diretos (R$)</h3>
                                        {!readOnly && (
                                            <div className="flex items-center gap-2">
                                                {costModels.filter(m => m.directCostsRS && m.directCostsRS.length > 0).length > 0 && (
                                                    <select
                                                        onChange={handleLoadDirectCostsRSModel}
                                                        defaultValue=""
                                                        className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                                    >
                                                        <option value="" disabled>Carregar...</option>
                                                        {costModels.filter(m => m.directCostsRS && m.directCostsRS.length > 0).map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleSaveDirectCostsRSModel}
                                                    className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                                                    title="Salvar apenas custos R$ como modelo"
                                                >
                                                    Salvar Modelo
                                                </button>
                                                <button onClick={() => addListItem('directCostsRS', { name: '', value: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
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
                                        <h3 className="text-xs font-semibold text-gray-800">Custos Diretos (%)</h3>
                                        {!readOnly && (
                                            <div className="flex items-center gap-2">
                                                {costModels.filter(m => m.directCostsPercent && m.directCostsPercent.length > 0).length > 0 && (
                                                    <select
                                                        onChange={handleLoadDirectCostsPercentModel}
                                                        defaultValue=""
                                                        className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                                    >
                                                        <option value="" disabled>Carregar...</option>
                                                        {costModels.filter(m => m.directCostsPercent && m.directCostsPercent.length > 0).map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleSaveDirectCostsPercentModel}
                                                    className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                                                    title="Salvar apenas custos % como modelo"
                                                >
                                                    Salvar Modelo
                                                </button>
                                                <button onClick={() => addListItem('directCostsPercent', { name: '', percentage: 0 })} className="text-indigo-600 hover:text-indigo-800 p-1">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
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

                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 sticky bottom-0 z-10 bg-white">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            {!readOnly && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || readOnly}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {isEditing ? 'Atualizar FT' : 'Salvar nova FT'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-modal de Seleção de Materiais */}
            {isMaterialSelectorOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMaterialSelectorOpen(false)}></div>

                    {/* Content */}
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[85vh] overflow-hidden z-10 flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    Selecionar Materiais Cadastrados
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Insira as medidas ou quantidades nos materiais desejados.</p>
                            </div>
                            <button onClick={() => setIsMaterialSelectorOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search bar */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/20 flex gap-4 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar material pelo nome..."
                                    value={materialSearchTerm}
                                    onChange={(e) => setMaterialSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                />
                            </div>
                            {materialSearchTerm && (
                                <button 
                                    onClick={() => setMaterialSearchTerm('')} 
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                >
                                    Limpar busca
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[300px]">
                            {/* Chapas Section */}
                            {sheetMaterials.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-1 flex items-center justify-between">
                                        <span>Chapas (por m²)</span>
                                        <span className="text-[10px] text-indigo-400 normal-case font-semibold">Largura x Altura em cm</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {sheetMaterials.map(mat => {
                                            const m = tempMeasurements[mat.id] || { x: '', y: '' };
                                            const cost = getTempCost(mat);
                                            const isSelected = parseFloat(m.x) > 0 && parseFloat(m.y) > 0;
                                            
                                            return (
                                                <div key={mat.id} className={clsx(
                                                    "flex items-center gap-3 p-3 rounded-xl border transition-all shadow-sm",
                                                    isSelected ? "bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-100" : "bg-white border-gray-200 hover:border-gray-300"
                                                )}>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs text-gray-800 truncate" title={mat.name}>{mat.name}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Ref: {mat.width}x{mat.height}cm • {mat.pricePerM2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <input 
                                                            type="number" 
                                                            placeholder="L (x)" 
                                                            value={m.x} 
                                                            onChange={e => handleTempMeasurementChange(mat.id, 'x', e.target.value)}
                                                            className="w-14 px-1.5 py-1 text-center text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none" 
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-bold">x</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="A (y)" 
                                                            value={m.y} 
                                                            onChange={e => handleTempMeasurementChange(mat.id, 'y', e.target.value)}
                                                            className="w-14 px-1.5 py-1 text-center text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none" 
                                                        />
                                                    </div>
                                                    <div className="w-20 text-right shrink-0">
                                                        <p className="text-xs font-bold text-gray-700">R$ {cost.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Linear Materials Section */}
                            {linearMaterials.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-1 flex items-center justify-between">
                                        <span>Material Linear</span>
                                        <span className="text-[10px] text-amber-400 normal-case font-semibold">Comprimento em centímetros</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {linearMaterials.map(mat => {
                                            const length = tempLinearLengths[mat.id] || '';
                                            const cost = getTempCost(mat);
                                            const isSelected = parseFloat(length) > 0;

                                            return (
                                                <div key={mat.id} className={clsx(
                                                    "flex items-center gap-3 p-3 rounded-xl border transition-all shadow-sm",
                                                    isSelected ? "bg-amber-50/40 border-amber-200 ring-1 ring-amber-100" : "bg-white border-gray-200 hover:border-gray-300"
                                                )}>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs text-gray-800 truncate" title={mat.name}>{mat.name}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Ref: {mat.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m</p>
                                                    </div>
                                                    <div className="shrink-0">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Comp.(cm)" 
                                                            value={length} 
                                                            onChange={e => handleTempLinearLengthChange(mat.id, e.target.value)}
                                                            className="w-20 px-1.5 py-1 text-center text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-400 outline-none" 
                                                        />
                                                    </div>
                                                    <div className="w-20 text-right shrink-0">
                                                        <p className="text-xs font-bold text-gray-700">R$ {cost.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Unit Materials Section */}
                            {unitMaterials.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-1 flex items-center justify-between">
                                        <span>Material por Unidade</span>
                                        <span className="text-[10px] text-emerald-400 normal-case font-semibold">Quantidade</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {unitMaterials.map(mat => {
                                            const qty = tempUnitQtys[mat.id] || '';
                                            const cost = getTempCost(mat);
                                            const isSelected = parseFloat(qty) > 0;

                                            return (
                                                <div key={mat.id} className={clsx(
                                                    "flex items-center gap-3 p-3 rounded-xl border transition-all shadow-sm",
                                                    isSelected ? "bg-emerald-50/40 border-emerald-200 ring-1 ring-emerald-100" : "bg-white border-gray-200 hover:border-gray-300"
                                                )}>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs text-gray-800 truncate" title={mat.name}>{mat.name}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Ref: {mat.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/un</p>
                                                    </div>
                                                    <div className="shrink-0">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Qtd." 
                                                            value={qty} 
                                                            onChange={e => handleTempUnitQtyChange(mat.id, e.target.value)}
                                                            className="w-20 px-1.5 py-1 text-center text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 outline-none" 
                                                        />
                                                    </div>
                                                    <div className="w-20 text-right shrink-0">
                                                        <p className="text-xs font-bold text-gray-700">R$ {cost.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {filteredMaterials.length === 0 && (
                                <div className="text-center py-12 text-gray-400 italic">
                                    Nenhum material encontrado com o termo "{materialSearchTerm}".
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm text-gray-700 font-medium">
                                Total Selecionado: <span className="text-lg font-black text-indigo-600">R$ {totalSelectedMaterialsCost.toFixed(2)}</span>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    onClick={() => setIsMaterialSelectorOpen(false)}
                                    className="flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmMaterials}
                                    className="flex-1 sm:flex-initial px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                                >
                                    <Check size={16} />
                                    Confirmar Materiais
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <th className="px-6 py-3 font-medium text-center whitespace-nowrap">Tempo Prod.</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Matérias (R$)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">C. Dir. R$ (Fixo)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">C. Dir. R$ (%)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Margem (R$)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Margem (%)</th>
                                    <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Venda (R$)</th>
                                    <th className="px-6 py-3 font-medium text-center whitespace-nowrap">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {fts.map((ft) => {
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
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-1 justify-center">
                                                    <input
                                                        type="number"
                                                        value={ft.productionTime ?? ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFts(prev => prev.map(item => item.id === ft.id ? { ...item, productionTime: val } : item));
                                                        }}
                                                        onBlur={async (e) => {
                                                            await handleInlineProductionTimeChange(ft, e.target.value);
                                                        }}
                                                        onKeyDown={async (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        disabled={readOnly}
                                                        className="w-16 text-center text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50 focus:bg-white border border-indigo-100 focus:border-indigo-300 rounded-lg py-1 px-1.5 focus:ring-1 focus:ring-indigo-300 transition-colors disabled:opacity-50"
                                                        placeholder="—"
                                                        min="0"
                                                    />
                                                    <span className="text-xs text-gray-500 font-medium">min</span>
                                                </div>
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
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-1 justify-end">
                                                    <span className="text-xs text-gray-500 font-medium">R$</span>
                                                    <div className="relative flex items-center">
                                                        <button
                                                            onClick={async () => {
                                                                const newVal = (parseFloat(ft.salePrice) || 0) - 1;
                                                                if (newVal >= 0) {
                                                                    setFts(prev => prev.map(item => item.id === ft.id ? { ...item, salePrice: newVal.toString() } : item));
                                                                    await handleInlineSalePriceChange(ft, newVal.toString());
                                                                }
                                                            }}
                                                            disabled={readOnly}
                                                            className="px-1.5 py-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-l transition-colors disabled:opacity-50 h-7 flex items-center justify-center cursor-pointer"
                                                            title="Diminuir R$ 1,00"
                                                        >
                                                            -1
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={ft.salePrice ?? ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setFts(prev => prev.map(item => item.id === ft.id ? { ...item, salePrice: val } : item));
                                                            }}
                                                            onBlur={async (e) => {
                                                                await handleInlineSalePriceChange(ft, e.target.value);
                                                            }}
                                                            onKeyDown={async (e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.target.blur();
                                                                }
                                                            }}
                                                            disabled={readOnly}
                                                            className="w-16 text-center text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50 focus:bg-white border-y border-x-0 border-indigo-100 focus:border-indigo-300 py-1 px-1 focus:ring-0 transition-colors disabled:opacity-50 h-7"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                const newVal = (parseFloat(ft.salePrice) || 0) + 1;
                                                                setFts(prev => prev.map(item => item.id === ft.id ? { ...item, salePrice: newVal.toString() } : item));
                                                                await handleInlineSalePriceChange(ft, newVal.toString());
                                                            }}
                                                            disabled={readOnly}
                                                            className="px-1.5 py-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-r transition-colors disabled:opacity-50 h-7 flex items-center justify-center cursor-pointer"
                                                            title="Aumentar R$ 1,00"
                                                        >
                                                            +1
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-1">
                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => handleCreateVariation(ft)}
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
