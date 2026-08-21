const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// Regex to replace `<tr key={listing.id}`... with `<React.Fragment key={listing.id}><tr ...`
content = content.replace(
  /<tr key=\{listing\.id\} className="hover:bg-gray-50\/50 transition-colors">/g,
  '<React.Fragment key={listing.id}>\n<tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">'
);

// Regex to replace the closing `</tr>` inside the map with the variations logic
content = content.replace(
  /<\/tr>\s*\}\)\}\s*<\/tbody>/g,
  `</tr>
                    {listing.variations && listing.variations.map(variation => (
                      <tr key={variation.id} className="border-b border-gray-50 bg-gray-50/40 text-[11px]">
                        <td className="px-4 py-2 pl-12 flex items-center gap-2">
                          <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
                          <span className="text-gray-600 font-medium">Variação: {variation.attributes}</span>
                        </td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-yellow-600 font-bold">{variation.stock}</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                        <td className="px-4 py-2 text-center text-gray-400">-</td>
                      </tr>
                    ))}
                    </React.Fragment>
                  ))}
                </tbody>`
);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Done");
