import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
    BarChart3,
    Building2,
    Settings,
    TrendingUp,
    ListTodo,
    ShoppingCart
} from 'lucide-react';

const ECommerce = () => {
    const [activeSubTab, setActiveSubTab] = useState('visao_geral');

    const subTabs = [
        { id: 'visao_geral', label: 'Visão geral', icon: BarChart3 },
        { id: 'empresas_custos', label: 'Empresas e Custos inevitáveis', icon: Building2 },
        { id: 'capacidade_producao', label: 'Capacidade de produção', icon: Settings },
        { id: 'indice_fts', label: 'Índice de FTs', icon: TrendingUp },
        { id: 'cadastros_fts', label: 'Cadastros de FTs', icon: ListTodo },
        { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    ];

    const renderSubContent = () => {
        switch (activeSubTab) {
            case 'visao_geral':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Visão Geral (Em desenvolvimento)</div>;
            case 'empresas_custos':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Empresas e Custos (Em desenvolvimento)</div>;
            case 'capacidade_producao':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Capacidade de Produção (Em desenvolvimento)</div>;
            case 'indice_fts':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Índice de FTs (Em desenvolvimento)</div>;
            case 'cadastros_fts':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Cadastros de FTs (Em desenvolvimento)</div>;
            case 'vendas':
                return <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">Conteúdo de Vendas (Em desenvolvimento)</div>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">E-Commerce</h1>
                    <p className="text-gray-500 mt-1">Gerencie as operações de e-commerce da Lume</p>
                </div>
            </div>

            {/* Sub-menu de navegação */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={clsx(
                                "flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeSubTab === tab.id
                                    ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100/50"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <Icon className={clsx(
                                "w-4 h-4 mr-2",
                                activeSubTab === tab.id ? "text-indigo-600" : "text-gray-400"
                            )} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Área de conteúdo baseada na aba selecionada */}
            <div className="mt-6">
                {renderSubContent()}
            </div>
        </div>
    );
};

export default ECommerce;
