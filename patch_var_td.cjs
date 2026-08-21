const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const varTdRegex = /<button onClick=\{\(\) => \{ setEditingStock\(`\$\{listing\.id\}_phy_var_\$\{variation\.id\}`\); setStockValue\(variation\.stock_physical \?\? 0\); \}\} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">\s*\{variation\.stock_physical \?\? 0\} <Edit2 size=\{10\} \/>\s*<\/button>\s*\)\}\s*<\/td>\s*<td className="px-4 py-2 text-center text-gray-400">-<\/td>/;

const newVarTd = `<button onClick={() => { setEditingStock(\`\${listing.id}_phy_var_\${variation.id}\`); setStockValue(variation.stock_physical ?? 0); }} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">
                                {variation.stock_physical ?? 0} <Edit2 size={10} />
                              </button>
                            )}
                          </td>
                          {salesTally && (
                            <td className="px-4 py-2 text-center text-blue-600 font-bold bg-blue-50/50">
                              {salesTally[listing.ml_item_id]?.variations?.[variation.id] ? Math.max(0, salesTally[listing.ml_item_id].variations[variation.id] - (variation.stock || 0)) : 0}
                            </td>
                          )}
                          <td className="px-4 py-2 text-center text-gray-400">-</td>`;

if (varTdRegex.test(content)) {
    content = content.replace(varTdRegex, newVarTd);
    console.log("Replaced variation TD");
} else {
    console.log("Failed to replace variation TD");
}

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
