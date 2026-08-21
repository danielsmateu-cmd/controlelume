const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// 1. Fix Headers (And add sorting functionality!)
const oldThead = `<thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">FT</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Estoque ML</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Fsico</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preo Orig.</th>
   <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promoo</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Aes</th>
                  </tr>
                </thead>`;

const newThead = `<thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('title')}>Produto ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ft_id')}>FT ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>Status ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_ml')}>Estoque ML ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_physical')}>Físico ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-200" onClick={() => handleSort('price')}>Preço Orig. ?</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Promoção</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>`;
                
// Let's use regex for oldThead to be safe against whitespace
content = content.replace(/<thead className="bg-gray-50 border-b border-gray-100">[\s\S]*?<\/thead>/, newThead);

// 2. Fix Variation Text and add Image
// Previous variation block:
// <td className="px-4 py-2 pl-12 flex items-center gap-2">
//   <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
//   <span className="text-gray-600 font-medium">Variao: {variation.attributes}</span>
// </td>

content = content.replace(/<td className="px-4 py-2 pl-12 flex items-center gap-2">[\s\S]*?<\/td>/g, 
  `<td className="px-4 py-2 pl-12 flex items-center gap-2">
    <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
    {variation.thumbnail && <img src={variation.thumbnail} alt="" className="w-6 h-6 rounded object-cover" />}
    <span className="text-gray-600 font-medium text-xs">Variação: {variation.attributes}</span>
  </td>`);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Replaced thead and variations!");
