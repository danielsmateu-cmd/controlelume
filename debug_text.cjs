const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const match = content.match(/Varia\S+o/);
console.log("VariaMatch:", match ? match[0] : "none");

const match2 = content.match(/Pre\S+o/);
console.log("PrecoMatch:", match2 ? match2[0] : "none");

// Just forcefully replace the table headers:
content = content.replace(/<th>.*?<\/th>/gi, (m) => {
  if(m.includes("Pre")) return '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preço Orig.</th>';
  if(m.includes("Promo")) return '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promoção</th>';
  if(m.includes("A")) return '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>';
  if(m.includes("F")) return '<th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Físico</th>';
  return m;
});

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
