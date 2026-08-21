const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(/Varia\ufffdo/g, 'Variação');
content = content.replace(/Pre\ufffdo/g, 'Preço');
content = content.replace(/Promo\ufffdo/g, 'Promoção');
content = content.replace(/A\ufffdes/g, 'Ações');
content = content.replace(/Hist\ufffdrico/g, 'Histórico');
content = content.replace(/an\ufffdncio/g, 'anúncio');
content = content.replace(/F\ufffdsico/g, 'Físico');

// also try standard replacement character if \ufffd doesn't work
content = content.replace(/Varia.o/g, 'Variação');
content = content.replace(/Pre.o Orig/g, 'Preço Orig');
content = content.replace(/Promo..o/g, 'Promoção'); // it could be two chars depending on encoding
content = content.replace(/A..es/g, 'Ações');
content = content.replace(/F.SICO/g, 'FÍSICO');
content = content.replace(/F.sico/g, 'Físico');
content = content.replace(/Hist.rico/g, 'Histórico');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Text encoding fixed (with regex dot).");
