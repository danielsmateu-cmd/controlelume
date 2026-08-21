const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const logicStr = `
  const handleUpdatePhysicalStock = async (listing) => {
    const qty = parseInt(stockValue);
    if (isNaN(qty) || qty < 0) return;
    await mlListings.updatePhysicalStock(listing.id, qty);
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, stock_physical: qty } : l));
    setEditingStock(null);
  };
`;
const newLogicStr = logicStr + `
  const handleUpdateVariationPhysicalStock = async (listing, variationId) => {
    const val = parseInt(stockValue, 10);
    if (isNaN(val) || val < 0) return;

    const newVariations = listing.variations.map(v => 
      v.id === variationId ? { ...v, stock_physical: val } : v
    );

    await mlListings.updateVariationPhysicalStock(listing.id, newVariations);
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, variations: newVariations } : l));
    setEditingStock(null);
  };
`;

content = content.replace(/const handleUpdatePhysicalStock = async \(listing\) \{[\s\S]*?setEditingStock\(null\);\n  \};\r?\n/, newLogicStr.trim() + '\n\n');

const varRowOld = `<td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-yellow-600 font-bold">{variation.stock}</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>`;

// Wait, the physical stock column is the 5th column. 1(Product), 2(FT), 3(Status), 4(Estoque ML), 5(Físico)
// Let's replace the td that is just `-` with the editing logic.
const varRowNew = `<td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-yellow-600 font-bold">{variation.stock}</td>
                        <td className="px-4 py-2 text-center">
                          {editingStock === \`\${listing.id}_phy_var_\${variation.id}\` ? (
                            <div className="flex items-center gap-1 justify-center">
                              <input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)} className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" />
                              <button onClick={() => handleUpdateVariationPhysicalStock(listing, variation.id)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                              <button onClick={() => setEditingStock(null)} className="text-red-400 hover:text-red-500"><X size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingStock(\`\${listing.id}_phy_var_\${variation.id}\`); setStockValue(variation.stock_physical ?? 0); }} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">
                              {variation.stock_physical ?? 0} <Edit2 size={10} />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>`;

content = content.replace(/<td className="px-4 py-2 text-center text-gray-400">-<\/td>\s*<td className="px-4 py-2 text-center text-gray-400">-<\/td>\s*<td className="px-4 py-2 text-center text-yellow-600 font-bold">\{variation\.stock\}<\/td>\s*<td className="px-4 py-2 text-center text-gray-400">-<\/td>\s*<td className="px-4 py-2 text-center text-gray-400">-<\/td>/g, varRowNew);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Patched UI physical variation");
