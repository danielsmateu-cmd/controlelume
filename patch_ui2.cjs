const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(
  /<td className="px-4 py-3 text-center text-xs font-bold text-gray-500 line-through">\s*R\$ \{Number\(listing\.price \|\| 0\)\.toFixed\(2\)\}\s*<\/td>\s*<td className="px-4 py-3 text-center text-xs font-bold text-green-700">\s*\{listing\.price_promo \? `R\$ \$\{Number\(listing\.price_promo\)\.toFixed\(2\)\}` : '—'\}\s*<\/td>/g,
  `<td className={"px-4 py-3 text-center text-xs font-bold " + (listing.price_promo ? "text-gray-400 line-through" : "text-gray-700")}>
     R$ {Number(listing.price || 0).toFixed(2)}
   </td>
   <td className="px-4 py-3 text-center text-xs font-bold text-green-700">
     {listing.price_promo ? \`R$ \${Number(listing.price_promo).toFixed(2)}\` : ''}
   </td>`
);

// Remove os diamantes na importacao caso existam
content = content.replace(/—/g, '-');
content = content.replace(//g, '-');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("UI patched.");
