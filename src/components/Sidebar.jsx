import React, { useRef } from 'react';
import { LayoutDashboard, ShoppingCart, DollarSign, Wallet, Download, Upload, Calculator, LogOut, FileSpreadsheet, Factory, ClipboardList, Trash2, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, onExportBackup, onImportBackup, onExportExcel }) => {
    const fileInputRef = useRef(null);
    const { currentUser, logout, canView, permissions } = useAuth();

    const handleClearTestData = () => {
        if (window.confirm('Tem certeza que deseja APAGAR TODOS os dados de teste? Isso limpará todas as entradas, despesas, orçamentos e FTs deste usuário. Essa ação não afeta os dados reais do sistema.')) {
            // Remove just the teste_ prefixed keys from localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('teste_')) {
                    localStorage.removeItem(key);
                    i--; // adjust index since we removed an item
                }
            }
            alert('Dados de teste apagados com sucesso! A página será recarregada.');
            window.location.reload();
        }
    };

    const allMenuItems = [
        { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
        { id: 'vendas', label: 'Entradas', icon: ShoppingCart },
        { id: 'saida', label: 'Saídas', icon: Wallet },
        { id: 'orcamentos', label: 'Orçamentos', icon: Calculator },
        { id: 'contas', label: 'Produção', icon: Factory },
        { id: 'tarefas', label: 'Tarefas', icon: ClipboardList },
        { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart },
        { id: 'simulacao', label: 'Simulação', icon: Calculator },
    ];

    // Filter menu items by what the current user can see
    const menuItems = allMenuItems.filter(item => canView(item.id));

    const roleLabel = {
        admin: 'Administrador',
        editor: 'Editor',
        budget_only: 'Orçamentos'
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col print:hidden">
            <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setActiveTab('home')}
            >
                <h1 className="text-xl font-bold text-indigo-600">Controle Lume</h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={clsx(
                                "flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                activeTab === item.id
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Test User Specific Actions */}
            {currentUser?.login === 'teste' && (
                <div className="px-4 border-t border-gray-100 pt-3 pb-2 space-y-1">
                    <button
                        onClick={handleClearTestData}
                        className="flex items-center w-full px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors gap-2"
                        title="Limpar todos os dados locais deste usuário"
                    >
                        <Trash2 size={14} className="text-red-500" /> Limpar Dados de Teste
                    </button>
                </div>
            )}

            {/* Backup buttons - only for admin */}
            {permissions?.canExportImport && currentUser?.login !== 'teste' && (
                <div className="px-4 border-t border-gray-100 pt-3 pb-2 space-y-1">
                    <button
                        onClick={onExportExcel}
                        className="flex items-center w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors gap-2"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-600" /> Exportar Planilha
                    </button>

                    <button
                        onClick={onExportBackup}
                        className="flex items-center w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors gap-2"
                    >
                        <Download size={14} className="text-green-500" /> Exportar Backup
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onImportBackup}
                        className="hidden"
                        accept=".json"
                    />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors gap-2"
                    >
                        <Upload size={14} className="text-orange-500" /> Restaurar Backup
                    </button>
                </div>
            )}

            {/* User Management - only for dsmateu */}
            {currentUser?.login === 'dsmateu' && (
                <div className="px-4 border-t border-gray-100 pt-3 pb-2 space-y-1">
                    <button
                        onClick={() => setActiveTab('usuarios')}
                        className={clsx(
                            "flex items-center w-full px-4 py-2 text-xs font-semibold rounded-lg transition-colors gap-2",
                            activeTab === 'usuarios'
                                ? "bg-indigo-100 text-indigo-700"
                                : "text-indigo-600 hover:bg-indigo-50"
                        )}
                    >
                        <Users size={14} /> Controle de Usuários
                    </button>
                </div>
            )}

            {/* User info + logout */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold text-sm uppercase">
                            {currentUser?.name?.charAt(0)}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{currentUser?.name}</p>
                        <p className="text-xs text-indigo-500 font-medium">{roleLabel[currentUser?.role]}</p>
                    </div>
                </div>
                <button
                    id="logout-button"
                    onClick={logout}
                    className="flex items-center w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors gap-2"
                >
                    <LogOut size={14} /> Sair
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
