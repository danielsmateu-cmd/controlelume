const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Restore the import and component usages
content = content.replace(/import Orçamentos from '\.\/pages\/Orçamentos';/g, "import Orcamentos from './pages/Orcamentos';");
content = content.replace(/<Orçamentos materials/g, "<Orcamentos materials");

fs.writeFileSync('src/App.jsx', content);
console.log("Restored Orcamentos imports");
