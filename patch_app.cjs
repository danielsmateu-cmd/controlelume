const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(/<Resumo expenses=\{expenses\} orders=\{orders\} \/>/, '<Resumo expenses={expenses} orders={orders} setActiveTab={setActiveTab} />');

fs.writeFileSync('src/App.jsx', content);
