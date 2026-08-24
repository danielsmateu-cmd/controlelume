const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Base64 encoded UTF-8 strings
const dict = {
    'ACESSO_RAPIDO': 'QUNFU1NPIFJDVBJRE8=', // ACESSO RÁPIDO
    'INTEGRACAO_ML': 'SW50ZWdyYcOnw6NvIE1M', // Integração ML
    'SAIDAS': 'U2HDrWRhcw==', // Saídas
    'PRECIFICACAO': 'UHJlY2lmaWNhw6fDo28gLyBGVHM=', // Precificação / FTs
    'ORCAMENTOS': 'T3LDp2FtZW50b3M=' // Orçamentos
};

const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8');

// The file currently has corrupted characters. We'll use regex to match the broken parts.
content = content.replace(/ACESSO R.*?PIDO/g, decode(dict.ACESSO_RAPIDO));
content = content.replace(/Integra.*?o ML/g, decode(dict.INTEGRACAO_ML));
content = content.replace(/Sa.*?das/g, decode(dict.SAIDAS));
content = content.replace(/Precifica.*?o \/ FTs/g, decode(dict.PRECIFICACAO));
content = content.replace(/Or.*?amentos/g, decode(dict.ORCAMENTOS));

fs.writeFileSync('src/App.jsx', content);
console.log("Fixed encodings safely via Base64");
