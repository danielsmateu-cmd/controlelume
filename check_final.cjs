const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const matches = content.match(/ACESSO R.PIDO|Integra.* ML|Sa.*das|Precifica.* \/ FTs|Or.*amentos/g);
console.log(matches);
