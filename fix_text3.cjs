const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// replace known corruptions in this file
content = content.replace(/Varia\S+o/g, 'Variação');
content = content.replace(/Pre\S+o\s+Orig/g, 'Preço Orig');
content = content.replace(/Promo\S+o/g, 'Promoção');
content = content.replace(/A\S+es/g, 'Ações');
content = content.replace(/F\S+sico/gi, 'Físico');
content = content.replace(/Hist\S+rico/gi, 'Histórico');
content = content.replace(/an\S+ncio/g, 'anúncio');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Done text fix!");
