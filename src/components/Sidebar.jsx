import React, { useRef, useState } from 'react';
import { LayoutDashboard, ShoppingCart, DollarSign, Wallet, Download, Upload, Calculator, LogOut, FileSpreadsheet, Factory, ClipboardList, Trash2, Users, Database, ChevronRight, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, onExportBackup, onImportBackup, onExportExcel }) => {
    const fileInputRef = useRef(null);
    const { currentUser, logout, canView, permissions } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const leaveTimerRef = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(leaveTimerRef.current);
        setExpanded(true);
    };

    const handleMouseLeave = () => {
        // Pequeno delay para evitar colapso acidental ao passar entre ícones
        leaveTimerRef.current = setTimeout(() => setExpanded(false), 120);
    };

    const handleClearTestData = () => {
        if (window.confirm('Tem certeza que deseja APAGAR TODOS os dados de teste? Isso limpará todas as entradas, despesas, orçamentos e FTs deste usuário. Essa ação não afeta os dados reais do sistema.')) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('teste_')) {
                    localStorage.removeItem(key);
                    i--;
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
        { id: 'compras', label: 'Compras', icon: ShoppingBag },
        { id: 'tarefas', label: 'Tarefas', icon: ClipboardList },
        { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart },
        { id: 'simulacao', label: 'Simulação', icon: Calculator },
    ];

    const menuItems = allMenuItems.filter(item => canView(item.id));

    const roleLabel = {
        admin: 'Administrador',
        editor: 'Editor',
        budget_only: 'Orçamentos'
    };

    return (
        <>
            {/* Zona de gatilho invisível na borda esquerda — 8px de largura */}
            <div
                className="fixed left-0 top-0 h-full w-2 z-40 print:hidden"
                onMouseEnter={handleMouseEnter}
            />

            {/* Sidebar */}
            <aside
                className={clsx(
                    'fixed left-0 top-0 h-full z-50 bg-white border-r border-gray-200 hidden md:flex flex-col print:hidden overflow-hidden',
                    'transition-all duration-300 ease-in-out',
                    expanded ? 'w-64 shadow-2xl shadow-black/10' : 'w-16'
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Logo / Header */}
                <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-3 min-h-[72px]"
                    onClick={() => setActiveTab('home')}
                    title="Início"
                >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">L</span>
                    </div>
                    <span className={clsx(
                        'text-xl font-bold text-indigo-600 whitespace-nowrap transition-all duration-200',
                        expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
                    )}>
                        Controle Lume
                    </span>
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                title={!expanded ? item.label : undefined}
                                className={clsx(
                                    'flex items-center w-full px-3 py-3 text-sm font-medium rounded-lg transition-colors',
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                )}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span className={clsx(
                                    'ml-3 whitespace-nowrap transition-all duration-200',
                                    expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0'
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* Test User */}
                {currentUser?.login === 'teste' && (
                    <div className="px-2 border-t border-gray-100 pt-2 pb-1 space-y-1">
                        <button
                            onClick={handleClearTestData}
                            title={!expanded ? 'Limpar Dados de Teste' : undefined}
                            className="flex items-center w-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors gap-3"
                        >
                            <Trash2 size={14} className="text-red-500 flex-shrink-0" />
                            <span className={clsx(
                                'whitespace-nowrap transition-all duration-200',
                                expanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                            )}>
                                Limpar Dados de Teste
                            </span>
                        </button>
                    </div>
                )}

                {/* Backup buttons — dropdown único */}
                {permissions?.canExportImport && currentUser?.login !== 'teste' && (
                    <div className="px-2 border-t border-gray-100 pt-2 pb-1">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onImportBackup}
                            className="hidden"
                            accept=".json"
                        />
                        <div
                            className="relative"
                            onMouseEnter={() => setBackupOpen(true)}
                            onMouseLeave={() => setBackupOpen(false)}
                        >
                            {/* Botão principal */}
                            <button
                                onClick={() => setBackupOpen(v => !v)}
                                title={!expanded ? 'Dados & Backup' : undefined}
                                className={clsx(
                                    'flex items-center w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors gap-3',
                                    backupOpen
                                        ? 'bg-gray-100 text-gray-800'
                                        : 'text-gray-600 hover:bg-gray-50'
                                )}
                            >
                                <Database size={14} className="text-indigo-500 flex-shrink-0" />
                                <span className={clsx(
                                    'whitespace-nowrap transition-all duration-200 flex-1 text-left',
                                    expanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                                )}>
                                    Dados & Backup
                                </span>
                                <ChevronRight
                                    size={12}
                                    className={clsx(
                                        'flex-shrink-0 transition-transform duration-200',
                                        expanded ? 'opacity-60' : 'opacity-0 w-0',
                                        backupOpen ? 'rotate-90' : 'rotate-0'
                                    )}
                                />
                            </button>

                            {/* Dropdown — aparece à direita quando recolhida, abaixo quando expandida */}
                            {backupOpen && (
                                <div className={clsx(
                                    'absolute z-[60] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[180px]',
                                    expanded
                                        ? 'left-0 top-full mt-1'
                                        : 'left-full top-0 ml-2'
                                )}>
                                    <button
                                        onClick={() => { onExportExcel(); setBackupOpen(false); }}
                                        className="flex items-center w-full px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors gap-3"
                                    >
                                        <FileSpreadsheet size={14} className="text-emerald-600 flex-shrink-0" />
                                        Exportar Planilha
                                    </button>
                                    <button
                                        onClick={() => { onExportBackup(); setBackupOpen(false); }}
                                        className="flex items-center w-full px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors gap-3"
                                    >
                                        <Download size={14} className="text-green-500 flex-shrink-0" />
                                        Exportar Backup
                                    </button>
                                    <div className="my-1 border-t border-gray-100" />
                                    <button
                                        onClick={() => { fileInputRef.current.click(); setBackupOpen(false); }}
                                        className="flex items-center w-full px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors gap-3"
                                    >
                                        <Upload size={14} className="text-orange-500 flex-shrink-0" />
                                        Restaurar Backup
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* User Management */}
                {currentUser?.login === 'dsmateu' && (
                    <div className="px-2 border-t border-gray-100 pt-2 pb-1 space-y-1">
                        <button
                            onClick={() => setActiveTab('usuarios')}
                            title={!expanded ? 'Controle de Usuários' : undefined}
                            className={clsx(
                                'flex items-center w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors gap-3',
                                activeTab === 'usuarios'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-indigo-600 hover:bg-indigo-50'
                            )}
                        >
                            <Users size={14} className="flex-shrink-0" />
                            <span className={clsx(
                                'whitespace-nowrap transition-all duration-200',
                                expanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                            )}>
                                Controle de Usuários
                            </span>
                        </button>
                    </div>
                )}

                {/* User info + logout */}
                <div className="p-3 border-t border-gray-200">
                    <div className={clsx(
                        'flex items-center gap-3 mb-2',
                        !expanded && 'justify-center'
                    )}>
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 font-bold text-sm uppercase">
                                {currentUser?.name?.charAt(0)}
                            </span>
                        </div>
                        <div className={clsx(
                            'min-w-0 transition-all duration-200',
                            expanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none overflow-hidden'
                        )}>
                            <p className="text-sm font-semibold text-gray-800 truncate">{currentUser?.name}</p>
                            <p className="text-xs text-indigo-500 font-medium">{roleLabel[currentUser?.role]}</p>
                        </div>
                    </div>
                    <button
                        id="logout-button"
                        onClick={logout}
                        title={!expanded ? 'Sair' : undefined}
                        className={clsx(
                            'flex items-center w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors gap-3',
                            !expanded && 'justify-center'
                        )}
                    >
                        <LogOut size={14} className="flex-shrink-0" />
                        <span className={clsx(
                            'whitespace-nowrap transition-all duration-200',
                            expanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                        )}>
                            Sair
                        </span>
                    </button>
                </div>
            </aside>

            {/* Espaçador fixo para o conteúdo principal não ficar sob a sidebar */}
            <div className="hidden md:block flex-shrink-0 w-16 print:hidden" />
        </>
    );
};

export default Sidebar;
