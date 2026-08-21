const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(
  /<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preço<\/th>/g,
  `<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preço Orig.</th>
   <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promoção</th>`
);

content = content.replace(
  /listing\.available_quantity/g,
  'listing.stock_ml'
);

content = content.replace(
  /<td className="px-4 py-3 text-center text-xs font-bold text-gray-700">\s*R\$ \{Number\(listing\.price \|\| 0\)\.toFixed\(2\)\}\s*<\/td>/g,
  `<td className="px-4 py-3 text-center text-xs font-bold text-gray-500 line-through">
     R$ {Number(listing.price || 0).toFixed(2)}
   </td>
   <td className="px-4 py-3 text-center text-xs font-bold text-green-700">
     {listing.price_promo ? \`R$ \${Number(listing.price_promo).toFixed(2)}\` : '—'}
   </td>`
);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Done via node.");
