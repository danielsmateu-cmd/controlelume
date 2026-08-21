const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const match = content.match(/Varia.*?o/);
console.log(match ? match[0] : "Not found Varia");
