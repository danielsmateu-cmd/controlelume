import React, { useState, useEffect } from 'react';
import { Trash2, Save, ShoppingCart, Loader2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';

const Vendas = ({ marketplace = 'geral', readOnly }) => {
    // Carregar opções de FTs
    const [fts, setFts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estado para vendas salvas por mês
    const [monthlySales, setMonthlySales] = useState({});
    const [lockedMonths, setLockedMonths] = useState([]); // Array de chaves [ "meli_2026-03", ... ]
    const [isLocking, setIsLocking] = useState(false);

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
                // Quando carregamos, mantemos o snapshot se existir
                return savedRow ? { ...defaultRow, quantity: savedRow.quantity, discountPercent: savedRow.discountPercent || 0, snapshot: savedRow.snapshot } : defaultRow;
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
                const [fetchedFts, mktOverrides, lockedData] = await Promise.all([
                    api.getFts(),
                    api.getSettings(`ft_overrides_${marketplace}`),
                    api.getSettings('locked_ecommerce_months')
                ]);

                const overridesData = mktOverrides || {};
                const finalFts = fetchedFts.map(ft => {
                    if (overridesData[ft.ftCode]) {
                        return { ...ft, ...overridesData[ft.ftCode], isOverride: true };
                    }
                    return ft;
                });

                setFts(finalFts);

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
                setLockedMonths(lockedData || []);
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

    const isCurrentMonthLocked = lockedMonths.includes(`${marketplace}_${currentMonth}`);

    const updateRow = (id, field, value) => {
        if (isCurrentMonthLocked || readOnly) return;
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
    const getFtDetails = (row) => {
        if (!row.ftId) return null;
        // Se a linha já tiver um snapshot de quando foi travada, use ele
        if (row.snapshot) {
            return row.snapshot;
        }
        return fts.find(ft => ft.id === row.ftId) || null;
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
        if (!ft) return 0;
        // No snapshot, os valores ja estao calculados (materiais, directCosts)
        if (ft.materialsTotal !== undefined) {
            return (ft.materialsTotal || 0) + (ft.directCostsTotal || 0);
        }
        return calculateMaterials(ft) + calculateDirectCosts(ft);
    };

    // Resumo do mês
    const totalMonthSales = rows.reduce((acc, row) => {
        const ft = getFtDetails(row);
        if (!ft) return acc;
        const uPrice = parseFloat(ft.salePrice) || 0;
        const discount = parseFloat(row.discountPercent) || 0;
        const finalPrice = uPrice * (1 - discount / 100);
        return acc + (finalPrice * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthCosts = rows.reduce((acc, row) => {
        const ft = getFtDetails(row);
        if (!ft) return acc;
        return acc + (calculateCost(ft) * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthMaterials = rows.reduce((acc, row) => {
        const ft = getFtDetails(row);
        if (!ft) return acc;
        const value = ft.materialsTotal !== undefined ? ft.materialsTotal : calculateMaterials(ft);
        return acc + (value * (parseInt(row.quantity) || 0));
    }, 0);

    const totalMonthDirectCosts = rows.reduce((acc, row) => {
        const ft = getFtDetails(row);
        if (!ft) return acc;
        const value = ft.directCostsTotal !== undefined ? ft.directCostsTotal : calculateDirectCosts(ft);
        return acc + (value * (parseInt(row.quantity) || 0));
    }, 0);

    const monthMargin = totalMonthSales - totalMonthCosts;
    const monthMarginPercent = totalMonthSales > 0 ? (monthMargin / totalMonthSales) * 100 : 0;

    const totalQtd = rows.reduce((acc, row) => acc + (parseInt(row.quantity) || 0), 0);

    const overallTotalTP = rows.reduce((acc, row) => {
        const ft = getFtDetails(row);
        if (!ft) return acc;
        // Se for snapshot, productionTime já é string ou numero direto do snapshot
        const prodTime = parseFloat(ft.productionTime) || 0;
        return acc + (prodTime * (parseInt(row.quantity) || 0));
    }, 0);

    const handleLockMonth = async () => {
        if (isCurrentMonthLocked || readOnly) return;

        const mktName = marketplace.toUpperCase();
        const monthDisplay = formatMonthDisplay(currentMonth).split(' - ')[0]; // Pega so "FECHAMENTO MARCO DE 2026"

        const confirmMsg = `ATENÇÃO: Você está prestes a TRAVAR os dados de vendas de ${mktName} para o mês de ${monthDisplay}.\n\nAo travar:\n1. Os valores de Preço, Custos e Tempo de Produção atuais serão fixados para este mês.\n2. Nenhuma alteração futura nas Fichas Técnicas afetará este mês.\n3. A edição será BLOQUEADA para este mês.\n\nDeseja continuar?`;

        if (!window.confirm(confirmMsg)) return;

        setIsLocking(true);
        try {
            // 1. Criar snapshots para todas as linhas que tem venda
            const snapshottedRows = rows.map(row => {
                const ft = fts.find(f => f.id === row.ftId);
                if (!ft) return row;

                return {
                    ...row,
                    snapshot: {
                        ftCode: ft.ftCode,
                        name: ft.name,
                        variation: ft.variation,
                        salePrice: ft.salePrice,
                        productionTime: ft.productionTime,
                        materialsTotal: calculateMaterials(ft),
                        directCostsTotal: calculateDirectCosts(ft)
                    }
                };
            });

            const monthKey = `${marketplace}_${currentMonth}`;

            // 2. Salvar linhas com snapshots
            const successSales = await api.saveMonthlySales(monthKey, snapshottedRows);

            if (successSales) {
                // 3. Adicionar aos meses travados
                const nextLocked = [...lockedMonths, monthKey];
                const successLock = await api.saveSettings('locked_ecommerce_months', nextLocked);

                if (successLock) {
                    setLockedMonths(nextLocked);
                    setMonthlySales(prev => ({ ...prev, [monthKey]: snapshottedRows }));
                    setRows(snapshottedRows);
                    alert("Mês travado com sucesso!");
                }
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao travar o mês.");
        } finally {
            setIsLocking(false);
        }
    };

    const handleUnlockMonth = async () => {
        if (!isCurrentMonthLocked || readOnly) return;

        const mktName = marketplace.toUpperCase();
        const monthDisplay = formatMonthDisplay(currentMonth).split(' - ')[0];

        const confirmMsg = `ATENÇÃO: Você está prestes a DESTRAVAR os dados de vendas de ${mktName} para o mês de ${monthDisplay}.\n\nAo destravar:\n1. Os valores das Fichas Técnicas VOLTARÃO aos valores cadastrados no momento atual.\n2. A "foto" (snapshot) dos valores antigos será PERDIDA.\n3. A edição será LIBERADA para este mês.\n\nDeseja continuar?`;

        if (!window.confirm(confirmMsg)) return;

        setIsLocking(true);
        try {
            // 1. Limpar snapshots de todas as linhas
            const cleanedRows = rows.map(row => {
                const { snapshot, ...rest } = row;
                return rest;
            });

            const monthKey = `${marketplace}_${currentMonth}`;

            // 2. Salvar linhas limpas (sem snapshot)
            const successSales = await api.saveMonthlySales(monthKey, cleanedRows);

            if (successSales) {
                // 3. Remover dos meses travados
                const nextLocked = lockedMonths.filter(m => m !== monthKey);
                const successLock = await api.saveSettings('locked_ecommerce_months', nextLocked);

                if (successLock) {
                    setLockedMonths(nextLocked);
                    setMonthlySales(prev => ({ ...prev, [monthKey]: cleanedRows }));
                    setRows(cleanedRows);
                    alert("Mês destravado com sucesso!");
                }
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao destravar o mês.");
        } finally {
            setIsLocking(false);
        }
    };

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
                    <div className="flex-1 flex flex-col items-center justify-center w-full sm:w-auto mt-4 sm:mt-0">
                        <div className={clsx(
                            "px-6 py-2 rounded-full font-bold shadow-sm text-center tracking-wide flex items-center gap-3",
                            isCurrentMonthLocked ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-indigo-600 text-white shadow-indigo-200"
                        )}>
                            {isCurrentMonthLocked && <Save className="w-4 h-4" />}
                            {formatMonthDisplay(currentMonth)}
                            {isCurrentMonthLocked && <span className="text-[10px] bg-amber-800 text-white px-1.5 py-0.5 rounded ml-1">LOCKED</span>}
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
                                        const ft = getFtDetails(row);
                                        const qty = parseInt(row.quantity) || 0;
                                        const discount = parseFloat(row.discountPercent) || 0;

                                        const unitPrice = ft ? parseFloat(ft.salePrice) || 0 : 0;
                                        const discountedPrice = unitPrice * (1 - discount / 100);

                                        // Se for snapshot, temos os totais diretos salvos no objeto ft
                                        const unitMaterials = ft?.materialsTotal !== undefined ? ft.materialsTotal : calculateMaterials(ft);
                                        const unitDirectCosts = ft?.directCostsTotal !== undefined ? ft.directCostsTotal : calculateDirectCosts(ft);
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
                                                        value={row.quantity || ''}
                                                        onChange={(e) => !readOnly && updateRow(row.id, 'quantity', e.target.value)}
                                                        readOnly={readOnly}
                                                        className={`w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-center font-bold ${readOnly ? 'cursor-default' : ''}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    <div className="flex items-center gap-2">
                                                        <span>{ft ? `${ft.ftCode} - ${ft.name} ${ft.variation ? `(${ft.variation})` : ''}` : 'FT Excluída'}</span>
                                                        {ft?.isOverride && (
                                                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide whitespace-nowrap">
                                                                Local
                                                            </span>
                                                        )}
                                                    </div>
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
                                                        readOnly={isCurrentMonthLocked || readOnly}
                                                        className={clsx(
                                                            "w-full text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 p-1.5 px-2 text-center",
                                                            (isCurrentMonthLocked || readOnly) && "bg-gray-100 cursor-default"
                                                        )}
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-gray-100 pt-6 mt-2">
                            <div>
                                {!isCurrentMonthLocked && !readOnly && (
                                    <button
                                        onClick={handleLockMonth}
                                        disabled={isLocking}
                                        className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm font-semibold uppercase tracking-wider text-sm"
                                    >
                                        {isLocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Travar Dados do Mês
                                    </button>
                                )}
                                {isCurrentMonthLocked && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 font-bold text-sm uppercase tracking-wide shadow-sm">
                                            <Save className="w-4 h-4" />
                                            MÊS TRAVADO (Imutável)
                                        </div>
                                        {!readOnly && (
                                            <button
                                                onClick={handleUnlockMonth}
                                                disabled={isLocking}
                                                className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-xs font-bold uppercase tracking-wider shadow-sm"
                                            >
                                                {isLocking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 rotate-45" />}
                                                Destravar Mês
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

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
