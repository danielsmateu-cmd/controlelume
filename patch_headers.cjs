const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(/Sugest.*?o \(/g, 'Sugest\\u00E3o ('.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Promo.*?o<\/th>/g, 'Promo\\u00E7\\u00E3o</th>'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Pre.*?o Orig./g, 'Pre\\u00E7o Orig.'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/A.*?es<\/th>/g, 'A\\u00E7\\u00F5es</th>'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/>F.*?sico /g, '>F\\u00EDsico '.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Hist.*?rico/g, 'Hist\\u00F3rico'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Varia.*?o:/g, 'Varia\\u00E7\\u00E3o:'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
