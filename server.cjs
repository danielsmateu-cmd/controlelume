// Server - API REST para salvar dados em arquivos JSON
// Usa apenas módulos nativos do Node.js (sem dependências externas)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');

// Garantir que a pasta data existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: ler arquivo JSON
function readJsonFile(filename) {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, '[]', 'utf-8');
        return [];
    }
    try {
        const data = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Erro ao ler ${filename}:`, e.message);
        return [];
    }
}

// Helper: escrever arquivo JSON
function writeJsonFile(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper: ler body do request
function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('JSON inválido'));
            }
        });
        req.on('error', reject);
    });
}

// Helper: enviar resposta JSON
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
}

// Extrair ID da URL: /api/budgets/123 -> "123"
function extractId(url, basePath) {
    const match = url.match(new RegExp(`^${basePath}/(\\d+)`));
    return match ? match[1] : null;
}

const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    try {
        // ==================== MATERIAIS ====================
        if (url === '/api/materials' && method === 'GET') {
            const materials = readJsonFile('materials.json');
            sendJson(res, 200, materials);
        }
        else if (url === '/api/materials' && method === 'POST') {
            const body = await getBody(req);
            const materials = readJsonFile('materials.json');
            const newMaterial = { ...body, id: Date.now() };
            materials.push(newMaterial);
            writeJsonFile('materials.json', materials);
            sendJson(res, 201, newMaterial);
        }
        else if (url.startsWith('/api/materials/') && method === 'DELETE') {
            const id = extractId(url, '/api/materials');
            if (!id) return sendJson(res, 400, { error: 'ID inválido' });
            let materials = readJsonFile('materials.json');
            materials = materials.filter(m => String(m.id) !== id);
            writeJsonFile('materials.json', materials);
            sendJson(res, 200, { success: true });
        }

        // ==================== ORÇAMENTOS ====================
        else if (url === '/api/budgets' && method === 'GET') {
            const budgets = readJsonFile('budgets.json');
            sendJson(res, 200, budgets);
        }
        else if (url === '/api/budgets' && method === 'POST') {
            const body = await getBody(req);
            const budgets = readJsonFile('budgets.json');
            const newBudget = { ...body, id: Date.now() };
            budgets.unshift(newBudget); // Mais recente primeiro
            writeJsonFile('budgets.json', budgets);
            sendJson(res, 201, newBudget);
        }
        else if (url.startsWith('/api/budgets/') && method === 'PUT') {
            const id = extractId(url, '/api/budgets');
            if (!id) return sendJson(res, 400, { error: 'ID inválido' });
            const body = await getBody(req);
            let budgets = readJsonFile('budgets.json');
            budgets = budgets.map(b => String(b.id) === id ? { ...b, ...body } : b);
            writeJsonFile('budgets.json', budgets);
            sendJson(res, 200, { success: true });
        }
        else if (url.startsWith('/api/budgets/') && method === 'DELETE') {
            const id = extractId(url, '/api/budgets');
            if (!id) return sendJson(res, 400, { error: 'ID inválido' });
            let budgets = readJsonFile('budgets.json');
            budgets = budgets.filter(b => String(b.id) !== id);
            writeJsonFile('budgets.json', budgets);
            sendJson(res, 200, { success: true });
        }

        // ==================== 404 ====================
        else {
            sendJson(res, 404, { error: 'Rota não encontrada' });
        }
    } catch (err) {
        console.error('Erro no servidor:', err);
        sendJson(res, 500, { error: 'Erro interno do servidor' });
    }
});

server.listen(PORT, () => {
    console.log(`\n  🚀 Servidor API rodando em http://localhost:${PORT}`);
    console.log(`  📁 Dados salvos em: ${DATA_DIR}`);
    console.log(`  📋 Endpoints disponíveis:`);
    console.log(`     GET/POST        /api/materials`);
    console.log(`     DELETE           /api/materials/:id`);
    console.log(`     GET/POST        /api/budgets`);
    console.log(`     PUT/DELETE      /api/budgets/:id\n`);
});
