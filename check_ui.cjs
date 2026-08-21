const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// Print the table headers to see the corruption:
const thMatch = content.match(/<thead.*?<\/thead>/s);
if (thMatch) {
    console.log("THEAD:");
    console.log(thMatch[0]);
}

// Print the variation string:
const varMatch = content.match(/<span className="text-gray-600 font-medium">.*?<\/span>/s);
if (varMatch) {
    console.log("VARIATION:");
    console.log(varMatch[0]);
}
