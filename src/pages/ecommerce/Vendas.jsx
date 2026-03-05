import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShoppingCart, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';

const Vendas = ({ marketplace = 'geral' }) => {
    // Carregar opções de FTs
    const [fts, setFts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estado para vendas salvas por mês
    const [monthlySales, setMonthlySales] = useState({});

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
                discountPercent: 0,
                ftId: ft.id
            }));
    };

    // Linhas da tabela do mês atual
    const [rows, setRows] = useState([]);

    // Sempre que o mês muda ou as FTs carregam, carrga as linhas salvas ou inicia vazio
    useEffect(() => {
        // Se as FTs ainda não carregaram, não tenta renderizar/mergear as rows para não apagar vendas antigas.
        if (isLoading) return;

        const monthKey = `${marketplace}_${currentMonth}`;
        if (monthlySales[monthKey]) {
            // Merge saved rows with potentially new FTs
            const savedRows = monthlySales[monthKey];
            const currentRows = buildInitialRows().map(defaultRow => {
                const savedRow = savedRows.find(r => r.ftId === defaultRow.ftId);
                return savedRow ? { ...defaultRow, quantity: savedRow.quantity, discountPercent: savedRow.discountPercent || 0 } : defaultRow;
            });
            setRows(currentRows);
        } else {
            setRows(buildInitialRows());
        }
    }, [currentMonth, monthlySales, fts, isLoading, marketplace]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const fetchedFts = await api.getFts();
                setFts(fetchedFts);

                let dbSales = await api.getMonthlySales();

                const localSalesStr = localStorage.getItem('ecommerce_vendas');
                if (localSalesStr && Object.keys(dbSales).length === 0) {
                    console.log("Migrando Vendas do LocalStorage para Supabase...");
                    const parsedSales = JSON.parse(localSalesStr);
                    for (const [m, sData] of Object.entries(parsedSales)) {
                        await api.saveMonthlySales(m, sData);
                    }
                    dbSales = parsedSales;
                    localStorage.removeItem('ecommerce_vendas');
                }

                setMonthlySales(dbSales);
            } catch (err) {
                console.error("Erro ao carregar dados na tela de vendas:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [marketplace]);

    // Função auxiliar para formatar o mês na tela
    const formatMonthDisplay = (monthStr) => {
        if (!monthStr) return '';
        const [yearStr, monthStrPart] = monthStr.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStrPart);

        const date = new Date(year, month - 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();

        const prevDate = new Date(year, month - 2);
        const prevMonthNum = String(prevDate.getMonth() + 1).padStart(2, '0');
        const lastDayPrev = new Date(year, month - 1, 0).getDate();

        return `FECHAMENTO ${monthName} DE ${year} - VENDAS DE 01/${prevMonthNum} A ${lastDayPrev}/${prevMonthNum}`;
    };

    const updateRow = (id, field, value) => {
        setRows(prevRows => {
            const nextRows = prevRows.map(r => r.id === id ? { ...r, [field]: value } : r);
            const monthKey = `${marketplace}_${currentMonth}`;

            // Auto-save no estado e na API
            setMonthlySales(prevSales => {
                const updatedSales = { ...prevSales, [monthKey]: nextRows };
                return updatedSales;
            });
            api.saveMonthlySales(monthKey, nextRows).catch(err => console.error("Auto-save error:", err));

            return nextRows;
        });
    };

    // Funcões auxiliares de cálculo
    const getFtDetails = (ftId) => {
        if (!ftId) return null;
        return fts.find(ft => ft.id === ftId) || null;
    };

    const calculateMaterials = (ft) => {
        if (!ft) return 0;
        return ft.materials?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
    };

    const calculateDirectCosts = (ft) => {
        if (!ft) return 0;
        const totalDir = ft.directCostsRS?.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0) || 0;
        const totalPerc = ft.directCostsPercent?.reduce((acc, curr) => {
            return acc + (((parseFloat(curr.percentage) || 0) / 100) * (parseFloat(ft.salePrice) || 0));
        }, 0) || 0;
        return totalDir + totalPerc;
    };

    const calculateCost = (ft) => {
        return calculateMaterials(ft) + calculateDirectCosts(ft);
    };

    // Resumo do mês
    const totalMonthSales = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        const uPrice = parseFloat(ft.salePrice) || 0;
        const discount = parseFloat(row.discountPercent) || 0;
        const finalPrice = uPrice * (1 - discount / 100);
        return acc + (finalPrice * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthCosts = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        return acc + (calculateCost(ft) * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthMaterials = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        return acc + (calculateMaterials(ft) * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthDirectCosts = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        if (!ft) return acc;
        return acc + (calculateDirectCosts(ft) * (parseInt(row.quantity) || 0));
    }, 0);

    const monthMargin = totalMonthSales - totalMonthCosts;
    const monthMarginPercent = totalMonthSales > 0 ? (monthMargin / totalMonthSales) * 100 : 0;

    const totalQtd = rows.reduce((acc, row) => acc + (parseInt(row.quantity) || 0), 0);
    const overallTotalTP = rows.reduce((acc, row) => {
        const ft = getFtDetails(row.ftId);
        return acc + ((ft && ft.productionTime ? parseFloat(ft.productionTime) : 0) * (parseInt(row.quantity) || 0));
    }, 0);

    // Calcular % de Ocupação do Mês (Seg a Sex, 7 horas/dia)
    const [yearStr, monthStr] = currentMonth.split('-');
    const yearNum = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    let workDays = 0;
    const dateIter = new Date(yearNum, monthNum - 1, 1);
    while (dateIter.getMonth() === monthNum - 1) {
        if (dateIter.getDay() !== 0 && dateIter.getDay() !== 6) workDays++;
        dateIter.setDate(dateIter.getDate() + 1);
    }

    const totalWorkMinutesMonth = workDays * 7 * 60;
    const tpPercentage = totalWorkMinutesMonth > 0 ? (overallTotalTP / totalWorkMinutesMonth) * 100 : 0;

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

                    {/* Mês Ativo - Badge Destacado */}
                    <div className="flex-1 flex justify-center w-full sm:w-auto mt-4 sm:mt-0">
                        <div className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-sm shadow-indigo-200 text-center tracking-wide">
                            {formatMonthDisplay(currentMonth)}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label className="text-sm font-semibold text-gray-600">Referência:</label>
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 cursor-pointer"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <span className="ml-2 text-indigo-600 font-medium">Carregando Fichas Técnicas...</span>
                    </div>
                ) : (
                    <>
                        {/* Tabela de Vendas */}
                        <div className="overflow-x-auto border border-gray-100 rounded-lg mb-4">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium rounded-tl-lg w-24">Qtd</th>
                                        <th className="px-4 py-3 font-medium min-w-[250px]">Ficha Técnica (FT)</th>
                                        <th className="px-4 py-3 font-medium text-right">Preço de Venda</th>
                                        <th className="px-4 py-3 font-medium text-center w-24">% Desc</th>
                                        <th className="px-4 py-3 font-medium text-right">Preço Final</th>
                                        <th className="px-4 py-3 font-medium text-right">Total Materiais</th>
                                        <th className="px-4 py-3 font-medium text-right">Total C. Diretos</th>
                                        <th className="px-4 py-3 font-medium text-right">Custo Total</th>
                                        <th className="px-4 py-3 font-medium text-right">Margem Unit. (%)</th>
                                        <th className="px-4 py-3 font-medium text-right">TP Total (min)</th>
                                        <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Valor Total Vendas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* Linha de Totais Gerais */}
                                    {rows.length > 0 && (
                                        <tr className="bg-indigo-600 text-white font-bold sticky top-0 z-10 shadow-sm shadow-indigo-200">
                                            <td className="px-4 py-3 text-center text-lg">{totalQtd > 0 ? totalQtd : '-'}</td>
                                            <td className="px-4 py-3">TOTAIS DO MÊS</td>
                                            <td className="px-4 py-3 text-right">-</td>
                                            <td className="px-4 py-3 text-center">-</td>
                                            <td className="px-4 py-3 text-right">-</td>
                                            <td className="px-4 py-3 text-right">R$ {totalMonthMaterials.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">R$ {totalMonthDirectCosts.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">R$ {totalMonthCosts.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={clsx("px-2 py-0.5 rounded text-sm", monthMarginPercent >= 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white")}>
                                                    Media: {monthMarginPercent.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {overallTotalTP > 0 ? (
                                                    <div className="flex flex-col items-end leading-tight">
                                                        <span>{overallTotalTP}</span>
                                                        <span
                                                            className="text-[10px] text-indigo-200 font-medium tracking-wide mt-1"
                                                            title={`Base: ${workDays} dias úteis (${totalWorkMinutesMonth} min)`}
                                                        >
                                                            {tpPercentage.toFixed(1)}% DO MÊS
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-lg">R$ {totalMonthSales.toFixed(2)}</td>
                                        </tr>
                                    )}
                                    {rows.map(row => {
                                        const ft = getFtDetails(row.ftId);
                                        const qty = parseInt(row.quantity) || 0;
                                        const discount = parseFloat(row.discountPercent) || 0;

                                        const unitPrice = ft ? parseFloat(ft.salePrice) || 0 : 0;
                                        const discountedPrice = unitPrice * (1 - discount / 100);

                                        const unitMaterials = calculateMaterials(ft);
                                        const unitDirectCosts = calculateDirectCosts(ft);
                                        const unitCost = unitMaterials + unitDirectCosts;
                                        const totalCost = unitCost * qty;
                                        const unitMarginRS = discountedPrice - unitCost;
                                        const unitMarginPercent = discountedPrice > 0 ? (unitMarginRS / discountedPrice) * 100 : 0;
                                        const totalTP = ft && ft.productionTime ? (parseFloat(ft.productionTime) * qty) : 0;
                                        const totalValue = discountedPrice * qty;

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
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={row.discountPercent === 0 ? '' : row.discountPercent}
                                                        onChange={(e) => updateRow(row.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                                                        className="w-full text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 px-2 text-center"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right text-indigo-700 font-bold bg-indigo-50/50">
                                                    R$ {discountedPrice.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500">
                                                    R$ {(unitMaterials * qty).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-orange-600 font-medium">
                                                    R$ {(unitDirectCosts * qty).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                                    R$ {totalCost.toFixed(2)}
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
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Vendas;
