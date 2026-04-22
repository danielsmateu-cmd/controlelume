import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Edit2, Trash2, Shield, Save, X, Eye, Edit3 } from 'lucide-react';
import clsx from 'clsx';

const MODULES = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'vendas', label: 'Entradas/Vendas' },
    { id: 'saida', label: 'Saídas' },
    { id: 'orcamentos', label: 'Orçamentos' },
    { id: 'contas', label: 'Produção / Contas' },
    { id: 'tarefas', label: 'Tarefas' },
    { id: 'ecommerce', label: 'E-Commerce' },
    { id: 'simulacao', label: 'Simulação de Descontos' }
];

export default function Usuarios() {
    const { usersList, saveUsersList, currentUser } = useAuth();
    const [editingUser, setEditingUser] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        login: '',
        password: '',
        visibleTabs: [],
        editableTabs: [],
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
            canExportImport: false
        });
        setEditingUser('new');
    };

    const handleEditUser = (user) => {
        const perms = user.customPermissions || {
            visibleTabs: [],
            editableTabs: [],
            canExportImport: false
        };
        
        // If it's a legacy user without customPermissions, we can try to guess from its role
        // But for safety and clarity in the UI, if they don't have customPermissions, 
        // they start blank in the UI so the admin can set them explicitly.
        // Actually, let's pre-fill with role defaults if customPermissions doesn't exist.
        let defaultVisible = [];
        let defaultEditable = [];
        let defaultExport = false;
        
        if (!user.customPermissions) {
            if (user.role === 'admin') {
                defaultVisible = MODULES.map(m => m.id);
                defaultEditable = MODULES.map(m => m.id);
                defaultExport = true;
            } else if (user.role === 'editor') {
                defaultVisible = MODULES.map(m => m.id);
                defaultEditable = ['orcamentos', 'contas', 'tarefas', 'simulacao'];
            } else if (user.role === 'budget_only') {
                defaultVisible = ['orcamentos', 'contas'];
                defaultEditable = ['orcamentos', 'contas'];
            } else if (user.role === 'producao_only') {
                defaultVisible = ['contas'];
                defaultEditable = ['contas'];
            } else if (user.role === 'simulacao_only') {
                defaultVisible = ['simulacao'];
                defaultEditable = ['simulacao'];
            }
        } else {
            defaultVisible = perms.visibleTabs || [];
            defaultEditable = perms.editableTabs || [];
            defaultExport = perms.canExportImport || false;
        }

        setFormData({
            id: user.id,
            name: user.name,
            login: user.login,
            password: user.password,
            visibleTabs: defaultVisible,
            editableTabs: defaultEditable,
            canExportImport: defaultExport
        });
        setEditingUser(user.id);
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

            if (type === 'view') {
                if (vis.includes(moduleId)) {
                    vis = vis.filter(id => id !== moduleId);
                    // If removing view, remove edit too
                    edi = edi.filter(id => id !== moduleId);
                } else {
                    vis.push(moduleId);
                }
            } else if (type === 'edit') {
                if (edi.includes(moduleId)) {
                    edi = edi.filter(id => id !== moduleId);
                } else {
                    edi.push(moduleId);
                    // If adding edit, add view too
                    if (!vis.includes(moduleId)) vis.push(moduleId);
                }
            }

            return { ...prev, visibleTabs: vis, editableTabs: edi };
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
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">Permissões de Módulos</h3>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Módulo</th>
                                            <th className="px-4 py-3 text-center w-32">Visualizar</th>
                                            <th className="px-4 py-3 text-center w-32">Editar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {MODULES.map(m => {
                                            const canView = formData.visibleTabs.includes(m.id);
                                            const canEdit = formData.editableTabs.includes(m.id);
                                            
                                            return (
                                                <tr key={m.id} className="hover:bg-white transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
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
                                            return mod ? (
                                                <span key={tabId} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md">
                                                    <Edit3 className="w-3 h-3" />
                                                    {mod.label}
                                                </span>
                                            ) : null;
                                        })}
                                        
                                        {user.customPermissions?.visibleTabs?.map(tabId => {
                                            // Only show 'view' tag if not already in 'edit' tag
                                            if (user.customPermissions?.editableTabs?.includes(tabId)) return null;
                                            const mod = MODULES.find(m => m.id === tabId);
                                            return mod ? (
                                                <span key={`view-${tabId}`} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md">
                                                    <Eye className="w-3 h-3" />
                                                    {mod.label}
                                                </span>
                                            ) : null;
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
