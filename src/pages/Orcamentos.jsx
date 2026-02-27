import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Receipt, ArrowLeft, Settings, DollarSign, Package, Percent, User, MapPin, Phone, FileText, Save, List, CheckCircle, XCircle, Clock, Eye, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

const TrendingUp = ({ size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
);

const Orcamentos = ({ materials, setMaterials }) => {
    const [view, setView] = useState('budget'); // 'budget' or 'register'
    const [markup, setMarkup] = useState('3');
    const [globalQty, setGlobalQty] = useState('1');
    const [nfPercentage, setNfPercentage] = useState('6');
    const [taxPercentage, setTaxPercentage] = useState('11');

    // Carregar materiais, configurações e orçamentos do servidor ao iniciar
    useEffect(() => {
        api.getSettings('lume_global_settings').then(settings => {
            if (settings) {
                if (settings.nfPercentage) setNfPercentage(settings.nfPercentage);
                if (settings.taxPercentage) setTaxPercentage(settings.taxPercentage);
            } else {
                // Fallback from old local storage
                const saved = localStorage.getItem('lume_global_settings');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setNfPercentage(parsed.nfPercentage || '6');
                    setTaxPercentage(parsed.taxPercentage || '11');
                }
            }
        });

        // As materiais e orçamentos já são iniciados em App.jsx,
        // mas as vezes as chamadas de refresh ficam espalhadas
        api.getMaterials().then(data => {
            if (data && data.length > 0) {
                // Ao carregar pela primeira vez, migrar ordem antiga se necessário
                const oldOrderStr = localStorage.getItem('materialsOrder');
                if (oldOrderStr) {
                    const oldOrder = JSON.parse(oldOrderStr);
                    // Se a maioria dos materiais estiver com sort_index = 0 ou nulo, aplica e limpa localStorage
                    const hasSortIndex = data.some(m => m.sortIndex > 0);
                    if (!hasSortIndex && oldOrder.length > 0) {
                        const migrated = data.map(m => {
                            const idx = oldOrder.indexOf(m.id);
                            return { ...m, sortIndex: idx !== -1 ? idx : 999999 };
                        });
                        api.updateMaterialsOrder(oldOrder.map(id => ({ id })));
                        setMaterials(migrated);
                        localStorage.removeItem('materialsOrder');
                        return;
                    }
                }
                setMaterials(data);
            }
        });
        api.getBudgets().then(data => {
            if (data) setSavedBudgets(data);
        });
    }, []);

    const saveGlobalSettings = async () => {
        await api.saveSettings('lume_global_settings', { nfPercentage, taxPercentage });
        alert('Configurações Globais salvas e sincronizadas com sucesso!');
    };

    const [discount, setDiscount] = useState('10');
    const [discountValue, setDiscountValue] = useState('0');
    const [itemName, setItemName] = useState('');
    const [budgetItems, setBudgetItems] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);
    const [savedBudgets, setSavedBudgets] = useState([]);

    const handleSaveBudget = async () => {
        if (budgetItems.length === 0) {
            alert("Adicione itens ao orçamento antes de salvar.");
            return;
        }
        if (!clientData.name) {
            alert("Preencha o nome do cliente.");
            return;
        }

        const newBudget = {
            date: new Date().toISOString(),
            clientData: { ...clientData },
            items: [...budgetItems],
            total: projectSubtotal,
            status: 'Aguardando'
        };

        const saved = await api.addBudget(newBudget);
        if (saved) {
            setSavedBudgets([saved, ...savedBudgets]);
            alert("Orçamento salvo com sucesso!");
        } else {
            // Fallback
            const fallback = { ...newBudget, id: Date.now() };
            const updated = [fallback, ...savedBudgets];
            setSavedBudgets(updated);
            alert("Erro ao salvar no servidor.");
        }
    };

    const handleDeleteBudget = async (id) => {
        if (confirm("Tem certeza que deseja excluir este orçamento?")) {
            await api.deleteBudget(id);
            setSavedBudgets(savedBudgets.filter(b => b.id !== id));
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        await api.updateBudget(id, { status: newStatus });
        setSavedBudgets(savedBudgets.map(b => b.id === id ? { ...b, status: newStatus } : b));
    };

    const handleLoadBudget = (budget) => {
        setClientData(budget.clientData);
        setBudgetItems(budget.items);
        setView('budget');
    };
    const [measurements, setMeasurements] = useState({});

    const [newMaterial, setNewMaterial] = useState({
        name: '', width: '', height: '', price: ''
    });

    const baseOrderedMaterials = [...materials].sort((a, b) => {
        const idxA = a.sortIndex ?? 999999;
        const idxB = b.sortIndex ?? 999999;
        // fallback por created_at se indices iguais
        if (idxA === idxB) {
            if (a.created_at && b.created_at) {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return 0;
        }
        return idxA - idxB;
    });

    const handleMoveMaterial = async (id, direction) => {
        const currentOrderMap = baseOrderedMaterials.map(m => m.id);
        const index = currentOrderMap.indexOf(id);
        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            const temp = currentOrderMap[index - 1];
            currentOrderMap[index - 1] = currentOrderMap[index];
            currentOrderMap[index] = temp;
        } else if (direction === 'down' && index < currentOrderMap.length - 1) {
            const temp = currentOrderMap[index + 1];
            currentOrderMap[index + 1] = currentOrderMap[index];
            currentOrderMap[index] = temp;
        }

        // Apply internally for immediate rendering
        const ordered = materials.map(m => {
            const idx = currentOrderMap.indexOf(m.id);
            return { ...m, sortIndex: idx !== -1 ? idx : 999999 };
        });

        setMaterials(ordered);

        // Async save
        await api.updateMaterialsOrder(currentOrderMap.map(mId => ({ id: mId })));
    };

    const sheetMaterials = baseOrderedMaterials.filter(m => !m.type || m.type === 'sheet');
    const linearMaterials = baseOrderedMaterials.filter(m => m.type === 'linear');
    const unitMaterials = baseOrderedMaterials.filter(m => m.type === 'unit');

    // Default global ordered array mapped to columns grouped essentially by category
    const orderedMaterials = [...sheetMaterials, ...linearMaterials, ...unitMaterials];

    const [newUnitMaterial, setNewUnitMaterial] = useState({ name: '', pricePerUnit: '' });
    const [newLinearMaterial, setNewLinearMaterial] = useState({ name: '', pricePerMeter: '' });

    // Quantities for unit and linear materials in the budget calculator
    const [unitQtys, setUnitQtys] = useState({});     // { [id]: qty }
    const [linearLengths, setLinearLengths] = useState({}); // { [id]: cm }

    // Editable Materials
    const [editingMaterialId, setEditingMaterialId] = useState(null);
    const [editMaterialData, setEditMaterialData] = useState({});

    const handleEditMaterial = (m) => {
        setEditingMaterialId(m.id);
        setEditMaterialData({
            name: m.name,
            width: m.width,
            height: m.height,
            price: m.price,
            pricePerM2: m.pricePerM2
        });
    };

    const handleCancelEdit = () => {
        setEditingMaterialId(null);
        setEditMaterialData({});
    };

    const handleSaveEdit = async (m) => {
        try {
            const payload = {
                name: editMaterialData.name,
                price: parseFloat(editMaterialData.price) || 0
            };
            if (m.type === 'unit') {
                payload.width = 0;
                payload.height = 0;
                payload.price_per_m2 = 0;
            } else if (m.type === 'linear') {
                payload.width = 0;
                payload.height = 1;
                payload.price_per_m2 = 0;
            } else {
                payload.width = parseFloat(editMaterialData.width) || 0;
                payload.height = parseFloat(editMaterialData.height) || 0;
                payload.price_per_m2 = (payload.price / ((payload.width * payload.height) / 10000)) || 0;
            }

            const updated = await api.updateMaterial(m.id, payload);
            if (updated) {
                setMaterials(prev => prev.map(item => item.id === m.id ? updated : item));
                setEditingMaterialId(null);
                setEditMaterialData({});
            } else {
                alert('Erro ao atualizar material no banco de dados.');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Erro ao atualizar material.');
        }
    };

    // Client Data
    const [clientData, setClientData] = useState({
        name: '',
        doc: '',
        address: '',
        number: '',
        neighborhood: '',
        city: '',
        zip: '',
        phone: '',
        email: ''
    });

    const LumeLogo = () => (
        <div className="flex flex-col items-center justify-center">
            <img src="/Logo%20LUME.png" alt="Logo LUME" className="h-60 object-contain" />
            <div className="text-center leading-none mt-1">
                <span className="block text-[10px] tracking-[0.2em] text-gray-700 font-bold">ACRÍLICOS | DESIGN DE PRODUTOS</span>
            </div>
        </div>
    );


    const handleAddMaterial = async (e) => {
        e.preventDefault();
        const w = parseFloat(newMaterial.width);
        const h = parseFloat(newMaterial.height);
        const p = parseFloat(newMaterial.price);

        if (!newMaterial.name || !w || !h || !p) return;

        const areaM2 = (w * h) / 10000;
        const pricePerM2 = p / areaM2;

        const materialToAdd = {
            name: newMaterial.name,
            width: w,
            height: h,
            price: p,
            pricePerM2: pricePerM2
        };

        const saved = await api.addMaterial(materialToAdd);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            // Fallback
            setMaterials([{ ...materialToAdd, id: Date.now() }, ...materials]);
        }
        setNewMaterial({ name: '', width: '', height: '', price: '' });
    };

    const handleDeleteMaterial = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
        }
    };

    const handleAddUnitMaterial = async (e) => {
        e.preventDefault();
        const p = parseFloat(newUnitMaterial.pricePerUnit);
        if (!newUnitMaterial.name || !p) return;
        const mat = { name: newUnitMaterial.name, price: p, type: 'unit' };

        const saved = await api.addMaterial(mat);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            setMaterials([{ ...mat, id: Date.now() }, ...materials]);
        }
        setNewUnitMaterial({ name: '', pricePerUnit: '' });
    };

    const handleDeleteUnitMaterial = async (id) => {
        if (window.confirm('Excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
            setUnitQtys(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const handleAddLinearMaterial = async (e) => {
        e.preventDefault();
        const p = parseFloat(newLinearMaterial.pricePerMeter);
        if (!newLinearMaterial.name || !p) return;
        const mat = { name: newLinearMaterial.name, price: p, type: 'linear' };

        const saved = await api.addMaterial(mat);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            setMaterials([{ ...mat, id: Date.now() }, ...materials]);
        }
        setNewLinearMaterial({ name: '', pricePerMeter: '' });
    };

    const handleDeleteLinearMaterial = async (id) => {
        if (window.confirm('Excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
            setLinearLengths(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const handleMeasurementChange = (id, field, value) => {
        setMeasurements(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || { x: '', y: '' }),
                [field]: value
            }
        }));
    };

    const calculateRow = (material) => {
        const m = measurements[material.id] || { x: '', y: '' };
        const x = parseFloat(m.x) || 0;
        const y = parseFloat(m.y) || 0;

        const areaM2 = (x * y) / 10000;
        const cost = areaM2 * material.pricePerM2;

        return { areaM2, cost };
    };

    // Unit material cost: qty * price
    const unitMaterialCostPerPiece = unitMaterials.reduce((sum, mat) => {
        const qty = parseFloat(unitQtys[mat.id]) || 0;
        return sum + qty * mat.price;
    }, 0);

    // Linear material cost: length (cm) / 100 * price
    const linearMaterialCostPerPiece = linearMaterials.reduce((sum, mat) => {
        const lengthCm = parseFloat(linearLengths[mat.id]) || 0;
        return sum + (lengthCm / 100) * mat.price;
    }, 0);

    // 1. Custo total de materiais para 1 peça
    const costPerPiece = sheetMaterials.reduce((sum, material) => {
        const { cost } = calculateRow(material);
        return sum + cost;
    }, 0) + unitMaterialCostPerPiece + linearMaterialCostPerPiece;

    // 2. Preço de venda unitário (Custo * Markup)
    const unitPrice = costPerPiece * (parseFloat(markup) || 1);

    // 3. Subtotal (Preço Unitário * Qtd Global)
    const subtotal = unitPrice * (parseFloat(globalQty) || 1);

    // 4. Adicionais
    const nfValue = subtotal * (parseFloat(nfPercentage) / 100);
    const taxValue = subtotal * (parseFloat(taxPercentage) / 100);

    // 5. Valor Final do Item Atual
    const currentItemPrice = subtotal + nfValue + taxValue;
    const baseUnitFinal = currentItemPrice / (parseFloat(globalQty) || 1);

    // O desconto em R$ abate do unitário final (afeta o carrinho e a base do %)
    const discountVal = parseFloat(discountValue) || 0;
    const finalUnitWithValueDiscount = Math.max(0, baseUnitFinal - discountVal);
    const finalTotalWithDiscount = finalUnitWithValueDiscount * (parseFloat(globalQty) || 1);

    // O desconto em % é apenas simulação visual sobre o unitário já com desconto em R$
    const discountPerc = parseFloat(discount) || 0;
    const visualUnitWithPercDiscount = Math.max(0, finalUnitWithValueDiscount * (1 - (discountPerc / 100)));
    const visualTotalWithPercDiscount = visualUnitWithPercDiscount * (parseFloat(globalQty) || 1);

    // 6. Cálculos do Projeto (Múltiplos Itens)
    const projectSubtotal = budgetItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const projectTotal = projectSubtotal;

    const totalMaterialCost = budgetItems.reduce((sum, item) => sum + (item.unitMaterialCost * item.quantity), 0);
    const totalTaxAndNfCost = budgetItems.reduce((sum, item) => {
        const itemTax = (item.unitTaxValue || 0) + (item.unitNfValue || 0);
        return sum + (itemTax * item.quantity);
    }, 0);
    const totalProjectProfit = projectTotal - totalMaterialCost - totalTaxAndNfCost;

    const handleAddItem = () => {
        if (!itemName) {
            alert('Por favor, dê um nome ao item (ex: Medalha).');
            return;
        }
        if (costPerPiece <= 0) {
            alert('Insira medidas para calcular o valor do item.');
            return;
        }

        const newItem = {
            id: editingItemId || Date.now(),
            name: itemName,
            unitPrice: finalUnitWithValueDiscount,
            unitNfValue: nfValue / (parseFloat(globalQty) || 1),
            unitTaxValue: taxValue / (parseFloat(globalQty) || 1),
            unitMaterialCost: costPerPiece,
            quantity: parseFloat(globalQty) || 1,
            originalSubtotal: subtotal + nfValue + taxValue,
            measurements: { ...measurements },
            unitQtys: { ...unitQtys },
            linearLengths: { ...linearLengths },
            discount: discount,
            discountValue: discountValue
        };

        if (editingItemId) {
            setBudgetItems(prev => prev.map(item => item.id === editingItemId ? newItem : item));
            setEditingItemId(null);
        } else {
            setBudgetItems([...budgetItems, newItem]);
        }

        // Reset builder fields
        setMeasurements({});
        setUnitQtys({});
        setLinearLengths({});
        setItemName('');
        setGlobalQty('1');
        setDiscount('10');
        setDiscountValue('0');
    };

    const handleEditItem = (item) => {
        setItemName(item.name);
        setGlobalQty(item.quantity.toString());
        setMeasurements(item.measurements || {});
        setUnitQtys(item.unitQtys || {});
        setLinearLengths(item.linearLengths || {});
        setDiscount(item.discount || '10');
        setDiscountValue(item.discountValue || '0');
        setEditingItemId(item.id);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRemoveItem = (id) => {
        if (window.confirm('Tem certeza que deseja excluir este item do orçamento?')) {
            setBudgetItems(budgetItems.filter(item => item.id !== id));
        }
    };

    const handleUpdateItemQty = (id, qty) => {
        setBudgetItems(budgetItems.map(item =>
            item.id === id ? { ...item, quantity: parseFloat(qty) || 0 } : item
        ));
    };

    const totalArea = sheetMaterials.reduce((sum, mat) => sum + calculateRow(mat).areaM2, 0);

    if (view === 'saved_list') {
        const getStatusColor = (status) => {
            switch (status) {
                case 'Aprovado': return 'bg-green-100 text-green-700 border-green-200';
                case 'Recusado': return 'bg-red-100 text-red-700 border-red-200';
                case 'Faturado': return 'bg-blue-100 text-blue-700 border-blue-200';
                default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            }
        };

        return (
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <button
                    onClick={() => setView('budget')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mb-6"
                >
                    <ArrowLeft size={20} /> Voltar para Orçamento
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <List className="text-indigo-600" /> Meus Orçamentos
                        </h2>
                        <span className="text-sm text-gray-500 font-bold">{savedBudgets.length} salvos</span>
                    </div>

                    {savedBudgets.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            <List size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhum orçamento salvo ainda.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Data</th>
                                        <th className="px-6 py-4 font-bold">Cliente</th>
                                        <th className="px-6 py-4 font-bold text-center">Itens</th>
                                        <th className="px-6 py-4 font-bold text-right">Total</th>
                                        <th className="px-6 py-4 font-bold text-center">Status</th>
                                        <th className="px-6 py-4 font-bold text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {savedBudgets.map(budget => (
                                        <tr key={budget.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(budget.date).toLocaleDateString()}
                                                <div className="text-xs text-gray-400">{new Date(budget.date).toLocaleTimeString().slice(0, 5)}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-800">{budget.clientData.name}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                                                    {budget.items.length}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-800">
                                                {budget.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {['Aguardando', 'Aprovado', 'Recusado', 'Faturado'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleUpdateStatus(budget.id, status)}
                                                            className={clsx(
                                                                "p-1.5 rounded-md transition-all",
                                                                budget.status === status
                                                                    ? getStatusColor(status) + " ring-1 ring-offset-1 ring-gray-200 scale-110 shadow-sm"
                                                                    : "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                                                            )}
                                                            title={status}
                                                        >
                                                            {status === 'Aprovado' && <CheckCircle size={16} />}
                                                            {status === 'Recusado' && <XCircle size={16} />}
                                                            {status === 'Aguardando' && <Clock size={16} />}
                                                            {status === 'Faturado' && <Receipt size={16} />}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={clsx("text-[10px] font-bold mt-1 uppercase",
                                                    budget.status === 'Aprovado' ? 'text-green-600' :
                                                        budget.status === 'Recusado' ? 'text-red-500' :
                                                            budget.status === 'Faturado' ? 'text-blue-600' : 'text-yellow-600'
                                                )}>
                                                    {budget.status}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleLoadBudget(budget)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ver / Editar"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBudget(budget.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (view === 'register') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('budget')}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-2xl font-bold text-gray-800">Cadastro de Configurações e Materiais</h2>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <Settings size={16} /> Configurações Globais
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 flex items-center gap-2 uppercase">Adicional NF (%)</label>
                            <input
                                type="number"
                                value={nfPercentage}
                                onChange={e => setNfPercentage(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 flex items-center gap-2 uppercase">Taxa Parcelamento (%)</label>
                            <input
                                type="number"
                                value={taxPercentage}
                                onChange={e => setTaxPercentage(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={saveGlobalSettings}
                                className="w-full xl:w-1/2 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold py-2 px-4 rounded-xl border border-indigo-200 transition-colors"
                            >
                                <Save size={18} /> Salvar Taxas Globais
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── CHAPAS ──────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Chapas — por m²
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome do Material</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Acrílico 2mm"
                                    value={newMaterial.name}
                                    onChange={e => setNewMaterial({ ...newMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Largura (cm)</label>
                                    <input type="number" placeholder="200" value={newMaterial.width}
                                        onChange={e => setNewMaterial({ ...newMaterial, width: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Altura (cm)</label>
                                    <input type="number" placeholder="100" value={newMaterial.height}
                                        onChange={e => setNewMaterial({ ...newMaterial, height: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Preço da Chapa (R$)</label>
                                <input type="number" step="0.01" placeholder="0,00" value={newMaterial.price}
                                    onChange={e => setNewMaterial({ ...newMaterial, price: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                            </div>
                            {newMaterial.width && newMaterial.height && newMaterial.price && (
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Custo por m²</p>
                                    <p className="text-xl font-black text-indigo-700">
                                        {(parseFloat(newMaterial.price) / ((parseFloat(newMaterial.width) * parseFloat(newMaterial.height)) / 10000)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            )}
                            <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                                <Plus size={20} /> Cadastrar Chapa
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-center">Chapa (cm)</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço/m²</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sheetMaterials.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50/50 group">
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex gap-1 justify-center items-center">
                                                            <input type="number" value={editMaterialData.width} onChange={e => setEditMaterialData({ ...editMaterialData, width: e.target.value })} className="w-12 px-1 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-center" />
                                                            <span className="text-gray-400">x</span>
                                                            <input type="number" value={editMaterialData.height} onChange={e => setEditMaterialData({ ...editMaterialData, height: e.target.value })} className="w-12 px-1 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-center" />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-20 px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm font-bold text-indigo-600 text-right" />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-gray-500">{m.width}x{m.height}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
                                                        {m.pricePerM2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} className="p-1 text-gray-400 hover:text-indigo-600" title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} className="p-1 text-gray-400 hover:text-indigo-600" title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-indigo-600" title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteMaterial(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {sheetMaterials.length === 0 && (
                                        <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400 italic">Nenhuma chapa cadastrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── POR UNIDADE ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddUnitMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
                            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Material — por Unidade
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Pino metálico"
                                    value={newUnitMaterial.name}
                                    onChange={e => setNewUnitMaterial({ ...newUnitMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Valor por Unidade (R$)</label>
                                <input
                                    type="number" step="0.01" placeholder="0,00"
                                    value={newUnitMaterial.pricePerUnit}
                                    onChange={e => setNewUnitMaterial({ ...newUnitMaterial, pricePerUnit: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                                <Plus size={20} /> Cadastrar
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço / Unidade</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {unitMaterials.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50/50 group">
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-24 px-2 py-1 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm font-bold text-emerald-600 text-right" />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                        {m.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} className="p-1 text-gray-400 hover:text-emerald-600" title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} className="p-1 text-gray-400 hover:text-emerald-600" title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-emerald-600" title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteUnitMaterial(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {unitMaterials.length === 0 && (
                                        <tr><td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">Nenhum material por unidade cadastrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── POR METRO LINEAR ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddLinearMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 space-y-4">
                            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Material — por Metro Linear
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Perfil de alumínio"
                                    value={newLinearMaterial.name}
                                    onChange={e => setNewLinearMaterial({ ...newLinearMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Valor por Metro Linear (R$)</label>
                                <input
                                    type="number" step="0.01" placeholder="0,00"
                                    value={newLinearMaterial.pricePerMeter}
                                    onChange={e => setNewLinearMaterial({ ...newLinearMaterial, pricePerMeter: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-100 flex items-center justify-center gap-2">
                                <Plus size={20} /> Cadastrar
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço / Metro Linear</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {linearMaterials.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50/50 group">
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-24 px-2 py-1 border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm font-bold text-amber-600 text-right" />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-amber-600">
                                                        {m.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} className="p-1 text-gray-400 hover:text-amber-600" title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} className="p-1 text-gray-400 hover:text-amber-600" title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-amber-600" title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteLinearMaterial(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {linearMaterials.length === 0 && (
                                        <tr><td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">Nenhum material por metro linear cadastrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Print Layout - A4 Optimized */}
            <style>
                {`
                    @media print {
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            margin: 0;
                            background-color: white;
                            color: #334155;
                        }
                        .print-container {
                            padding: 15mm 15mm;
                        }
                    }
                    .print-table th, .print-table td {
                        border-bottom: 0.5pt solid #e2e8f0;
                        padding: 10px 4px;
                        border-left: none;
                        border-right: none;
                        border-top: none;
                    }
                    .print-table th {
                        border-bottom: 1pt solid #0f172a;
                        color: #475569;
                    }
                    .print-table {
                        border-collapse: collapse;
                        width: 100%;
                    }
                    .section-title {
                        font-size: 8px;
                        font-weight: 800;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        margin-bottom: 8px;
                        border-bottom: 0.5pt solid #cbd5e1;
                        padding-bottom: 4px;
                    }
                `}
            </style>
            <div className="hidden print:block print-container bg-white text-black font-sans leading-tight text-[11px] max-w-[210mm] mx-auto">

                {/* HEAD - Split Layout (Logo Left / Data Right) */}
                <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-50">
                    <div className="flex-1">
                        <img src="/Logo%20LUME.png" alt="Logo LUME" className="h-40 object-contain" />
                    </div>
                    <div className="flex-1 text-right">
                        <h1 className="text-2xl font-light text-slate-800 tracking-tight mb-2">PROPOSTA COMERCIAL</h1>
                        <div className="text-[9px] text-slate-600 space-y-0.5 leading-relaxed">
                            <p className="font-bold text-slate-800 text-xs mb-1">{new Date().toLocaleDateString('pt-BR')}</p>
                            <p className="font-bold text-slate-800 uppercase">MATEU ACRILICOS E MARCENARIA INDUSTRIA E COMERCIO LTDA.</p>
                            <p>CNPJ: 66.022.922/0001-08</p>
                            <p>Rua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba – SP</p>
                            <p>CEP: 13.347-458 | WhatsApp: (19) 99916-2239</p>
                        </div>
                    </div>
                </div>

                {/* DADOS CLIENTE */}
                <div className="mb-6">
                    <div className="section-title">Informações do Cliente</div>
                    <div className="grid grid-cols-4 gap-y-4">
                        <div className="col-span-2">
                            <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Nome / Razão Social</span>
                            <span className="text-xs font-bold text-slate-800 uppercase">{clientData.name}</span>
                        </div>
                        <div>
                            <span className="text-[8px] uppercase text-slate-500 block mb-0.5">CPF / CNPJ</span>
                            <span className="text-xs text-slate-800">{clientData.doc}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Telefone</span>
                            <span className="text-xs text-slate-800">{clientData.phone}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Email</span>
                            <span className="text-xs text-slate-800">{clientData.email || '-'}</span>
                        </div>
                        <div className="col-span-2 text-right">
                            <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Endereço</span>
                            <span className="text-xs text-slate-800">{clientData.address}{clientData.number ? `, ${clientData.number}` : ''} - {clientData.neighborhood}</span>
                        </div>
                    </div>
                </div>

                {/* ITENS */}
                <div className="mb-4 min-h-[150px]">
                    <div className="section-title">Descrição dos Serviços</div>
                    <table className="print-table w-full">
                        <thead>
                            <tr>
                                <th className="w-12 text-center text-[8px] uppercase tracking-widest">Qtd</th>
                                <th className="text-left text-[8px] uppercase tracking-widest pl-4">Item / Descrição</th>
                                <th className="w-28 text-right text-[8px] uppercase tracking-widest">Unitário</th>
                                <th className="w-28 text-right text-[8px] uppercase tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-600">
                            {budgetItems.map(item => (
                                <tr key={item.id}>
                                    <td className="text-center font-bold">{item.quantity}</td>
                                    <td className="uppercase px-2 text-slate-800 font-bold">{item.name}</td>
                                    <td className="text-right text-slate-800">R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="text-right font-black text-slate-900">R$ {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {/* Fill Empty Rows */}
                            {Array.from({ length: Math.max(0, 5 - budgetItems.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="h-6">
                                    <td className="border-b border-slate-200"></td>
                                    <td className="border-b border-slate-200"></td>
                                    <td className="border-b border-slate-200"></td>
                                    <td className="border-b border-slate-200"></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="2" className="border-none"></td>
                                <td className="text-slate-600 font-bold text-right py-6 uppercase text-[8px] tracking-[0.2em] border-none">Total da Proposta</td>
                                <td className="font-black text-2xl text-right text-slate-900 py-6 border-none whitespace-nowrap">
                                    R$ {projectTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* PAGAMENTOS, PRAZO E DADOS BANCÁRIOS */}
                <div className="grid grid-cols-12 gap-12 mt-4">
                    {/* Coluna Esquerda: Pagamento */}
                    <div className="col-span-8">
                        <div className="section-title">Condições de Pagamento</div>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                                <div>
                                    <span className="text-[10px] font-black text-slate-800 block uppercase">À Vista (PIX ou Transferência)</span>
                                    <span className="text-[9px] text-green-700 font-bold uppercase tracking-wide">Benefício de 10% de desconto aplicado</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-slate-900">R$ {(projectTotal * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <div className="text-[10px] text-green-700 uppercase mt-1 leading-tight text-right font-bold">
                                        Sinal 50% (R$ {((projectTotal * 0.9) / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) <br />
                                        + Saldo na Retirada (R$ {((projectTotal * 0.9) / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-black text-slate-800 block uppercase">Cartão de Crédito</span>
                                    <span className="text-[9px] text-slate-600 font-bold uppercase">Parcelamento padrão sem descontos</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-slate-900">6x de R$ {(projectTotal / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">Sem juros no cartão</div>
                                </div>
                            </div>
                        </div>

                        <div className="section-title mt-4">Dados Bancários / Pagamento</div>
                        <div className="flex gap-8">
                            <div className="flex-1">
                                <span className="text-[8px] uppercase text-slate-600 font-bold block mb-0.5">Banco Itaú</span>
                                <div className="text-[10px] text-slate-800 space-y-1">
                                    <p><span className="font-black">Ag:</span> 5396</p>
                                    <p><span className="font-black">Cc:</span> 97680-4</p>
                                </div>
                            </div>
                            <div className="flex-1">
                                <span className="text-[8px] uppercase text-slate-600 font-bold block mb-0.5">Transferência PIX</span>
                                <div className="text-[10px] text-slate-800">
                                    <p className="font-black text-slate-900">comercial@lumeacrilicos.com.br</p>
                                    <p className="text-[8px] opacity-90 mt-1 font-bold uppercase">MATEU ACRILICOS E MARCENARIA LTDA.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita: Prazo */}
                    <div className="col-span-4 flex flex-col pt-2">
                        <div className="border-l border-slate-300 pl-6 h-full flex flex-col justify-start">
                            <div className="section-title border-none mb-4 text-slate-600 font-bold">Prazo de Produção</div>
                            <div className="text-3xl font-black text-slate-900 leading-none">10</div>
                            <div className="text-[10px] font-bold text-slate-600 uppercase mt-1 tracking-widest">Dias Úteis</div>
                            <div className="text-[11px] italic text-slate-700 mt-4 leading-relaxed font-medium">
                                Prazo estimado contado a partir da aprovação do orçamento e confirmação do sinal.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer simple */}
                <div className="mt-8 text-center text-xs text-slate-600 font-bold border-t border-slate-300 pt-2">
                    Orçamento válido por 7 dias.
                </div>
            </div>



            {/* Application UI */}
            <div className="space-y-6 pb-20 print:hidden">
                {/* Client Data Form (Collapsible or Block) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <User size={16} /> Dados do Cliente (Para Impressão)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        <input
                            type="text"
                            placeholder="Nome Completo"
                            value={clientData.name}
                            onChange={e => setClientData({ ...clientData, name: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="CPF / CNPJ"
                            value={clientData.doc}
                            onChange={e => setClientData({ ...clientData, doc: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Telefone"
                            value={clientData.phone}
                            onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Endereço"
                            value={clientData.address}
                            onChange={e => setClientData({ ...clientData, address: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Cidade"
                            value={clientData.city}
                            onChange={e => setClientData({ ...clientData, city: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="CEP"
                            value={clientData.zip}
                            onChange={e => setClientData({ ...clientData, zip: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Número"
                            value={clientData.number}
                            onChange={e => setClientData({ ...clientData, number: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Bairro"
                            value={clientData.neighborhood}
                            onChange={e => setClientData({ ...clientData, neighborhood: e.target.value })}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <input
                            type="email"
                            placeholder="E-mail"
                            value={clientData.email}
                            onChange={e => setClientData({ ...clientData, email: e.target.value })}
                            className="lg:col-span-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Receipt size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Cálculo de Orçamentos</h2>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setView('saved_list')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                            <List size={18} /> Orçamentos Prontos
                        </button>
                        <button
                            onClick={() => setView('register')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <Settings size={18} /> Cadastro de Materiais
                        </button>
                    </div>
                </div>

                {/* Global Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Package size={14} className="text-indigo-500" /> Nome do Item
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Medalha"
                            value={itemName}
                            onChange={e => setItemName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Plus size={14} className="text-indigo-500" /> Qtd Item
                        </label>
                        <input
                            type="number"
                            value={globalQty}
                            onChange={e => setGlobalQty(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={14} className="text-orange-500" /> Multiplicador
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={markup}
                            onChange={e => setMarkup(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2"></div>
                </div>

                {/* Budget Spreadsheet Table - TWO COLUMNS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[
                        [...orderedMaterials].slice(0, Math.ceil(orderedMaterials.length / 2)),
                        [...orderedMaterials].slice(Math.ceil(orderedMaterials.length / 2))
                    ].map((colMaterials, colIdx) => (
                        <div key={`col-${colIdx}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden self-start">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-indigo-600 text-white">
                                        <th className="px-3 py-1.5 text-[11px] font-bold uppercase" rowSpan="2">Serviços / Materiais</th>
                                        <th className="px-2 py-1.5 text-[10px] font-bold uppercase text-center border-l border-indigo-500" colSpan="2">Centímetros</th>
                                        <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-right border-l border-indigo-500 pr-4" rowSpan="2">Custo (1 pç)</th>
                                    </tr>
                                    <tr className="bg-indigo-500 text-white">
                                        <th className="px-1 py-1 text-[9px] font-bold uppercase text-center border-l border-indigo-400 w-1/5">x</th>
                                        <th className="px-1 py-1 text-[9px] font-bold uppercase text-center border-l border-indigo-400 w-1/5">y</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {colMaterials.map(mat => {
                                        if (!mat.type || mat.type === 'sheet') {
                                            const { areaM2, cost } = calculateRow(mat);
                                            const m = measurements[mat.id] || { x: '', y: '' };
                                            return (
                                                <tr key={mat.id} className="hover:bg-indigo-50/30 transition-colors">
                                                    <td className="px-3 py-1 text-[11px] font-bold text-gray-700 bg-gray-50/50">{mat.name}</td>
                                                    <td className="px-1 py-1 border-l border-gray-100">
                                                        <input type="number" value={m.x} onChange={e => handleMeasurementChange(mat.id, 'x', e.target.value)}
                                                            placeholder="0" className="w-full px-1 py-0.5 text-center text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none" />
                                                    </td>
                                                    <td className="px-1 py-1 border-l border-gray-100">
                                                        <input type="number" value={m.y} onChange={e => handleMeasurementChange(mat.id, 'y', e.target.value)}
                                                            placeholder="0" className="w-full px-1 py-0.5 text-center text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-gray-800 text-[11px] pr-4">
                                                        {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                </tr>
                                            );
                                        } else if (mat.type === 'unit') {
                                            const qty = parseFloat(unitQtys[mat.id]) || 0;
                                            const cost = qty * mat.price;
                                            return (
                                                <tr key={mat.id} className="hover:bg-emerald-50/30 transition-colors">
                                                    <td className="px-3 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50/30">
                                                        {mat.name} <span className="text-[9px] font-normal text-emerald-500 ml-1">(unid)</span>
                                                    </td>
                                                    <td className="px-1 py-1 border-l border-gray-100" colSpan="2">
                                                        <input type="number" value={unitQtys[mat.id] || ''}
                                                            onChange={e => setUnitQtys(prev => ({ ...prev, [mat.id]: e.target.value }))}
                                                            placeholder="Qtd" className="w-full px-1 py-0.5 text-center text-[11px] border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-emerald-700 text-[11px] pr-4">
                                                        {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            const lengthCm = parseFloat(linearLengths[mat.id]) || 0;
                                            const cost = (lengthCm / 100) * mat.price;
                                            return (
                                                <tr key={mat.id} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="px-3 py-1 text-[11px] font-bold text-amber-700 bg-amber-50/30">
                                                        {mat.name} <span className="text-[9px] font-normal text-amber-500 ml-1">(m linear)</span>
                                                    </td>
                                                    <td className="px-1 py-1 border-l border-gray-100" colSpan="2">
                                                        <input type="number" value={linearLengths[mat.id] || ''}
                                                            onChange={e => setLinearLengths(prev => ({ ...prev, [mat.id]: e.target.value }))}
                                                            placeholder="Comp(cm)" className="w-full px-1 py-0.5 text-center text-[11px] border border-amber-200 rounded focus:ring-1 focus:ring-amber-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-amber-700 text-[11px] pr-4">
                                                        {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    })}
                                    {colMaterials.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-3 py-6 text-[11px] text-center text-gray-400 italic">
                                                Nenhum material localizado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                <div className="mt-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Total Custos Por Item (1 Unid.)</span>
                    <span className="text-xl font-black text-indigo-700">
                        {costPerPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>

                {/* Results and Detail Section */}
                {(costPerPiece > 0 || budgetItems.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {costPerPiece > 0 && (
                            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Resumo do Item Atual</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase border-b pb-2 mb-2">
                                        <span className="w-1/3">Descrição</span>
                                        <span className="w-1/3 text-center">Unitário</span>
                                        <span className="w-1/3 text-right">Total</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Custo Material:</span>
                                        <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{costPerPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="w-1/3 text-right font-bold text-gray-700">{(costPerPiece * (parseFloat(globalQty) || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Adicional NF ({nfPercentage}%):</span>
                                        <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice * (parseFloat(nfPercentage) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="w-1/3 text-right font-bold text-red-500">+{nfValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Parcelam. ({taxPercentage}%):</span>
                                        <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice * (parseFloat(taxPercentage) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="w-1/3 text-right font-bold text-red-500">+{taxValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Lucro Estimado:</span>
                                        <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice - costPerPiece).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="w-1/3 text-right font-bold text-green-600">
                                            {(subtotal - (costPerPiece * (parseFloat(globalQty) || 1))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px] bg-gray-50 p-2 rounded-lg mt-1 border border-gray-100">
                                        <span className="w-1/3 text-indigo-700 uppercase text-[10px] font-black truncate pr-1">UNITÁRIO FINAL:</span>
                                        <span className="w-1/3 text-center font-bold text-indigo-600">{finalUnitWithValueDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="w-1/3 text-right font-black text-indigo-700 text-[15px]">
                                            {finalTotalWithDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    {parseFloat(discount) > 0 && (
                                        <div className="flex justify-between items-center text-[13px] bg-green-50 p-2 rounded-lg mt-1 border border-green-100">
                                            <span className="w-1/3 text-green-700 uppercase text-[10px] font-black truncate pr-1">SIMULAÇÃO ({discount}%):</span>
                                            <span className="w-1/3 text-center font-bold text-green-600">
                                                {visualUnitWithPercDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            <span className="w-1/3 text-right font-black text-green-700 text-[15px]">
                                                {visualTotalWithPercDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="h-px bg-gray-100 mt-2"></div>
                                    <div className="flex justify-between items-center py-1 mt-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Quantidade do Item:</span>
                                        <input
                                            type="number"
                                            value={globalQty}
                                            onChange={e => setGlobalQty(e.target.value)}
                                            className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                            min="1"
                                        />
                                    </div>
                                    <div className="h-px bg-gray-100 italic font-medium text-[9px] text-gray-400 text-center py-2 mt-2">Aplicação de Desconto</div>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <Percent size={12} className="text-red-500" /> Desconto (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={discount}
                                                onChange={e => setDiscount(e.target.value)}
                                                className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-right text-xs font-bold text-gray-700 focus:ring-2 focus:ring-red-400 outline-none shadow-sm"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <DollarSign size={12} className="text-red-500" /> Desconto (R$)
                                            </label>
                                            <input
                                                type="number"
                                                value={discountValue}
                                                step="0.01"
                                                onChange={e => setDiscountValue(e.target.value)}
                                                className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-right text-xs font-bold text-gray-700 focus:ring-2 focus:ring-red-400 outline-none shadow-sm"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="lg:col-span-2 flex flex-col justify-center items-center gap-4 p-4 md:p-8">
                            <button
                                onClick={handleAddItem}
                                className="w-full md:w-2/3 lg:w-1/2 py-5 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 transform hover:scale-[1.02] border-2 border-indigo-500/20"
                            >
                                {editingItemId ? <Save size={24} /> : <Plus size={24} />}
                                {editingItemId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR AO ORÇAMENTO'}
                            </button>
                            <button
                                onClick={() => {
                                    setMeasurements({});
                                    setUnitQtys({});
                                    setLinearLengths({});
                                    setGlobalQty('1');
                                    setItemName('');
                                    setDiscount('10');
                                    setDiscountValue('0');
                                    setEditingItemId(null);
                                    setBudgetItems([]);
                                }}
                                className="w-full md:w-2/3 lg:w-1/2 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-bold transition-colors text-center shadow-sm hover:shadow-md"
                            >
                                Reiniciar Orçamento
                            </button>
                        </div>

                        {/* Final Budget Items Table */}
                        {budgetItems.length > 0 && (
                            <div className="lg:col-span-3 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Receipt size={20} className="text-indigo-600" /> Itens do Orçamento
                                    </h3>
                                    <div className="bg-indigo-50 px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100">
                                        {budgetItems.length} {budgetItems.length === 1 ? 'Item' : 'Itens'}
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Item</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-center">Quantidade</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Unitário (c/ encargos)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total Item</th>
                                                <th className="px-6 py-4 text-center w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {budgetItems.map(item => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => handleEditItem(item)}>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{item.name}</td>
                                                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={e => handleUpdateItemQty(item.id, e.target.value)}
                                                            className="w-20 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                        {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-indigo-600 text-lg">
                                                        {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center flex justify-center items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}
                                                            className="p-2 text-gray-300 hover:text-indigo-500 transition-colors"
                                                            title="Editar item"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                            title="Remover item"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-white">
                                            <tr>
                                                <td colSpan="5" className="p-0 border-t border-gray-100">
                                                    <div className="bg-indigo-600 p-8 text-white w-full rounded-b-2xl shadow-inner flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                        <div className="text-center md:text-left">
                                                            <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Valor Total do Pedido</p>
                                                            <h2 className="text-5xl md:text-6xl font-black mt-2">
                                                                {projectTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </h2>
                                                            <div className="flex flex-wrap gap-4 mt-6">
                                                                <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                    <p className="text-[10px] text-indigo-200 uppercase font-black">Total Mat. Gasto</p>
                                                                    <p className="text-lg font-bold text-white">
                                                                        {totalMaterialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                    <p className="text-[10px] text-indigo-200 uppercase font-black">Impostos / NF</p>
                                                                    <p className="text-lg font-bold text-white">
                                                                        {totalTaxAndNfCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-white/20 px-4 py-2 rounded-xl border border-indigo-400/30">
                                                                    <p className="text-[10px] text-indigo-100 uppercase font-black">Lucro Estimado</p>
                                                                    <p className="text-lg font-bold text-green-300">
                                                                        {totalProjectProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-3">
                                                            <button
                                                                onClick={handleSaveBudget}
                                                                className="w-full px-8 py-4 bg-green-500 text-white rounded-2xl text-lg font-bold shadow-[0_10px_20px_rgba(34,197,94,0.3)] hover:bg-green-600 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                                                            >
                                                                <Save size={24} /> SALVAR ORÇAMENTO
                                                            </button>
                                                            <button
                                                                onClick={() => window.print()}
                                                                className="w-full px-8 py-3 bg-white text-indigo-900 rounded-xl text-sm font-bold shadow hover:bg-gray-100 transition-all flex items-center justify-center gap-2 border border-gray-200 hover:shadow-md"
                                                            >
                                                                <DollarSign size={20} /> IMPRIMIR PDF / RECIBO
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!costPerPiece && materials.length > 0 && (
                    <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center bg-gray-50/30">
                        <p className="text-gray-400 font-medium">Insira as medidas nos materiais acima para calcular o orçamento inicial.</p>
                    </div>
                )}
            </div >
        </>
    );
};

export default Orcamentos;
