const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(/Varia.*o:/g, 'Variação:');
content = content.replace(/Hist.*rico/g, 'Histórico');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
