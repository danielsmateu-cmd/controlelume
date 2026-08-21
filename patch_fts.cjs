const fs = require('fs');
let content = fs.readFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', 'utf8');

// Remove fts from props
content = content.replace(/export default function MercadoLivreIntegracao\(\{ fts \}\) \{/, 'export default function MercadoLivreIntegracao() {');

const insertLogic = `
  const [fts, setFts] = useState([]);

  useEffect(() => {
    const loadFts = async () => {
      try {
        const ftsData = await api.getFts();
        setFts(ftsData || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadFts();
  }, []);
`;

// Insert after the state declarations
content = content.replace(/(const \[dateTo, setDateTo\] = useState.*?;\s*)/, `$1\n${insertLogic}\n`);

fs.writeFileSync('src/pages/ecommerce/MercadoLivreIntegracao.jsx', content);
console.log("Added loadFts");
