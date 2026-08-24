const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Fix imports:
content = content.replace(/import Or.*from '.\/pages\/Or.*';/, "import Orcamentos from './pages/Orcamentos';");
// Fix component render
content = content.replace(/return <Or.* materials=\{materials\}/, "return <Orcamentos materials={materials}");

// Ensure the ACESSO RAPIDO label is correct
content = content.replace(/ACESSO R.*?PIDO/g, 'ACESSO R\u00C1PIDO');

fs.writeFileSync('src/App.jsx', content);
