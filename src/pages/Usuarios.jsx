import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Edit2, Trash2, Shield, Save, X, Eye, Edit3, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const MODULES = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'whatsapp', label: 'WhatsApp Lume' },
    { id: 'agenda', label: 'Agenda Lume' },
    { id: 'vendas', label: 'Entradas/Vendas' },
    { 
        id: 'saida', 
        label: 'Saídas / Despesas',
        subModules: [
            { id: 'fixos', label: 'Gastos Fixos' },
            { id: 'mercado', label: 'Gastos Extras' },
            { id: 'fornecedores', label: 'Fornecedores' },
            { id: 'retirada', label: 'Retirada de Sócios' },
            { id: 'acerto_socios', label: 'Acerto Sócios' }
        ]
    },
    { id: 'orcamentos', label: 'Orçamentos' },
    { id: 'contas', label: 'Produção / Contas' },
    { id: 'compras', label: 'Compras' },
    { id: 'estudo_produtos', label: 'Estudo de Produtos' },
    { id: 'tarefas', label: 'Tarefas' },
    { id: 'funcionarios', label: 'Funcionários' },
    { 
        id: 'ecommerce', 
        label: 'E-Commerce / Marketplaces',
        subModules: [
            { id: 'visao_geral', label: 'Visão Geral' },
            { id: 'empresas_custos', label: 'Empresas e Custos' },
            { id: 'marketplaces', label: 'Marketplaces (Vendas / FTs)' },
            { id: 'cadastros_fts', label: 'Cadastros de FTs' },
            { id: 'parcerias', label: 'Parcerias' },
            { id: 'relatorio', label: 'Gerar Relatório PDF' },
            { id: 'auditoria_ads', label: 'Auditoria Ads' }
        ]
    },
    { id: 'precificacao', label: 'Precificação' }
];

