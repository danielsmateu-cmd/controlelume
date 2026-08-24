const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Use explicit emojis or just clear text for now, but let's try direct assignment
const btnML = `<button onClick={() => handleSetActiveTab('ecommerce')} className="flex flex-col items-center justify-center gap-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-6 px-4 rounded-2xl transition-all border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Integração ML
                            </button>`;
const btnVendas = `<button onClick={() => handleSetActiveTab('vendas')} className="flex flex-col items-center justify-center gap-3 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-6 px-4 rounded-2xl transition-all border border-green-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Entradas
                            </button>`;
const btnSaida = `<button onClick={() => handleSetActiveTab('saida')} className="flex flex-col items-center justify-center gap-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-6 px-4 rounded-2xl transition-all border border-red-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">??</span>
                                Saídas
                            </button>`;
const btnPrec = `<button onClick={() => handleSetActiveTab('precificacao')} className="flex flex-col items-center justify-center gap-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-6 px-4 rounded-2xl transition-all border border-yellow-100 shadow-sm hover:shadow-md hover:-translate-y-1">
                                <span className="text-3xl">???</span>
                                Precificação / FTs
                            </button>`;

content = content.replace(/<button onClick=\{\(\) => handleSetActiveTab\('ecommerce'\)\}.*?<\/button>/s, btnML);
content = content.replace(/<button onClick=\{\(\) => handleSetActiveTab\('vendas'\)\}.*?<\/button>/s, btnVendas);
content = content.replace(/<button onClick=\{\(\) => handleSetActiveTab\('saida'\)\}.*?<\/button>/s, btnSaida);
content = content.replace(/<button onClick=\{\(\) => handleSetActiveTab\('precificacao'\)\}.*?<\/button>/s, btnPrec);

fs.writeFileSync('src/App.jsx', content);
