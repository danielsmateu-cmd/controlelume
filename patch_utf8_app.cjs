const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(/ACESSO R.PIDO/g, 'ACESSO R\\u00C1PIDO'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Integra.*?o ML/g, 'Integra\\u00E7\\u00E3o ML'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Sa.*?das/g, 'Sa\\u00EDdas'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/Precifica.*?o \/ FTs/g, 'Precifica\\u00E7\\u00E3o / FTs'.replace(/\\u([0-9A-Fa-f]{4})/g, (m, g1) => String.fromCharCode(parseInt(g1, 16))));
content = content.replace(/<span className="text-3xl">\?\?<\/span>/g, '<span className="text-3xl">??</span>');

fs.writeFileSync('src/App.jsx', content);
