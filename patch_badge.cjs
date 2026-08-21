const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

const oldStr = `{listing.sku && <p className="text-[10px] text-gray-400">SKU: {listing.sku}</p>}
                          </div>
                        </div>`;

const oldStr2 = `{listing.sku && <p className="text-[10px] text-gray-400">SKU: {listing.sku}</p>}\r\n                          </div>\r\n                        </div>`;
const oldStr3 = `{listing.sku && <p className="text-[10px] text-gray-400">SKU: {listing.sku}</p>}\n                          </div>\n                        </div>`;

const newStr = `{listing.sku && <p className="text-[10px] text-gray-400">SKU: {listing.sku}</p>}
                            {listing.logistic_type === 'fulfillment' ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">? FULL</span>
                            ) : listing.logistic_type === 'cross_docking' ? (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">Envio Imediato</span>
                            ) : listing.logistic_type ? (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600">Normal</span>
                            ) : null}
                          </div>
                        </div>`;

if(content.includes(oldStr)) content = content.replace(oldStr, newStr);
else if(content.includes(oldStr2)) content = content.replace(oldStr2, newStr);
else if(content.includes(oldStr3)) content = content.replace(oldStr3, newStr);
else console.log("Not found!");

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Updated logistic type badge!");
