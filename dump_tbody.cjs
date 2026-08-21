const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// Print the block inside the mapping function
const match = content.match(/<tbody className="divide-y divide-gray-50">([\s\S]*?)<\/tbody>/);
if (match) {
    console.log(match[1]);
}
