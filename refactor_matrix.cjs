const fs = require('fs');
let code = fs.readFileSync('src/pages/ecommerce/CadastrosFTs.jsx', 'utf-8');
const lines = code.split('\n');

const matrixStart = lines.findIndex(l => l.includes('Modal de Matriz Venda x Margem'));

const openIdx = lines.findIndex(l => l.includes('{isMatrixOpen && ('));
const closeIdx = lines.findIndex((l, i) => i > openIdx && l.trim() === ')}' && lines[i+1] && lines[i+1].includes('</div>'));

const matrixJSX = lines.slice(openIdx + 1, closeIdx).join('\n');

const newMatrixBlock = '    if (isMatrixOpen) {\n' + 
'        return (\n' + 
'            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full flex flex-col h-[calc(100vh-6rem)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">\n' + 
'                {/* Header */}\n' + 
'                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">\n' + 
'                    <div>\n' + 
'                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">\n' + 
'                            📊 Matriz Comparativa: Vendas x Margens\n' + 
'                        </h3>\n' + 
'                        <p className="text-xs text-gray-500 mt-0.5">Preço de Venda (R$) e Margem de Contribuição (%) cadastrados em cada Marketplace.</p>\n' + 
'                    </div>\n' + 
'                    <button onClick={() => setIsMatrixOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">\n' + 
'                        Voltar para FTs\n' + 
'                    </button>\n' + 
'                </div>\n' + 
'                {/* Body */}\n' + 
matrixJSX.split('                        {/* Body */}')[1].split('                        {/* Footer */}')[0] +
'            </div>\n' + 
'        );\n' + 
'    }\n';

// Remove old matrix block (also remove the comment above it)
lines.splice(matrixStart - 1, closeIdx - matrixStart + 2);

const exactReturnIdx = lines.findIndex(l => l === '    return (');
lines.splice(exactReturnIdx, 0, newMatrixBlock);

fs.writeFileSync('src/pages/ecommerce/CadastrosFTs.jsx', lines.join('\n'));
console.log('Matrix updated!');
