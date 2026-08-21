const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

content = content.replace(/Varia\ufffdo:/g, 'Variação:');
content = content.replace(/Pre\ufffdo Orig./g, 'Preço Orig.');
content = content.replace(/Promo\ufffdo/g, 'Promoção');
content = content.replace(/A\ufffdes/g, 'Ações');
content = content.replace(/F\ufffdsico/g, 'Físico');
content = content.replace(/Hist\ufffdrico/g, 'Histórico');

// the file currently has replacement characters (0xFFFD) if it was corrupted by powershell, let's just do a manual replace of the th elements:
content = content.replace(/<th.*?Pre.*?Orig.*?<\/th>/g, '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preço Orig.</th>');
content = content.replace(/<th.*?Promo.*?<\/th>/g, '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promoção</th>');
content = content.replace(/<th.*?A.*es.*?<\/th>/g, '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>');
content = content.replace(/<th.*?F.*sico.*?<\/th>/g, '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Físico</th>');

content = content.replace(/Varia.*o:/g, 'Variação:');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Safe text fix done.");
