const fs = require('fs');
let content = fs.readFileSync('src/pages/Resumo.jsx', 'utf8');

content = content.replace(/Integra\ufffdo ML/g, "Integração ML");
content = content.replace(/Precifica\ufffdo \/ FTs/g, "Precificação / FTs");
content = content.replace(/Sa\ufffdas/g, "Saídas");
// some might be single char matching
content = content.replace(/Integra.*?o ML/g, "Integra\u00E7\u00E3o ML");
content = content.replace(/Precifica.*?o \/ FTs/g, "Precifica\u00E7\u00E3o / FTs");
content = content.replace(/Sa.*?das/g, "Sa\u00EDdas");

fs.writeFileSync('src/pages/Resumo.jsx', content);
