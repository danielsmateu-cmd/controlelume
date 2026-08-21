const fs = require('fs');
let content = fs.readFileSync('src/pages/Resumo.jsx', 'utf8');

// Restore the line
content = content.replace(/if \(savedVendas && Object\.keys\(dbSa.*?;/, "if (savedVendas && Object.keys(dbSales).length === 0) dbSales = JSON.parse(savedVendas);");

fs.writeFileSync('src/pages/Resumo.jsx', content);
