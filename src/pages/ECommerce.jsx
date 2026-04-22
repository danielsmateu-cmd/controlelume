import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
    BarChart3,
    Building2,
    Handshake,
    ListTodo,
    ShoppingCart,
    Store,
    Printer,
    Calculator
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
    const [reportMonth, setReportMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const subTabs = [
        { id: 'visao_geral', label: 'Visão Geral', icon: BarChart3 },
        { id: 'empresas_custos', label: 'Empresas e Custos', icon: Building2 },
        { id: 'marketplaces', label: 'Marketplaces', icon: Store },
        { id: 'parcerias', label: 'Parcerias', icon: Handshake },
        { id: 'relatorio', label: 'Gerar PDF', icon: Printer },
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
            case 'relatorio':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                    <Printer className="w-6 h-6 text-indigo-600" />
                                    Gerar Relatório Resumo em PDF
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Imprima um resumo das Parcerias, Custos Inevitáveis e Visão Geral do mês escolhido.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="month"
                                    value={reportMonth}
                                    onChange={e => setReportMonth(e.target.value)}
                                    className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    onClick={() => window.print()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                                >
                                    <Printer size={16} />
                                    Imprimir PDF
                                </button>
                            </div>
                        </div>

                        <style>{`
                            @media print {
                                @page { margin: 5mm; size: auto; }
                                .print-content {
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    zoom: 0.9;
                                }
                                .page-break {
                                    page-break-after: always !important;
                                    break-after: page !important;
                                }
                                /* Shrink all elements aggressively */
                                .print-content * {
                                    box-shadow: none !important;
                                }
                                .print-content .p-3, .print-content .p-4, .print-content .p-5, .print-content .p-6, .print-content .p-8 {
                                    padding: 4px !important;
                                }
                                .print-content .py-2, .print-content .py-2\\.5, .print-content .py-3 {
                                    padding-top: 2px !important; padding-bottom: 2px !important;
                                }
                                .print-content .px-3, .print-content .px-4, .print-content .px-5 {
                                    padding-left: 4px !important; padding-right: 4px !important;
                                }
                                .print-content .space-y-6 > * + *, .print-content .space-y-8 > * + *, .print-content .space-y-4 > * + * {
                                    margin-top: 4px !important;
                                }
                                .print-content .mb-6, .print-content .mb-8, .print-content .mb-3, .print-content .mb-4 {
                                    margin-bottom: 4px !important;
                                }
                                .print-content .gap-6, .print-content .gap-4, .print-content .gap-8 {
                                    gap: 6px !important;
                                }
                                /* Typography */
                                .print-content, .print-content span, .print-content div, .print-content p, .print-content input {
                                    font-size: 9px !important; line-height: 1.2 !important;
                                }
                                .print-content h1 { font-size: 14px !important; margin: 2px 0 6px 0 !important; }
                                .print-content h2 { font-size: 12px !important; margin: 0 0 2px 0 !important; }
                                .print-content h3, .print-content h4 { font-size: 10px !important; margin: 0 !important; }
                                .print-content .text-xs, .print-content .text-\\[10px\\] { font-size: 8px !important; }
                                .print-content .text-sm { font-size: 9px !important; }
                                .print-content .text-base, .print-content .text-lg, .print-content .text-xl, .print-content .text-2xl, .print-content .text-3xl { font-size: 11px !important; }
                                
                                /* Table adjustments */
                                .print-content table { width: 100% !important; }
                                .print-content th, .print-content td { padding: 2px 4px !important; }
                            }
                        `}</style>
                        {/* Print Area - Shown on screen as preview, and printed securely */}
                        <div className="print-content">
                            <h1 className="text-3xl font-black text-center mt-6 mb-8 hidden print:block text-slate-800 border-b-2 border-slate-200 pb-3">
                                Resumo Gerencial E-Commerce - {reportMonth.split('-').reverse().join('/')}
                            </h1>
                            
                            <div className="flex flex-col gap-8 print:block">
                                {/* PAGE 1: Visão Geral e Parcerias */}
                                <div className="page-break mb-8">
                                    <div className="mb-8 print:mb-4">
                                        <VisaoGeral readOnly printMonth={reportMonth} />
                                    </div>
                                    <div>
                                        <Parcerias readOnly printMonth={reportMonth} />
                                    </div>
                                </div>

                                {/* PAGE 2: Empresas e Custos */}
                                <div>
                                    <EmpresasCustos readOnly printMonth={reportMonth} forceTab="empresas" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">E-Commerce</h1>
                    <p className="text-gray-500 mt-1">Gerencie as operações de e-commerce da Lume</p>
                </div>
            </div>

            {/* Menu principal */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2 print:hidden">
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
