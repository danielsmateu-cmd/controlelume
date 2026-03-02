import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';

const Vendas = () => {
    // Carregar opções de FTs
    const [fts, setFts] = useState(() => {
        const saved = localStorage.getItem('ecommerce_fts');
        return saved ? JSON.parse(saved) : [];
    });

    // Estado para vendas salvas por mês
    const [monthlySales, setMonthlySales] = useState(() => {
        const saved = localStorage.getItem('ecommerce_vendas');
        return saved ? JSON.parse(saved) : {};
    });

    // Mês/Ano selecionado atualmente (ex: "2026-03")
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const buildInitialRows = () => {
        return fts
            .sort((a, b) => a.ftCode.localeCompare(b.ftCode))
            .map(ft => ({
                id: `auto-${ft.id}`,
                quantity: 0,
                ftId: ft.id
            }));
    };

    // Linhas da tabela do mês atual
    const [rows, setRows] = useState([]);

    // Sempre que o mês muda, carrga as linhas salvas ou inicia vazio
    useEffect(() => {
        if (monthlySales[currentMonth]) {
            // Merge saved rows with potentially new FTs
            const savedRows = monthlySales[currentMonth];
            const currentRows = buildInitialRows().map(defaultRow => {
                const savedRow = savedRows.find(r => r.ftId === defaultRow.ftId);
                return savedRow ? { ...defaultRow, quantity: savedRow.quantity } : defaultRow;
            });
            setRows(currentRows);
        } else {
            setRows(buildInitialRows());
        }
    }, [currentMonth, monthlySales, fts]);

    // Salvar o mês atual
    const handleSaveMonth = () => {
        const updatedSales = {
            ...monthlySales,
            [currentMonth]: rows
        };
        setMonthlySales(updatedSales);
        localStorage.setItem('ecommerce_vendas', JSON.stringify(updatedSales));
        alert('Vendas do mês salvas com sucesso!');
    };

    const updateRow = (id, field, value) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    // Funcões auxiliares de cálculo
    const getFtDetails = (ftId) => {
        if (!ftId) return null;
        return fts.find(ft => ft.id === ftId) || null;
    };

    const calculateCost = (ft) => {
        if (!ft) return 0;
        const totalMat = ft.materials?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
        const totalDir = ft.directCostsRS?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
        const totalPerc = ft.directCostsPercent?.reduce((acc, curr) => {
            return acc + (((parseFloat(curr.percentage) || 0) / 100) * (parseFloat(ft.salePrice) || 0));
        }, 0) || 0;
        return totalMat + totalDir + totalPerc;
    };

    // Resumo do mês
    const totalMonthSales = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        return acc + ((parseFloat(ft.salePrice) || 0) * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthCosts = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        return acc + (calculateCost(ft) * (parseInt(row.quantity) || 0));
    }, 0);

    const monthMargin = totalMonthSales - totalMonthCosts;
    const monthMarginPercent = totalMonthSales > 0 ? (monthMargin / totalMonthSales) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                            Controle de Vendas
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Registre e acompanhe as vendas mensais</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label className="text-sm font-semibold text-gray-600">Mês de Referência:</label>
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"
                        />
                    </div>
                </div>

                {/* Tabela de Vendas */}
                <div className="overflow-x-auto border border-gray-100 rounded-lg mb-4">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                            <tr>
                                <th className="px-4 py-3 font-medium rounded-tl-lg w-24">Qtd</th>
                                <th className="px-4 py-3 font-medium min-w-[250px]">Ficha Técnica (FT)</th>
                                <th className="px-4 py-3 font-medium text-right">Preço de Venda</th>
                                <th className="px-4 py-3 font-medium text-right">Custo Unitário</th>
                                <th className="px-4 py-3 font-medium text-right">Margem Unit. (%)</th>
                                <th className="px-4 py-3 font-medium text-right">TP Total (min)</th>
                                <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(row => {
                                const ft = getFtDetails(row.ftId);
                                const qty = parseInt(row.quantity) || 0;

                                const unitPrice = ft ? parseFloat(ft.salePrice) || 0 : 0;
                                const unitCost = calculateCost(ft);
                                const unitMarginRS = unitPrice - unitCost;
                                const unitMarginPercent = unitPrice > 0 ? (unitMarginRS / unitPrice) * 100 : 0;
                                const totalTP = ft && ft.productionTime ? (parseFloat(ft.productionTime) * qty) : 0;
                                const totalValue = unitPrice * qty;

                                return (
                                    <tr key={row.id} className={clsx("transition-colors", qty > 0 ? "bg-indigo-50/30 hover:bg-indigo-50/50" : "hover:bg-gray-50/50")}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                min="1"
                                                value={row.quantity}
                                                onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                                                className="w-full text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 px-2 font-bold text-center"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {ft ? `${ft.ftCode} - ${ft.name} ${ft.variation ? `(${ft.variation})` : ''}` : 'FT Excluída'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                                            R$ {unitPrice.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            R$ {unitCost.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={clsx("font-semibold", unitMarginPercent >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {unitMarginPercent.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                            {totalTP > 0 ? `${totalTP}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                                            R$ {totalValue.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}

                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic">
                                        Nenhuma Ficha Técnica cadastrada. Cadastre produtos no módulo de "Cadastros de FTs".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles Inferiores */}
                <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 border-t border-gray-100 pt-6 mt-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-gray-50 px-6 py-3 rounded-xl border border-gray-200">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium uppercase">Total Mês (Bruto)</span>
                            <span className="text-lg font-bold text-gray-900">R$ {totalMonthSales.toFixed(2)}</span>
                        </div>
                        <div className="hidden sm:block w-px h-8 bg-gray-300"></div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium uppercase">Lucro Mês</span>
                            <span className={clsx("text-lg font-bold", monthMargin >= 0 ? "text-emerald-600" : "text-red-600")}>
                                R$ {monthMargin.toFixed(2)} <span className="text-sm">({monthMarginPercent.toFixed(1)}%)</span>
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveMonth}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm w-full md:w-auto justify-center"
                    >
                        <Save size={18} />
                        Salvar Mês
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Vendas;
