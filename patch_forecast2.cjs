const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const stateStr = `  const [salesTally, setSalesTally] = useState(null);
  const [calculatingTally, setCalculatingTally] = useState(false);
  const [coverageDays, setCoverageDays] = useState(30);

  const handleCalculateTally = async () => {
    setCalculatingTally(true);
    try {
      const tally = await mlApi.calculateSalesVelocity(coverageDays);
      setSalesTally(tally);
    } catch(e) { alert("Erro ao calcular: "+e.message); }
    setCalculatingTally(false);
  };
`;
content = content.replace(/  const \[searchTerm, setSearchTerm\] = useState\(''\);/, `  const [searchTerm, setSearchTerm] = useState('');\n${stateStr}`);

// Add button to top bar near "Sincronizar"
const oldSyncBtn = `<button onClick={handleSync} disabled={syncing}`;
const newSyncBtn = `
        <div className="flex items-center gap-2">
          <select 
            value={coverageDays} 
            onChange={e => setCoverageDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
          </select>
          <button 
            onClick={handleCalculateTally} 
            disabled={calculatingTally}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {calculatingTally ? <RefreshCw size={14} className="animate-spin" /> : <BarChart2 size={14} />}
            Calcular Sugestão
          </button>
        </div>
        <button onClick={handleSync} disabled={syncing}
`;
content = content.replace(oldSyncBtn, newSyncBtn);

// Add Column Header (use unicode literal to match exactly)
const oldTh = `<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_physical')}>F\\u00EDsico \\u2195</th>`.replace(/\\u([0-9a-fA-F]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16)));
const newTh = oldTh + `\n                    {salesTally && <th className="px-4 py-3 text-center text-xs font-bold text-blue-600 uppercase">Sugestão ({coverageDays}d)</th>}`;
content = content.replace(oldTh, newTh);

// Add Cell for Listing
const oldTdPhysicalEnd = `                            </button>
                          )}
                        </td>`;
const newTdPhysicalEnd = `                            </button>
                          )}
                        </td>
                        {salesTally && (
                          <td className="px-4 py-3 text-center text-xs font-bold text-blue-600 bg-blue-50/50">
                            {salesTally[listing.ml_item_id] ? Math.max(0, salesTally[listing.ml_item_id].total - (listing.stock_ml || 0)) : 0}
                          </td>
                        )}`;
content = content.replace(oldTdPhysicalEnd, newTdPhysicalEnd);

// Add Cell for Variations
// We need to match the specific cell after the stock_physical editor.
const oldVarEnd = `</button>
                            )}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>`;
const newVarEnd = `</button>
                            )}
                        </td>
                        {salesTally && (
                          <td className="px-4 py-2 text-center text-blue-600 font-bold bg-blue-50/50">
                            {salesTally[listing.ml_item_id]?.variations?.[variation.id] ? Math.max(0, salesTally[listing.ml_item_id].variations[variation.id] - (variation.stock || 0)) : 0}
                          </td>
                        )}
                        <td className="px-4 py-2 text-center text-gray-400">-</td>`;
content = content.replace(oldVarEnd, newVarEnd);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Re-patched properly");
