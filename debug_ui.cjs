const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const regex = /<\/tr>\s*\}\)\}\s*<\/tbody>\s*<\/table>/m;
const match = content.match(regex);
if (match) {
  console.log("Regex match found!");
} else {
  console.log("Regex match NOT found!");
}

// Actually, let's just do a string replace on the exact text.
// Let's print a part of the table body closing to see exactly what's there.
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('{listings.map'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('</table>'));

console.log(lines.slice(startIdx, endIdx).join('\n'));
