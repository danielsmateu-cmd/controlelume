const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /<Resumo expenses=\{expenses\} orders=\{orders\} \/>/;
console.log("Regex match:", regex.test(content));

console.log("Actual Resumo string:");
const match = content.match(/<Resumo.*?\/>/);
console.log(match ? match[0] : "not found");
