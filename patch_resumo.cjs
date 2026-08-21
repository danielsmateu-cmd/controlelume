const fs = require('fs');
let content = fs.readFileSync('src/pages/Resumo.jsx', 'utf8');

// 1. Receive setActiveTab
content = content.replace(/const Resumo = \(\{ expenses, orders \}\) => \{/, 'const Resumo = ({ expenses, orders, setActiveTab }) => {');

// 2. Import some icons if we need them, but lucide-react might not be fully imported.
// Let's check what's imported from lucide-react.
const hasLucide = content.includes('lucide-react');
if(!hasLucide) {
    content = content.replace(/import { api } from '\.\.\/services\/api';/, `import { api } from '../services/api';\nimport { ShoppingCart, Wallet, Tag, Store } from 'lucide-react';`);
}

// 3. Create the Shortcuts UI
const shortcutsUI = `
            {/* Acesso Rápido */}
            {setActiveTab && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <button onClick={() => setActiveTab('ecommerce')} className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-xl transition-colors border border-indigo-100 shadow-sm">
                        <Store size={18} />
                        Integração ML
                    </button>
                    <button onClick={() => setActiveTab('vendas')} className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-3 px-4 rounded-xl transition-colors border border-green-100 shadow-sm">
                        <ShoppingCart size={18} />
                        Entradas
                    </button>
                    <button onClick={() => setActiveTab('saida')} className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-3 px-4 rounded-xl transition-colors border border-red-100 shadow-sm">
                        <Wallet size={18} />
                        Saídas
                    </button>
                    <button onClick={() => setActiveTab('precificacao')} className="flex items-center justify-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-3 px-4 rounded-xl transition-colors border border-yellow-100 shadow-sm">
                        <Tag size={18} />
                        Precificação / FTs
                    </button>
                </div>
            )}
`;

content = content.replace(/<div className="space-y-3">/, `<div className="space-y-3">\n${shortcutsUI}`);

fs.writeFileSync('src/pages/Resumo.jsx', content);
console.log("Patched Resumo.jsx");
