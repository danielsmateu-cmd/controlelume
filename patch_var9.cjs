const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const targetStr = `                      </tr>
                    ))}
                  </tbody>`;

const newStr = `                      </tr>
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
                </tbody>`;

// normalize everything to \n to make sure matching works
let normContent = content.replace(/\r\n/g, '\n');
let normTarget = targetStr.replace(/\r\n/g, '\n');

if(normContent.includes(normTarget)) {
  normContent = normContent.replace(normTarget, newStr);
  fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', normContent);
  console.log("REPLACED!");
} else {
  console.log("NOT FOUND D:");
}
