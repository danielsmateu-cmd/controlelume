const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// I will match exact bad strings
content = content.replace(/Sugest\ufffdo/g, "Sugest\u00e3o");
content = content.replace(/Sugest.o/g, "Sugest\u00e3o");

content = content.replace(/Hist\ufffdrico/g, "Hist\u00f3rico");
content = content.replace(/Hist.rico/g, "Hist\u00f3rico");

content = content.replace(/F\ufffdsico/g, "F\u00edsico");
content = content.replace(/F.sico/g, "F\u00edsico");

content = content.replace(/Promo\ufffdo/g, "Promo\u00e7\u00e3o");
content = content.replace(/Promo\ufffd\ufffdo/g, "Promo\u00e7\u00e3o");
content = content.replace(/Promo\S+o/g, "Promo\u00e7\u00e3o");

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Text encoded successfully");
