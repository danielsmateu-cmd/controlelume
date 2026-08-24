const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const match = content.match(/if \(activeTab === 'home'\) \{([\s\S]*?)\}\s*switch/);
if (match) {
    console.log(match[0].substring(0, 500) + '...');
} else {
    console.log('Not found');
}