export default function Usuarios() {
    const { usersList, saveUsersList, currentUser } = useAuth();
    const [editingUser, setEditingUser] = useState(null);
    const [expandedModules, setExpandedModules] = useState(['ecommerce']);

    const toggleExpandModule = (modId) => {
        setExpandedModules(prev =>
            prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
        );
    };

    // Form state
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        login: '',
        password: '',
        visibleTabs: [],
        editableTabs: [],
        visibleSubTabs: {},
        editableSubTabs: {},
        canExportImport: false
    });

    const handleNewUser = () => {
        setFormData({
            id: Date.now(),
            name: '',
            login: '',
            password: '',
            visibleTabs: [],
            editableTabs: [],
            visibleSubTabs: {},
            editableSubTabs: {},
            canExportImport: false
        });
        setEditingUser('new');
        setExpandedModules(['ecommerce']);
    };

    const handleEditUser = (user) => {
        const perms = user.customPermissions || {
            visibleTabs: [],
            editableTabs: [],
            visibleSubTabs: {},
            editableSubTabs: {},
            canExportImport: false
        };
        
        let defaultVisible = [];
        let defaultEditable = [];
        let defaultVisibleSub = {};
        let defaultEditableSub = {};
        let defaultExport = false;
        
        if (!user.customPermissions) {
            if (user.role === 'admin') {
                defaultVisible = MODULES.map(m => m.id);
                defaultEditable = MODULES.map(m => m.id);
                MODULES.forEach(m => {
                    if (m.subModules) {
                        defaultVisibleSub[m.id] = m.subModules.map(s => s.id);
                        defaultEditableSub[m.id] = m.subModules.map(s => s.id);
                    }
                });
                defaultExport = true;
            } else if (user.role === 'editor') {
                defaultVisible = MODULES.map(m => m.id);
                defaultEditable = ['orcamentos', 'contas', 'tarefas', 'precificacao'];
                MODULES.forEach(m => {
                    if (m.subModules) {
                        defaultVisibleSub[m.id] = m.subModules.map(s => s.id);
                        defaultEditableSub[m.id] = [];
                    }
                });
            } else if (user.role === 'budget_only') {
                defaultVisible = ['orcamentos', 'contas'];
                defaultEditable = ['orcamentos', 'contas'];
            } else if (user.role === 'producao_only') {
                defaultVisible = ['contas'];
                defaultEditable = ['contas'];
            } else if (user.role === 'simulacao_only') {
                defaultVisible = ['precificacao', 'agenda'];
                defaultEditable = ['precificacao', 'agenda'];
            }
        } else {
            defaultVisible = perms.visibleTabs || [];
            defaultEditable = perms.editableTabs || [];
            defaultVisibleSub = { ...(perms.visibleSubTabs || {}) };
            defaultEditableSub = { ...(perms.editableSubTabs || {}) };
            defaultExport = perms.canExportImport || false;

            // Se o módulo pai está visível/editável mas ainda não tem sub-permissões gravadas, pré-carrega todas
            MODULES.forEach(m => {
                if (m.subModules) {
                    if (defaultVisible.includes(m.id) && !defaultVisibleSub[m.id]) {
                        defaultVisibleSub[m.id] = m.subModules.map(s => s.id);
                    }
                    if (defaultEditable.includes(m.id) && !defaultEditableSub[m.id]) {
                        defaultEditableSub[m.id] = m.subModules.map(s => s.id);
                    }
                }
            });
        }

        setFormData({
            id: user.id,
            name: user.name,
            login: user.login,
            password: user.password,
            visibleTabs: defaultVisible,
            editableTabs: defaultEditable,
            visibleSubTabs: defaultVisibleSub,
            editableSubTabs: defaultEditableSub,
            canExportImport: defaultExport
        });
        setEditingUser(user.id);
        setExpandedModules(['ecommerce']);
    };

    const handleDeleteUser = async (user) => {
        if (user.login === 'dsmateu') {
            alert('Não é possível excluir o administrador principal.');
            return;
        }
        if (user.id === currentUser.id) {
            alert('Não é possível excluir o próprio usuário logado.');
            return;
        }
        if (window.confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
            const newList = usersList.filter(u => u.id !== user.id);
            await saveUsersList(newList);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.login || !formData.password) {
            alert('Preencha nome, login e senha.');
            return;
        }

        const userObj = {
            id: formData.id,
            name: formData.name,
            login: formData.login,
            password: formData.password,
            role: 'custom', // We force role to custom so it uses customPermissions
            customPermissions: {
                visibleTabs: formData.visibleTabs,
                editableTabs: formData.editableTabs,
                visibleSubTabs: formData.visibleSubTabs,
                editableSubTabs: formData.editableSubTabs,
                canExportImport: formData.canExportImport
            }
        };

        // If editing an existing 'dsmateu', preserve role='admin' just in case
        if (userObj.login === 'dsmateu') {
            userObj.role = 'admin';
        }

        let newList = [...usersList];
        if (editingUser === 'new') {
            // Check if login exists
            if (newList.find(u => u.login === formData.login)) {
                alert('Esse login já existe!');
                return;
            }
            newList.push(userObj);
        } else {
            const index = newList.findIndex(u => u.id === formData.id);
            if (index >= 0) {
                // Check if login exists in another user
                if (newList.find(u => u.login === formData.login && u.id !== formData.id)) {
                    alert('Esse login já está sendo usado por outro usuário!');
                    return;
                }
                newList[index] = userObj;
            }
        }

        await saveUsersList(newList);
        setEditingUser(null);
    };

    const togglePermission = (moduleId, type) => {
        setFormData(prev => {
            let vis = [...prev.visibleTabs];
            let edi = [...prev.editableTabs];
            let visSub = { ...prev.visibleSubTabs };
            let ediSub = { ...prev.editableSubTabs };

            const modConfig = MODULES.find(m => m.id === moduleId);

            if (type === 'view') {
                if (vis.includes(moduleId)) {
                    vis = vis.filter(id => id !== moduleId);
                    // If removing view, remove edit too
                    edi = edi.filter(id => id !== moduleId);
                    delete visSub[moduleId];
                    delete ediSub[moduleId];
                } else {
                    vis.push(moduleId);
                    if (modConfig?.subModules) {
                        visSub[moduleId] = modConfig.subModules.map(s => s.id);
                    }
                }
            } else if (type === 'edit') {
                if (edi.includes(moduleId)) {
                    edi = edi.filter(id => id !== moduleId);
                    delete ediSub[moduleId];
                } else {
                    edi.push(moduleId);
                    // If adding edit, add view too
                    if (!vis.includes(moduleId)) vis.push(moduleId);
                    if (modConfig?.subModules) {
                        ediSub[moduleId] = modConfig.subModules.map(s => s.id);
                        if (!visSub[moduleId]) {
                            visSub[moduleId] = modConfig.subModules.map(s => s.id);
                        }
                    }
                }
            }

            return {
                ...prev,
                visibleTabs: vis,
                editableTabs: edi,
                visibleSubTabs: visSub,
                editableSubTabs: ediSub
            };
        });
    };

    const toggleSubPermission = (moduleId, subId, type) => {
        setFormData(prev => {
            let vis = [...prev.visibleTabs];
            let edi = [...prev.editableTabs];
            let visSub = { ...prev.visibleSubTabs };
            let ediSub = { ...prev.editableSubTabs };

            const currentVisSub = [...(visSub[moduleId] || [])];
            const currentEdiSub = [...(ediSub[moduleId] || [])];

            if (type === 'view') {
                if (currentVisSub.includes(subId)) {
                    // Remove view
                    const newVis = currentVisSub.filter(id => id !== subId);
                    visSub[moduleId] = newVis;
                    // Also remove edit
                    ediSub[moduleId] = currentEdiSub.filter(id => id !== subId);
                } else {
                    // Add view
                    visSub[moduleId] = [...currentVisSub, subId];
                    if (!vis.includes(moduleId)) vis.push(moduleId);
                }
            } else if (type === 'edit') {
                if (currentEdiSub.includes(subId)) {
                    // Remove edit
                    ediSub[moduleId] = currentEdiSub.filter(id => id !== subId);
                } else {
                    // Add edit
                    ediSub[moduleId] = [...currentEdiSub, subId];
                    if (!currentVisSub.includes(subId)) {
                        visSub[moduleId] = [...currentVisSub, subId];
                    }
                    if (!vis.includes(moduleId)) vis.push(moduleId);
                    if (!edi.includes(moduleId)) edi.push(moduleId);
                }
            }

            return {
                ...prev,
                visibleTabs: vis,
                editableTabs: edi,
                visibleSubTabs: visSub,
                editableSubTabs: ediSub
            };
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Controle de Usuários
                    </h1>
                    <p className="text-gray-500 mt-1">Gerencie acessos e permissões granulares do sistema.</p>
                </div>
                {!editingUser && (
                    <button
                        onClick={handleNewUser}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Usuário
                    </button>
                )}
            </div>

            {editingUser ? (
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                    <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                        <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            {editingUser === 'new' ? 'Cadastrar Novo Usuário' : 'Editar Permissões do Usuário'}
                        </h2>
                        <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Dados Básicos */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Login</label>
                                <input
                                    type="text"
                                    value={formData.login}
                                    onChange={e => setFormData({ ...formData, login: e.target.value })}
                                    className="w-full border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="Ex: joaos"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Senha</label>
                                <input
                                    type="text"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="Senha de acesso"
                                />
                            </div>
                        </div>

                        {/* Permissões */}
                        <div>
                            <div className="flex items-center justify-between border-b pb-2 mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Permissões de Módulos & Sub-Áreas</h3>
                                    <p className="text-xs text-gray-500">Defina quais telas e abas internas o usuário pode acessar e editar.</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Módulo / Sub-Área</th>
                                            <th className="px-4 py-3 text-center w-32">Visualizar</th>
                                            <th className="px-4 py-3 text-center w-32">Editar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {MODULES.map(m => {
                                            const canView = formData.visibleTabs.includes(m.id);
                                            const canEdit = formData.editableTabs.includes(m.id);
                                            const hasSubModules = Boolean(m.subModules && m.subModules.length > 0);
                                            const isExpanded = expandedModules.includes(m.id);
                                            const visSubCount = (formData.visibleSubTabs?.[m.id] || []).length;

                                            return (
                                                <React.Fragment key={m.id}>
                                                    <tr className={clsx(
                                                        "hover:bg-white transition-colors",
                                                        hasSubModules && isExpanded && "bg-slate-50/80"
                                                    )}>
                                                        <td className="px-4 py-3 font-semibold text-gray-800">
                                                            <div className="flex items-center gap-2">
                                                                {hasSubModules ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpandModule(m.id)}
                                                                        className="p-1 hover:bg-gray-200 text-gray-500 rounded transition-colors"
                                                                        title={isExpanded ? "Recolher sub-áreas" : "Expandir sub-áreas"}
                                                                    >
                                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                                                                    </button>
                                                                ) : (
                                                                    <span className="w-6" />
                                                                )}
                                                                <span>{m.label}</span>
                                                                {hasSubModules && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpandModule(m.id)}
                                                                        className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded-full font-medium transition-colors"
                                                                    >
                                                                        {canView ? `${visSubCount}/${m.subModules.length} liberadas` : `${m.subModules.length} sub-áreas`}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <label className="inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={canView}
                                                                    onChange={() => togglePermission(m.id, 'view')}
                                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                                />
                                                            </label>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <label className="inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={canEdit}
                                                                    onChange={() => togglePermission(m.id, 'edit')}
                                                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                                                />
                                                            </label>
                                                        </td>
                                                    </tr>

                                                    {/* Sub-módulos expandidos */}
                                                    {hasSubModules && isExpanded && m.subModules.map(sub => {
                                                        const isSubVis = (formData.visibleSubTabs?.[m.id] || []).includes(sub.id);
                                                        const isSubEdi = (formData.editableSubTabs?.[m.id] || []).includes(sub.id);

                                                        return (
                                                            <tr key={`${m.id}-${sub.id}`} className="bg-indigo-50/40 hover:bg-indigo-50/80 transition-colors border-t border-indigo-100/50">
                                                                <td className="pl-12 pr-4 py-2 font-normal text-xs text-gray-700 flex items-center gap-2">
                                                                    <span className="text-indigo-400 font-bold">↳</span>
                                                                    <span>{sub.label}</span>
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <label className="inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSubVis}
                                                                            onChange={() => toggleSubPermission(m.id, sub.id, 'view')}
                                                                            className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                                        />
                                                                    </label>
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <label className="inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSubEdi}
                                                                            onChange={() => toggleSubPermission(m.id, sub.id, 'edit')}
                                                                            className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                                                        />
                                                                    </label>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Extra Permissions */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">Permissões Adicionais</h3>
                            <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                                <input
                                    type="checkbox"
                                    checked={formData.canExportImport}
                                    onChange={(e) => setFormData({ ...formData, canExportImport: e.target.checked })}
                                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="font-semibold text-gray-800 block">Exportar/Importar Backups</span>
                                    <span className="text-xs text-gray-500">Permite baixar o banco de dados completo do sistema e importar arquivos JSON.</span>
                                </div>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Usuário
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {usersList.map((user) => {
                        const isMe = user.id === currentUser.id;
                        return (
                            <div key={user.id} className={clsx(
                                "bg-white p-5 rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md group",
                                isMe ? "border-indigo-300 ring-1 ring-indigo-100" : "border-gray-100"
                            )}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner",
                                            isMe ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                                        )}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                {user.name}
                                                {isMe && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Você</span>}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-mono">@{user.login}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEditUser(user)}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        {!isMe && user.login !== 'dsmateu' && (
                                            <button 
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 mt-4">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Resumo de Permissões</div>
                                    
                                    {/* Display some tags of what they can edit */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.customPermissions?.editableTabs?.map(tabId => {
                                            const mod = MODULES.find(m => m.id === tabId);
                                            if (!mod) return null;
                                            const subList = user.customPermissions?.editableSubTabs?.[tabId];
                                            const subText = mod.subModules && subList && subList.length < mod.subModules.length 
                                                ? ` (${subList.length}/${mod.subModules.length})` 
                                                : '';
                                            return (
                                                <span key={tabId} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md">
                                                    <Edit3 className="w-3 h-3" />
                                                    {mod.label}{subText}
                                                </span>
                                            );
                                        })}
                                        
                                        {user.customPermissions?.visibleTabs?.map(tabId => {
                                            // Only show 'view' tag if not already in 'edit' tag
                                            if (user.customPermissions?.editableTabs?.includes(tabId)) return null;
                                            const mod = MODULES.find(m => m.id === tabId);
                                            if (!mod) return null;
                                            const subList = user.customPermissions?.visibleSubTabs?.[tabId];
                                            const subText = mod.subModules && subList && subList.length < mod.subModules.length 
                                                ? ` (${subList.length}/${mod.subModules.length})` 
                                                : '';
                                            return (
                                                <span key={`view-${tabId}`} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md">
                                                    <Eye className="w-3 h-3" />
                                                    {mod.label}{subText}
                                                </span>
                                            );
                                        })}
                                        
                                        {!user.customPermissions && (
                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded-md">
                                                Perfil Legado: {user.role}
                                            </span>
                                        )}
                                    </div>
                                    {(user.customPermissions?.canExportImport || user.role === 'admin') && (
                                        <div className="mt-2 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                            <Shield className="w-3 h-3" /> Permissão de Backup Liberada
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
