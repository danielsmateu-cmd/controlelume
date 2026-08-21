const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// Insert the state and sorting function
const importLine = `import React, { useState, useEffect, useCallback, useMemo } from 'react';`;
content = content.replace(/import React.*?from 'react';/, importLine);

const stateInsert = `
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredListings = useMemo(() => {
    let result = [...listings];
    
    // search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.title?.toLowerCase().includes(lower) || 
        item.ft_id?.toLowerCase().includes(lower) ||
        item.ml_item_id?.toLowerCase().includes(lower)
      );
    }
    
    // sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [listings, sortConfig, searchTerm]);
`;

// we need to insert it right before `useEffect(() => { loadFts(); }, []);`
content = content.replace(/useEffect\(\(\) => \{\s+loadFts\(\);\s+\}, \[\]\);/, stateInsert + '\n  useEffect(() => {\n    loadFts();\n  }, []);');

// we need to add the search bar UI!
const searchUI = `
            <div className="flex items-center gap-2 mt-4">
              <input 
                type="text" 
                placeholder="Buscar por Título, ID do ML ou FT..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
`;
content = content.replace(/<div className="flex gap-2">([\s\S]*?)<\/div>\s*<\/div>\s*<div className="overflow-x-auto">/, 
  `<div className="flex gap-2">$1</div>\n          </div>\n${searchUI}\n          <div className="overflow-x-auto mt-4">`);

// Replace `{listings.map(listing => (` with `{filteredListings.map(listing => (`
content = content.replace(/\{listings\.map\(listing => \(/g, '{filteredListings.map(listing => (');

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Added sort and search");
