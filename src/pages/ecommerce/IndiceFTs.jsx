import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import clsx from 'clsx';

const IndiceFTs = () => {
    const [fts, setFts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('ecommerce_fts');
        if (saved) {
            const parsedFts = JSON.parse(saved);
            // Ordenar por ftCode crescente (ex: FT001, FT002)
            parsedFts.sort((a, b) => {
                const numA = parseInt(a.ftCode.replace('FT', ''), 10);
                const numB = parseInt(b.ftCode.replace('FT', ''), 10);
                return numA - numB;
            });
            setFts(parsedFts);
        }
    }, []);

    const filteredFts = fts.filter(ft =>
        ft.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ft.ftCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Índice de Fichas Técnicas</h2>
                        <p className="text-sm text-gray-500 mt-1">Visão geral de todas as FTs cadastradas</p>
                    </div>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar Produto ou Cód..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium rounded-tl-lg">Código</th>
                                <th className="px-6 py-3 font-medium">Produto</th>
                                <th className="px-6 py-3 font-medium text-right">Preço de Venda</th>
                                <th className="px-6 py-3 font-medium text-right">Custo Total</th>
                                <th className="px-6 py-3 font-medium text-right">Margem (R$)</th>
                                <th className="px-6 py-3 font-medium text-right rounded-tr-lg">Margem (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredFts.map(ft => {
                                const totalMat = ft.materials.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
                                const totalDir = ft.directCostsRS.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
                                const totalPerc = ft.directCostsPercent.reduce((acc, curr) => {
                                    return acc + (((parseFloat(curr.percentage) || 0) / 100) * (parseFloat(ft.salePrice) || 0));
                                }, 0);
                                const totalCost = totalMat + totalDir + totalPerc;
                                const marginRS = (parseFloat(ft.salePrice) || 0) - totalCost;
                                const marginPercent = parseFloat(ft.salePrice) > 0 ? (marginRS / parseFloat(ft.salePrice)) * 100 : 0;

                                return (
                                    <tr key={ft.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-900">{ft.ftCode}</td>
                                        <td className="px-6 py-4 text-gray-700 font-medium">
                                            {ft.name} {ft.variation && <span className="text-gray-500 font-normal ml-1">({ft.variation})</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            R$ {parseFloat(ft.salePrice).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            R$ {totalCost.toFixed(2)}
                                        </td>
                                        <td className={clsx("px-6 py-4 text-right font-semibold", marginRS >= 0 ? "text-emerald-600" : "text-red-600")}>
                                            R$ {marginRS.toFixed(2)}
                                        </td>
                                        <td className={clsx("px-6 py-4 text-right font-bold", marginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                            {marginPercent.toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredFts.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                        {searchTerm ? 'Nenhuma ficha técnica encontrada para a busca.' : 'Nenhuma ficha técnica cadastrada ainda.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default IndiceFTs;
