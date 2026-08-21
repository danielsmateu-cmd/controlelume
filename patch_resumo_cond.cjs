const fs = require('fs');
let content = fs.readFileSync('src/pages/Resumo.jsx', 'utf8');

// Remove the condition
content = content.replace(/\{setActiveTab && \(\s*<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">/, '<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">');
content = content.replace(/<\/button>\s*<\/div>\s*\)\}\s*<div className="flex flex-col/g, '</button>\n                </div>\n\n            <div className="flex flex-col');

// Also forcefully fix texts
content = content.replace(/Integra\S+o ML/g, "Integra\u00E7\u00E3o ML");
content = content.replace(/Precifica\S+o \/ FTs/g, "Precifica\u00E7\u00E3o / FTs");
content = content.replace(/Sa\S+das/g, "Sa\u00EDdas");

fs.writeFileSync('src/pages/Resumo.jsx', content);
