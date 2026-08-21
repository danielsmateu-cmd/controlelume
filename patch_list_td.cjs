const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// 1. Add listing sales tally cell
const listingTdRegex = /<button onClick=\{\(\) => \{ setEditingStock\(listing\.id \+ '_phy'\); setStockValue\(listing\.stock_physical \?\? 0\); \}\} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">\s*\{listing\.stock_physical \?\? 0\} <Edit2 size=\{10\} \/>\s*<\/button>\s*\)\}\s*<\/td>/;

const newListingTd = `<button onClick={() => { setEditingStock(listing.id + '_phy'); setStockValue(listing.stock_physical ?? 0); }} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">
                              {listing.stock_physical ?? 0} <Edit2 size={10} />
                            </button>
                          )}
                        </td>
                        {salesTally && (
                          <td className="px-4 py-3 text-center text-xs font-bold text-blue-600 bg-blue-50/50">
                            {salesTally[listing.ml_item_id] ? Math.max(0, salesTally[listing.ml_item_id].total - (listing.stock_ml || 0)) : 0}
                          </td>
                        )}`;

if (listingTdRegex.test(content)) {
    content = content.replace(listingTdRegex, newListingTd);
    console.log("Replaced listing TD");
} else {
    console.log("Failed to replace listing TD");
}

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
