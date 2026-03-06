import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
    BarChart3,
    Building2,
    Handshake,
    ListTodo,
    ShoppingCart,
    Store
} from 'lucide-react';

import CadastrosFTs from './ecommerce/CadastrosFTs';
import Parcerias from './ecommerce/Parcerias';
import Vendas from './ecommerce/Vendas';
import EmpresasCustos from './ecommerce/EmpresasCustos';
import VisaoGeral from './ecommerce/VisaoGeral';

const PLATFORMS = [
    {
        id: 'meli',
        label: 'Mercado Livre',
        emoji: '🛒',
        color: 'bg-yellow-400 hover:bg-yellow-500',
        activeColor: 'bg-yellow-500',
        ring: 'ring-yellow-300',
        textColor: 'text-yellow-900',
    },
    {
        id: 'shopee',
        label: 'Shopee',
        emoji: '🧡',
        color: 'bg-orange-500 hover:bg-orange-600',
        activeColor: 'bg-orange-600',
        ring: 'ring-orange-300',
        textColor: 'text-white',
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        emoji: '🎵',
        color: 'bg-gray-900 hover:bg-black',
        activeColor: 'bg-black',
        ring: 'ring-gray-500',
        textColor: 'text-white',
    },
    {
        id: 'amazon',
        label: 'Amazon',
        emoji: '📦',
        color: 'bg-amber-500 hover:bg-amber-600',
        activeColor: 'bg-amber-600',
        ring: 'ring-amber-300',
        textColor: 'text-white',
    },
    {
        id: 'site',
        label: 'Site',
        emoji: '🌐',
        color: 'bg-indigo-600 hover:bg-indigo-700',
        activeColor: 'bg-indigo-700',
        ring: 'ring-indigo-300',
        textColor: 'text-white',
    },
];

const ECommerce = ({ readOnly }) => {
    const [activeSubTab, setActiveSubTab] = useState('visao_geral');
    const [activePlatform, setActivePlatform] = useState('meli');
    const [activeMktTab, setActiveMktTab] = useState('vendas');

    const subTabs = [
        { id: 'visao_geral', label: 'Visão Geral', icon: BarChart3 },
        { id: 'empresas_custos', label: 'Empresas e Custos', icon: Building2 },
        { id: 'marketplaces', label: 'Marketplaces', icon: Store },
        { id: 'parcerias', label: 'Parcerias', icon: Handshake },
    ];

    const mktTabs = [
        { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
        { id: 'cadastros_fts', label: 'Cadastros de FTs', icon: ListTodo },
    ];

    const currentPlatform = PLATFORMS.find(p => p.id === activePlatform);

    const renderSubContent = () => {
        switch (activeSubTab) {
            case 'visao_geral':
                return <VisaoGeral readOnly={readOnly} />;
            case 'empresas_custos':
                return <EmpresasCustos readOnly={readOnly} />;
            case 'parcerias':
                return <Parcerias readOnly={readOnly} />;
            case 'marketplaces':
                return (
                    <div className="space-y-4">
                        {/* Seleção de plataforma */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Selecionar Plataforma</p>
                            <div className="flex flex-wrap gap-3">
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setActivePlatform(p.id)}
                                        className={clsx(
                                            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                                            p.color,
                                            p.textColor,
                                            activePlatform === p.id
                                                ? `ring-2 ${p.ring} ring-offset-2 shadow-lg scale-105`
                                                : 'opacity-70 hover:opacity-100'
                                        )}
                                    >
                                        <span className="text-base">{p.emoji}</span>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sub-abas da plataforma selecionada */}
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                            {mktTabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveMktTab(tab.id)}
                                        className={clsx(
                                            'flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                                            activeMktTab === tab.id
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-50'
                                        )}
                                    >
                                        <Icon className={clsx('w-4 h-4 mr-2', activeMktTab === tab.id ? 'text-white' : 'text-gray-400')} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                            <div className="ml-auto flex items-center pr-2">
                                <span className="text-xs text-gray-400 font-medium">
                                    {currentPlatform?.emoji} {currentPlatform?.label}
                                </span>
                            </div>
                        </div>

                        {/* Conteúdo */}
                        <div>
                            {activeMktTab === 'vendas' && <Vendas marketplace={activePlatform} readOnly={readOnly} />}
                            {activeMktTab === 'cadastros_fts' && <CadastrosFTs marketplace={activePlatform} readOnly={readOnly} />}
                        </div>
                    </div>
                );
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

            {/* Menu principal */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={clsx(
                                'flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                activeSubTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100/50'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            )}
                        >
                            <Icon className={clsx('w-4 h-4 mr-2', activeSubTab === tab.id ? 'text-indigo-600' : 'text-gray-400')} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="mt-6">
                {renderSubContent()}
            </div>
        </div>
    );
};

export default ECommerce;
