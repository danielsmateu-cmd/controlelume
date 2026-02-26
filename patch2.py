import re

with open("src/pages/Orcamentos.jsx", "r", encoding="utf-8") as f:
    text = f.read()

# 2. Extract and replace the middle section (Item Summary & Blue Side Panel)
search_str = """                        {costPerPiece > 0 && (
                            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Resumo do Item Atual</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Valor Unitário Produção:</span>
                                        <span className="font-bold text-gray-700">{unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Qtd de Peças:</span>
                                        <span className="font-bold text-gray-700">{globalQty}</span>
                                    </div>
                                    <div className="h-px bg-gray-100"></div>
                                    <div className="flex justify-between text-sm italic">
                                        <span className="text-gray-400">Subtotal Item:</span>
                                        <span className="font-medium text-gray-500">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Adicional NF ({nfPercentage}%):</span>
                                        <span className="font-bold text-red-500">+{nfValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Taxa Parcelamento ({taxPercentage}%):</span>
                                        <span className="font-bold text-red-500">+{taxValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="h-px bg-gray-100"></div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Custo Material:</span>
                                        <div className="flex items-center gap-2">
                                            {parseFloat(globalQty) > 1 && (
                                                <span className="text-[11px] text-gray-400 font-medium">({costPerPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.)</span>
                                            )}
                                            <span className="font-bold text-gray-700">{(costPerPiece * (parseFloat(globalQty) || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Lucro:</span>
                                        <div className="flex items-center gap-2">
                                            {parseFloat(globalQty) > 1 && (
                                                <span className="text-[11px] text-green-600/60 font-medium">
                                                    ({(unitPrice - costPerPiece).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.)
                                                </span>
                                            )}
                                            <span className="font-bold text-green-600">
                                                {(subtotal - (costPerPiece * (parseFloat(globalQty) || 1))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-px bg-gray-100"></div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Preço Final do Item:</span>
                                        <span className="text-xl text-indigo-600 font-black">
                                            {currentItemPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-gray-100 italic font-medium text-[9px] text-gray-400 text-center py-1">Simulação de Desconto</div>
                                    <div className="flex justify-between items-center py-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Percent size={12} className="text-red-500" /> Desconto (%)
                                        </label>
                                        <input
                                            type="number"
                                            value={discount}
                                            onChange={e => setDiscount(e.target.value)}
                                            className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-right text-xs font-bold text-gray-700 focus:ring-1 focus:ring-red-400 outline-none"
                                        />
                                    </div>
                                    {parseFloat(discount) > 0 && (
                                        <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg animate-in zoom-in-95 duration-300">
                                            <span className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1">
                                                <Percent size={12} /> Sugestão c/ Desc:
                                            </span>
                                            <span className="text-xl font-black text-green-600">
                                                {(currentItemPrice * (1 - (parseFloat(discount) / 100))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="lg:col-span-2 bg-indigo-600 rounded-3xl shadow-xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center md:text-left">
                                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Valor Total do Pedido</p>
                                <h2 className="text-5xl md:text-6xl font-black mt-2">
                                    {projectTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </h2>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <div className="bg-black/20 px-3 py-1 rounded-lg">
                                        <p className="text-[10px] text-indigo-200 uppercase font-black">Total Mat. Gasto</p>
                                        <p className="text-sm font-bold text-white">
                                            {totalMaterialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg">
                                        <p className="text-[10px] text-indigo-100 uppercase font-black">Lucro Estimado</p>
                                        <p className="text-sm font-bold text-green-300">
                                            {totalProjectProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-indigo-200/60 text-[10px] mt-4 italic">* Cálculos baseados no multiplicador de {markup}x e nos itens adicionados.</p>
                            </div>

                            <div className="flex flex-col gap-3 w-full md:w-auto">
                                <button
                                    onClick={handleAddItem}
                                    className="px-10 py-4 bg-white text-indigo-700 rounded-2xl text-base font-black shadow-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2 transform hover:scale-105"
                                >
                                    <Plus size={20} /> ADICIONAR AO ORÇAMENTO
                                </button>
                                <button
                                    onClick={() => {
                                        setMeasurements({});
                                        setUnitQtys({});
                                        setLinearLengths({});
                                        setGlobalQty('1');
                                        setItemName('');
                                        setDiscount('10');
                                        setBudgetItems([]);
                                    }}
                                    className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors text-center"
                                >
                                    Reiniciar Orçamento
                                </button>
                            </div>
                        </div>"""

