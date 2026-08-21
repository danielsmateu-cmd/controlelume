const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const oldRow = `<td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>`;

const newRow = `<td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400 line-through">R$ {Number(variation.price || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>
                        <td className="px-4 py-2 text-center text-gray-400">—</td>`;

if (content.includes(oldRow)) {
  content = content.replace(oldRow, newRow);
  fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
  console.log("Patched variation price.");
} else {
  console.log("Not found.");
}
