const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const oldStart = `{listings.map(listing => (
                    <tr key={listing.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">`;

const newStart = `{listings.map(listing => (
                    <React.Fragment key={listing.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">`;

content = content.replace(oldStart, newStart);

const oldEnd = `                        </td>
                    </tr>
                    ))}`;

const newEnd = `                        </td>
                    </tr>
                    {listing.variations && listing.variations.map(variation => (
                      <tr key={variation.id} className="border-b border-gray-50 bg-gray-50/40 text-[11px]">
                        <td className="px-4 py-2 pl-12 flex items-center gap-2">
                          <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
                          <span className="text-gray-600 font-medium">Variação: {variation.attributes}</span>
                        </td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-yellow-600 font-bold">{variation.stock}</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                      </tr>
                    ))}
                    </React.Fragment>
                    ))}`;

content = content.replace(oldEnd, newEnd);
fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Updated variations UI");
