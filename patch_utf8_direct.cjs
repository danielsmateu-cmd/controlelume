const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(/ACESSO R.*? Q /g, 'ACESSO R\\u00C1PIDO'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Integra\S+ ML/g, 'Integra\\u00E7\\u00E3o ML'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Sa\S+das/g, 'Sa\\u00EDdas'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Precifica\S+ \/ FTs/g, 'Precifica\\u00E7\\u00E3o / FTs'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Or\S+amentos/g, 'Or\\u00E7amentos'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));

fs.writeFileSync('src/App.jsx', content);
console.log("Fixed via Unicode escapes directly in Node");
