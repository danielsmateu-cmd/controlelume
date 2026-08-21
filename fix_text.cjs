const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(/Variao:/g, 'Variação:');
content = content.replace(/Variao:/g, 'Variação:');
content = content.replace(/Preo/g, 'Preço');
content = content.replace(/Promoo/g, 'Promoção');
content = content.replace(/Aes/g, 'Ações');
content = content.replace(/Histrico/g, 'Histórico');
content = content.replace(/anncio/g, 'anúncio');
content = content.replace(/Fsico/g, 'Físico');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Text encoding fixed.");
