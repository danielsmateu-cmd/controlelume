const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const newThead = `<thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('title')}>Produto \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ft_id')}>FT \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>Status \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_ml')}>Estoque ML \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_physical')}>F\\u00EDsico \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('price')}>Pre\\u00E7o Orig. \\u2195</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promo\\u00E7\\u00E3o</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">A\\u00E7\\u00F5es</th>
                  </tr>
                </thead>`;

// Replace thead using a non-greedy regex
content = content.replace(/<thead className="bg-gray-50 border-b border-gray-100">[\s\S]*?<\/thead>/, 
  newThead.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));

// Also fix variation text
content = content.replace(/<span className="text-gray-600 font-medium text-xs">Varia.*?o: (\{variation\.attributes\})<\/span>/g,
  '<span className="text-gray-600 font-medium text-xs">Varia\\u00E7\\u00E3o: $1</span>'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Safe replace done");
