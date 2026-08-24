const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Add imports
if (!content.includes('lucide-react')) {
    content = content.replace(/import { api } from '\.\/services\/api';/, `import { api } from './services/api';\nimport { Store, ShoppingCart, Wallet, Tag, Calculator } from 'lucide-react';`);
}

// Replace the block
const blockToReplace = content.match(/if \(activeTab === 'home'\) \{([\s\S]*?)\}\s*switch/)[0];

const newBlock = `if (activeTab === 'home') {
            return (
                <div className="flex flex-col h-full w-full items-center justify-center gap-12">
                    <img src="/Logo LUME.png" alt="Controle Lume Logo" className="w-[400px] h-auto" />
                    
                    {/* Acesso Rápido */}
                    <div className="w-full max-w-5xl px-4">
                        <h2 className="text-gray-500 font-bold mb-4 text-center">ACESSO RÁPIDO</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <button onClick={() => handleSetActiveTab('ecommerce')} className="flex flex-col items-center justify-center gap-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-6 px-4 rounded-2xl transition-all border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <Store size={32} />
                                Integração ML
                            </button>
                            <button onClick={() => handleSetActiveTab('vendas')} className="flex flex-col items-center justify-center gap-3 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-6 px-4 rounded-2xl transition-all border border-green-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <ShoppingCart size={32} />
                                Entradas
                            </button>
                            <button onClick={() => handleSetActiveTab('saida')} className="flex flex-col items-center justify-center gap-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-6 px-4 rounded-2xl transition-all border border-red-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <Wallet size={32} />
                                Saídas
                            </button>
                            <button onClick={() => handleSetActiveTab('precificacao')} className="flex flex-col items-center justify-center gap-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-6 px-4 rounded-2xl transition-all border border-yellow-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <Tag size={32} />
                                Precificação / FTs
                            </button>
                            <button onClick={() => handleSetActiveTab('orcamentos')} className="flex flex-col items-center justify-center gap-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-6 px-4 rounded-2xl transition-all border border-orange-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <Calculator size={32} />
                                Orçamentos
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        switch`;

content = content.replace(blockToReplace, newBlock);

fs.writeFileSync('src/App.jsx', content);
console.log("Patched successfully");
