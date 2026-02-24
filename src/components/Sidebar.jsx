import React, { useRef } from 'react';
import { LayoutDashboard, ShoppingCart, DollarSign, Wallet, Download, Upload, Calculator, LogOut, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, onExportBackup, onImportBackup, onExportExcel }) => {
    const fileInputRef = useRef(null);
    const { currentUser, logout, canView, permissions } = useAuth();

    const allMenuItems = [
        { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
        { id: 'saida', label: 'Saída', icon: Wallet },
        { id: 'vendas', label: 'Entradas', icon: ShoppingCart },
        { id: 'orcamentos', label: 'Orçamentos', icon: Calculator },
        { id: 'contas', label: 'Anotações', icon: DollarSign },
    ];

    // Filter menu items by what the current user can see
    const menuItems = allMenuItems.filter(item => canView(item.id));

    const roleLabel = {
        admin: 'Administrador',
        editor: 'Editor',
        budget_only: 'Orçamentos'
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
            <div className="p-6">
                <h1 className="text-xl font-bold text-indigo-600">Controle Web</h1>
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

            {/* Backup buttons - only for admin */}
            {permissions?.canExportImport && (
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
