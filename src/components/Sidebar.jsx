import React, { useRef } from 'react';
import { LayoutDashboard, ShoppingCart, Wallet, Download, Upload, Calculator, LogOut, FileSpreadsheet, Factory, ClipboardList } from 'lucide-react';
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
        { id: 'contas', label: 'Produção', icon: Factory },
        { id: 'tarefas', label: 'Tarefas', icon: ClipboardList },
    ];

    const menuItems = allMenuItems.filter(item => canView(item.id));

    const roleLabel = {
        admin: 'Administrador',
        editor: 'Editor',
        budget_only: 'Orçamentos',
        producao_only: 'Produção',
    };

    return (
        <aside className="w-60 bg-white border-r border-slate-100 hidden md:flex flex-col shrink-0" style={{ boxShadow: '1px 0 0 0 #F1F5F9' }}>
            {/* Logo */}
            <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                        <span className="text-white font-black text-xs">L</span>
                    </div>
                    <h1 className="text-[15px] font-bold text-slate-800 tracking-tight">Controle Lume</h1>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={clsx(
                                "flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 gap-3",
                                isActive
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            )}
                        >
                            <Icon
                                size={17}
                                className={clsx(
                                    "flex-shrink-0",
                                    isActive ? "text-indigo-600" : "text-slate-400"
                                )}
                            />
                            {item.label}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                        </button>
                    );
                })}
            </nav>

            {/* Ferramentas Admin */}
            {permissions?.canExportImport && (
                <div className="px-3 py-3 border-t border-slate-100 space-y-0.5">
                    <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dados</p>
                    <button
                        onClick={onExportExcel}
                        className="flex items-center w-full px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors gap-2"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-500" /> Exportar Planilha
                    </button>
                    <button
                        onClick={onExportBackup}
                        className="flex items-center w-full px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors gap-2"
                    >
                        <Download size={14} className="text-blue-500" /> Exportar Backup
                    </button>
                    <input type="file" ref={fileInputRef} onChange={onImportBackup} className="hidden" accept=".json" />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center w-full px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors gap-2"
                    >
                        <Upload size={14} className="text-orange-500" /> Restaurar Backup
                    </button>
                </div>
            )}

            {/* Usuário */}
            <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold text-xs uppercase">
                            {currentUser?.name?.charAt(0)}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{currentUser?.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{roleLabel[currentUser?.role] || currentUser?.role}</p>
                    </div>
                    <button
                        id="logout-button"
                        onClick={logout}
                        title="Sair"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