replacement_str = """                        {costPerPiece > 0 && (
                            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Resumo do Item Atual</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 uppercase text-[10px] font-bold">Custo Material:</span>
                                        <span className="font-bold text-gray-700">{(costPerPiece * (parseFloat(globalQty) || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 uppercase text-[10px] font-bold">Adicional NF ({nfPercentage}%):</span>
                                        <span className="font-bold text-red-500">+{nfValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 uppercase text-[10px] font-bold">Taxa Parcelamento ({taxPercentage}%):</span>
                                        <span className="font-bold text-red-500">+{taxValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 uppercase text-[10px] font-bold">Lucro Estimado:</span>
                                        <span className="font-bold text-green-600">
                                            {(subtotal - (costPerPiece * (parseFloat(globalQty) || 1))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-gray-100"></div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Preço Final do Item:</span>
                                        <span className="text-2xl text-indigo-600 font-black">
                                            {currentItemPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-gray-100 italic font-medium text-[9px] text-gray-400 text-center py-1">Simulação de Desconto</div>
                                    <div className="flex justify-between items-center py-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Percent size={12} className="text-red-500" /> Desconto (%)
                                        </label>
                                        <input
                                            type="number"
                                            value={discount}
                                            onChange={e => setDiscount(e.target.value)}
                                            className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-right text-xs font-bold text-gray-700 focus:ring-1 focus:ring-red-400 outline-none"
                                        />
                                    </div>
                                    {parseFloat(discount) > 0 && (
                                        <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg py-3 animate-in zoom-in-95 duration-300">
                                            <span className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1">
                                                <Percent size={12} /> Valor Final c/ Desc:
                                            </span>
                                            <span className="text-xl font-black text-green-600">
                                                {(currentItemPrice * (1 - (parseFloat(discount) / 100))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="lg:col-span-2 flex flex-col justify-center items-center gap-4 p-4 md:p-8">
                            <button
                                onClick={handleAddItem}
                                className="w-full md:w-2/3 lg:w-1/2 py-5 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 transform hover:scale-[1.02] border-2 border-indigo-500/20"
                            >
                                <Plus size={24} /> ADICIONAR AO ORÇAMENTO
                            </button>
                            <button
                                onClick={() => {
                                    setMeasurements({});
                                    setUnitQtys({});
                                    setLinearLengths({});
                                    setGlobalQty('1');
                                    setItemName('');
                                    setDiscount('10');
                                    setBudgetItems([]);
                                }}
                                className="w-full md:w-2/3 lg:w-1/2 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-bold transition-colors text-center shadow-sm hover:shadow-md"
                            >
                                Reiniciar Orçamento
                            </button>
                        </div>"""

if search_str in text:
    text = text.replace(search_str, replacement_str)
    print("Item summary patched successfully.")
else:
    print("Item summary NOT FOUND.")

# 3. Replace the final TFOOT with the giant blue card

search_str2 = """                                        <tfoot className="bg-indigo-600 text-white">
                                            <tr>
                                                <td colSpan="3" className="px-6 py-4 font-bold text-right uppercase tracking-wider">Subtotal do Projeto</td>
                                                <td className="px-6 py-4 text-right font-black text-2xl">
                                                    {projectSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td></td>
                                            </tr>
                                            <tr className="bg-indigo-900">
                                                <td colSpan="3" className="px-6 py-6 font-black text-right text-xl uppercase tracking-widest">Valor Total do Pedido</td>
                                                <td className="px-6 py-6 text-right font-black text-4xl">
                                                    {projectTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={handleSaveBudget}
                                                            className="p-3 bg-green-500 text-white rounded-xl shadow-lg hover:bg-green-600 transition-all transform hover:scale-110"
                                                            title="Salvar Orçamento"
                                                        >
                                                            <Save size={24} />
                                                        </button>
                                                        <button
                                                            onClick={() => window.print()}
                                                            className="p-3 bg-white text-indigo-900 rounded-xl shadow-lg hover:bg-gray-100 transition-all transform hover:scale-110"
                                                            title="Gerar PDF"
                                                        >
                                                            <DollarSign size={24} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>"""

replacement_str2 = """                                        <tfoot className="bg-white">
                                            <tr>
                                                <td colSpan="5" className="p-0 border-t border-gray-100">
                                                    <div className="bg-indigo-600 p-8 text-white w-full rounded-b-2xl shadow-inner flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                        <div className="text-center md:text-left">
                                                            <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Valor Total do Pedido</p>
                                                            <h2 className="text-5xl md:text-6xl font-black mt-2">
                                                                {projectTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </h2>
                                                            <div className="flex flex-wrap gap-4 mt-6">
                                                                <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                    <p className="text-[10px] text-indigo-200 uppercase font-black">Total Mat. Gasto</p>
                                                                    <p className="text-lg font-bold text-white">
                                                                        {totalMaterialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                    <p className="text-[10px] text-indigo-200 uppercase font-black">Impostos / NF</p>
                                                                    <p className="text-lg font-bold text-white">
                                                                        {totalTaxAndNfCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-white/20 px-4 py-2 rounded-xl border border-indigo-400/30">
                                                                    <p className="text-[10px] text-indigo-100 uppercase font-black">Lucro Estimado</p>
                                                                    <p className="text-lg font-bold text-green-300">
                                                                        {totalProjectProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-3">
                                                            <button
                                                                onClick={handleSaveBudget}
                                                                className="w-full px-8 py-4 bg-green-500 text-white rounded-2xl text-lg font-bold shadow-[0_10px_20px_rgba(34,197,94,0.3)] hover:bg-green-600 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                                                            >
                                                                <Save size={24} /> SALVAR ORÇAMENTO
                                                            </button>
                                                            <button
                                                                onClick={() => window.print()}
                                                                className="w-full px-8 py-3 bg-white text-indigo-900 rounded-xl text-sm font-bold shadow hover:bg-gray-100 transition-all flex items-center justify-center gap-2 border border-gray-200 hover:shadow-md"
                                                            >
                                                                <DollarSign size={20} /> IMPRIMIR PDF / RECIBO
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>"""

if search_str2 in text:
    text = text.replace(search_str2, replacement_str2)
    print("Footer patched successfully.")
else:
    print("Footer NOT FOUND.")

with open("src/pages/Orcamentos.jsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Finished python patch.")
