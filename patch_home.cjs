const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// The icon imports are needed in App.jsx now
const hasLucide = content.includes('import {');
// Let's just find the lucide-react import and add the icons to it if they are not there
if (content.includes('lucide-react')) {
    // We already import icons in App.jsx? Let's check what it imports.
    // I'll just use the raw SVG or simple buttons to avoid import issues, 
    // OR just add Store, ShoppingCart, Wallet, Tag to the lucide-react import.
}

content = content.replace(
    /if \(activeTab === 'home'\) \{\s*return \(\s*<div className="flex h-full w-full items-center justify-center">\s*<img src="\/Logo LUME\.png" alt="Controle Lume Logo" className="w-\[400px\] h-auto" \/>\s*<\/div>\s*\);\s*\}/,
    `if (activeTab === 'home') {
            return (
                <div className="flex flex-col h-full w-full items-center justify-center gap-12">
                    <img src="/Logo LUME.png" alt="Controle Lume Logo" className="w-[400px] h-auto" />
                    
                    {/* Acesso Rápido */}
                    <div className="w-full max-w-4xl px-4">
                        <h2 className="text-gray-500 font-bold mb-4 text-center">ACESSO RÁPIDO</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <button onClick={() => handleSetActiveTab('ecommerce')} className="flex flex-col items-center justify-center gap-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-6 px-4 rounded-2xl transition-all border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Integração ML
                            </button>
                            <button onClick={() => handleSetActiveTab('vendas')} className="flex flex-col items-center justify-center gap-3 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-6 px-4 rounded-2xl transition-all border border-green-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Entradas
                            </button>
                            <button onClick={() => handleSetActiveTab('saida')} className="flex flex-col items-center justify-center gap-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-6 px-4 rounded-2xl transition-all border border-red-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Saídas
                            </button>
                            <button onClick={() => handleSetActiveTab('precificacao')} className="flex flex-col items-center justify-center gap-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-6 px-4 rounded-2xl transition-all border border-yellow-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">???</span>
                                Precificação / FTs
                            </button>
                        </div>
                    </div>
                </div>
            );
        }`
);

fs.writeFileSync('src/App.jsx', content);
