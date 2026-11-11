import React, { useState, useEffect, useCallback } from 'react';
import {
    KeyRound,
    Plus,
    Copy,
    Check,
    ShieldCheck,
    Webhook,
    RefreshCw,
    Trash2,
    Power,
    Send,
    FileDown,
    AlertTriangle,
    Activity,
    Loader2,
    Eye,
    EyeOff
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

const ApiParceiros = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [keys, setKeys] = useState([]);
    const [newKeyName, setNewKeyName] = useState('eBureau - Produção');
    const [creatingKey, setCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
    const [copiedText, setCopiedText] = useState('');

    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [webhookEnabled, setWebhookEnabled] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const [outboxCount, setOutboxCount] = useState(0);
    const [accessLogs, setAccessLogs] = useState([]);
    const [webhookLogs, setWebhookLogs] = useState([]);
    const [sampleProduct, setSampleProduct] = useState(null);
    const [stats, setStats] = useState({ activeProductsCount: 0, fieldsCount: 0 });
    const [activeLogTab, setActiveLogTab] = useState('webhooks');

    const callAdminApi = useCallback(async (action, payload = {}) => {
        const resp = await fetch('/api/parceiros-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                adminLogin: currentUser?.login,
                adminPassword: currentUser?.password,
                ...payload,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || `Erro HTTP ${resp.status}`);
        }
        return data;
    }, [currentUser]);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await callAdminApi('dashboard');
            setKeys(data.keys || []);
            setWebhookUrl(data.webhook?.url || '');
            setWebhookSecret(data.webhook?.secret || '');
            setWebhookEnabled(Boolean(data.webhook?.enabled));
            setOutboxCount(data.outboxCount || 0);
            setAccessLogs(data.accessLogs || []);
            setWebhookLogs(data.webhookLogs || []);
            setSampleProduct(data.sampleProduct || null);
            setStats({
                activeProductsCount: data.activeProductsCount || 0,
                fieldsCount: data.fieldsCount || 0,
            });
        } catch (err) {
            setError(err.message || 'Não foi possível carregar o painel da API.');
        } finally {
            setLoading(false);
        }
    }, [callAdminApi]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const handleCopy = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(label);
            setTimeout(() => setCopiedText(''), 2500);
        } catch (_) {
            alert('Copie manualmente: ' + text);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;
        setCreatingKey(true);
        try {
            const data = await callAdminApi('create_key', { name: newKeyName.trim(), rateLimitPerMin: 60 });
            setNewlyCreatedKey(data.rawKey);
            setKeys(prev => [data.key, ...prev]);
            setNewKeyName('eBureau - Produção');
        } catch (err) {
            alert('Erro ao criar chave: ' + err.message);
        } finally {
            setCreatingKey(false);
        }
    };

    const handleToggleKey = async (k) => {
        const msg = k.active
            ? `Desativar a chave "${k.name}" (${k.keyPrefix})? A eBureau perderá o acesso imediatamente.`
            : `Reativar a chave "${k.name}" (${k.keyPrefix})?`;
        if (!window.confirm(msg)) return;
        try {
            const data = await callAdminApi('toggle_key', { keyId: k.id, active: !k.active });
            setKeys(data.keys || []);
        } catch (err) {
            alert('Erro ao atualizar chave: ' + err.message);
        }
    };

    const handleDeleteKey = async (k) => {
        if (!window.confirm(`Excluir permanentemente o registro da chave "${k.name}"?`)) return;
        try {
            const data = await callAdminApi('delete_key', { keyId: k.id });
            setKeys(data.keys || []);
        } catch (err) {
            alert('Erro ao excluir chave: ' + err.message);
        }
    };

    const handleSaveWebhook = async (e) => {
        e.preventDefault();
        setSavingWebhook(true);
        try {
            const data = await callAdminApi('save_webhook', {
                url: webhookUrl.trim(),
                secret: webhookSecret.trim(),
                enabled: webhookEnabled,
            });
            setWebhookUrl(data.webhook.url || '');
            setWebhookSecret(data.webhook.secret || '');
            setWebhookEnabled(Boolean(data.webhook.enabled));
            alert('✅ Configurações de Webhook salvas!');
        } catch (err) {
            alert('Erro ao salvar webhook: ' + err.message);
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleRotateSecret = async () => {
        if (!window.confirm('Gerar um novo segredo HMAC? Você precisará informar o novo segredo à eBureau para que a assinatura continue validando.')) return;
        try {
            const data = await callAdminApi('rotate_webhook_secret');
            setWebhookSecret(data.webhook.secret || '');
        } catch (err) {
            alert('Erro ao gerar segredo: ' + err.message);
        }
    };

    const handleTestWebhook = async () => {
        setTestingWebhook(true);
        setTestResult(null);
        try {
            const data = await callAdminApi('test_webhook');
            setTestResult(data.delivery);
            loadDashboard();
        } catch (err) {
            alert('Erro ao testar webhook: ' + err.message);
        } finally {
            setTestingWebhook(false);
        }
    };

    const handleFlushQueue = async () => {
        try {
            const res = await callAdminApi('flush_outbox_now');
            alert(`Fila processada: ${res.delivered || 0} entregue(s), ${res.remaining || 0} pendente(s).`);
            loadDashboard();
        } catch (err) {
            alert('Erro ao processar fila: ' + err.message);
        }
    };

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.vercel.app';

    const buildPartnerDocMarkdown = () => {
        const sampleJson = sampleProduct
            ? JSON.stringify({ produto: sampleProduct }, null, 2)
            : JSON.stringify({
                produto: {
                    id: 'uuid-fixo-do-produto',
                    codigo_ft: 'FT004',
                    sku_principal: 'ft04PRATA',
                    nome: 'Suporte Porta Luvas Acrílico 3mm',
                    titulo_comercial: 'Suporte Porta Luvas Acrílico 3mm Dispenser De Bancada',
                    marca: 'Lume Acrílicos',
                    situacao: 'ativo',
                    preco_venda: 220.00,
                    cep_origem: '13347-458',
                    criado_em: '2026-03-03T12:00:00.000Z',
                    atualizado_em: '2026-11-11T14:00:00.000Z',
                }
            }, null, 2);

        return `# API de Fichas de Produto — Lume Acrílicos (Parceiros v1)

## 1. Endereço Base (Produção)
\`${baseUrl}/api/parceiros/v1\`

*(Aceita apenas conexões **HTTPS** e operações somente leitura **GET**.)*

## 2. Autenticação
Todas as requisições exigem o cabeçalho:
\`\`\`http
Authorization: Bearer <CHAVE_API_ENVIADA_POR_CANAL_SEGURO>
\`\`\`
- Limite padrão: **60 requisições por minuto** por chave (retorna HTTP \`429\` com cabeçalho \`Retry-After\` se exceder).
- Chave inválida ou revogada retorna HTTP \`401\`.

## 3. Endpoints Disponíveis

| Método | Rota | Descrição |
|---|---|---|
| \`GET\` | \`/saude\` | Testa conectividade e saúde da API |
| \`GET\` | \`/campos\` | Dicionário completo dos campos (tipo, unidade, obrigatoriedade e significado) |
| \`GET\` | \`/produtos?alterados_desde=<ISO>&cursor=<x>&limite=<1..100>\` | Lista paginada por cursor em ordem crescente de \`atualizado_em\` (inclui \`situacao: "excluido"\`) |
| \`GET\` | \`/produtos/{id}\` | Retorna a ficha completa de um produto (aceita UUID \`id\` ou \`codigo_ft\`) |

### Exemplo real de resposta (\`GET /produtos/{id}\`)
\`\`\`json
${sampleJson}
\`\`\`

## 4. Webhook (Avisos Automáticos)
Quando uma ficha é criada, alterada ou excluída no Controle Lume, enviamos um \`POST\` em segundo plano para a URL cadastrada:

- **Eventos:** \`produto.criado\`, \`produto.alterado\`, \`produto.excluido\`
- **Agrupamento:** edições rápidas na mesma ficha dentro de ~5 segundos são agrupadas em um único disparo.
- **Cabeçalhos de segurança:**
  - \`X-Lume-Timestamp\`: data/hora ISO 8601 UTC do envio
  - \`X-Lume-Assinatura\`: \`sha256=<HMAC_HEX>\` calculado sobre \`<X-Lume-Timestamp>.<CORPO_JSON_BRUTO>\` usando o segredo compartilhado
  - \`X-Lume-Evento\` e \`X-Lume-Id-Evento\` (UUID único idempotente)

### Exemplo de corpo do Webhook
\`\`\`json
{
  "id_evento": "a1b2c3d4-...",
  "evento": "produto.alterado",
  "produto_id": "f1fc8466-cabc-4c1c-a445-2236b50b3b63",
  "codigo_ft": "FT004",
  "alterado_em": "2026-11-11T14:00:00.000Z"
}
\`\`\`

### Validação da Assinatura (Node.js)
\`\`\`js
const esperado = 'sha256=' + crypto
  .createHmac('sha256', SEGREDO_COMPARTILHADO)
  .update(\`\${req.headers['x-lume-timestamp']}.\${rawBody}\`)
  .digest('hex');
\`\`\`

### Política de Retentativas
Se o receptor não responder \`2xx\`, reenviamos com espera crescente: **1 min → 5 min → 30 min → 2 horas**. Caso todas falhem, a consulta incremental \`GET /produtos?alterados_desde=...\` garante que nenhuma alteração seja perdida.

## 5. Observações sobre o Catálogo
- Produtos marcados no Controle Lume como **"Não está à venda"** não são expostos pela API.
- Campos não aplicáveis ao nosso estoque físico ainda (ex.: Shopee/TikTok ainda em implantação de SKUs/integração) retornam com os dados comerciais replicados ou \`null\` até preenchimento.
- Dados internos (custos de materiais, taxas, margens, fornecedores, clientes, pedidos e usuários) **nunca** são trafegados.
`;
    };

    const handleDownloadDoc = () => {
        const content = buildPartnerDocMarkdown();
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'DOCUMENTACAO-API-LUME-EBUREAU.md';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <span>API Somente Leitura para Parceiros (eBureau)</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Endpoint base: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800">{baseUrl}/api/parceiros/v1</code>
                        {' '}• <strong>{stats.activeProductsCount}</strong> fichas liberadas para parceiros • <strong>{stats.fieldsCount}</strong> campos documentados
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => handleCopy(`${baseUrl}/api/parceiros/v1`, 'baseUrl')}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center gap-1.5 cursor-pointer"
                    >
                        {copiedText === 'baseUrl' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>Copiar URL da API</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadDoc}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                        <FileDown size={15} />
                        <span>Baixar Manual para eBureau (.md)</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2.5 text-sm text-red-700">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bloco Chaves de API */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-indigo-600" />
                            <span>Chaves de Acesso (Bearer Token)</span>
                        </h3>
                        <span className="text-[11px] text-gray-400">Salvas em hash SHA-256</span>
                    </div>

                    <form onSubmit={handleCreateKey} autoComplete="off" className="flex gap-2">
                        <input
                            type="text"
                            name="partner-key-label"
                            autoComplete="off"
                            data-lpignore="true"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="Nome da chave (ex: eBureau Produção)"
                            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={creatingKey}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {creatingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            <span>Gerar Chave</span>
                        </button>
                    </form>

                    {newlyCreatedKey && (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-bold text-emerald-900">
                                ⚠️ Chave criada! Copie agora — por segurança ela NÃO aparecerá completa novamente:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 break-all">
                                    {newlyCreatedKey}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(newlyCreatedKey, 'newKey')}
                                    className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer"
                                >
                                    {copiedText === 'newKey' ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copiedText === 'newKey' ? 'Copiada!' : 'Copiar'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                        {keys.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-6">Nenhuma chave criada ainda.</p>
                        ) : (
                            keys.map(k => (
                                <div key={k.id} className="p-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-800">{k.name}</span>
                                            <span className={clsx(
                                                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                                k.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            )}>
                                                {k.active ? 'Ativa' : 'Revogada'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                                            {k.keyPrefix} • Limite: {k.rateLimitPerMin}/min
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            Criada em {new Date(k.createdAt).toLocaleString('pt-BR')}
                                            {k.lastUsedAt ? ` • Último uso: ${new Date(k.lastUsedAt).toLocaleString('pt-BR')}` : ' • Nunca usada'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleKey(k)}
                                            title={k.active ? 'Desativar / Revogar chave' : 'Reativar chave'}
                                            className={clsx(
                                                'p-1.5 rounded-lg cursor-pointer',
                                                k.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                                            )}
                                        >
                                            <Power size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteKey(k)}
                                            title="Excluir registro da chave"
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Bloco Webhook */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Webhook className="w-4 h-4 text-purple-600" />
                            <span>Aviso Automático (Webhook HMAC-SHA256)</span>
                        </h3>
                        {outboxCount > 0 && (
                            <button
                                type="button"
                                onClick={handleFlushQueue}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                            >
                                ⏳ {outboxCount} na fila (enviar)
                            </button>
                        )}
                    </div>

                    <p className="text-[11px] text-gray-500 bg-purple-50/60 border border-purple-100 rounded-xl px-3 py-2">
                        Opcional: use apenas se a eBureau informar uma URL HTTPS para receber avisos em tempo real. O segredo abaixo não é a sua senha do sistema — é um código exclusivo para assinar as mensagens entre o Controle Lume e a eBureau.
                    </p>

                    <form onSubmit={handleSaveWebhook} autoComplete="off" className="space-y-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={webhookEnabled}
                                onChange={(e) => setWebhookEnabled(e.target.checked)}
                                className="rounded text-indigo-600"
                            />
                            <span>Ativar envio automático de webhooks ao criar/alterar/excluir FTs</span>
                        </label>

                        <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">URL do Webhook da eBureau (HTTPS)</label>
                            <input
                                type="text"
                                inputMode="url"
                                name="partner-webhook-endpoint"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                data-lpignore="true"
                                data-1p-ignore="true"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder="https://erp.ebureau.com.br/api/webhooks/lume"
                                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Segredo Compartilhado do Webhook (X-Lume-Assinatura)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="partner-webhook-hmac-secret"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    data-lpignore="true"
                                    data-1p-ignore="true"
                                    style={showSecret ? undefined : { WebkitTextSecurity: 'disc' }}
                                    value={webhookSecret}
                                    onChange={(e) => setWebhookSecret(e.target.value)}
                                    placeholder="Gerado automaticamente se deixar em branco"
                                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
                                    title={showSecret ? 'Ocultar' : 'Mostrar'}
                                >
                                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                                {webhookSecret && (
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(webhookSecret, 'whSecret')}
                                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                    >
                                        {copiedText === 'whSecret' ? 'Copiado!' : 'Copiar'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleRotateSecret}
                                    className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1 cursor-pointer"
                                    title="Gerar novo segredo aleatório"
                                >
                                    <RefreshCw size={13} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={savingWebhook}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-50"
                            >
                                {savingWebhook ? 'Salvando...' : 'Salvar Webhook'}
                            </button>
                            <button
                                type="button"
                                onClick={handleTestWebhook}
                                disabled={testingWebhook || !webhookUrl}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                <Send size={13} />
                                <span>{testingWebhook ? 'Enviando...' : 'Testar Envio Agora'}</span>
                            </button>
                        </div>

                        {testResult && (
                            <div className={clsx(
                                'p-3 rounded-xl text-xs border',
                                testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                            )}>
                                {testResult.ok
                                    ? `✅ Teste entregue com sucesso! HTTP ${testResult.status} (${testResult.durationMs}ms)`
                                    : `❌ Falha no teste: ${testResult.errorMsg || `HTTP ${testResult.status}`} (${testResult.durationMs}ms)`}
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* Logs de Auditoria */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-900">Logs de Auditoria & Envios</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveLogTab('webhooks')}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
                                activeLogTab === 'webhooks' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                            )}
                        >
                            Webhooks ({webhookLogs.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveLogTab('access')}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
                                activeLogTab === 'access' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                            )}
                        >
                            Acessos à API ({accessLogs.length})
                        </button>
                        <button
                            type="button"
                            onClick={loadDashboard}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
                            title="Atualizar logs"
                        >
                            <RefreshCw size={15} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    {activeLogTab === 'webhooks' ? (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase">
                                <tr>
                                    <th className="px-3 py-2 text-left">Data/Hora</th>
                                    <th className="px-3 py-2 text-left">Evento</th>
                                    <th className="px-3 py-2 text-left">Produto ID</th>
                                    <th className="px-3 py-2 text-center">Tent.</th>
                                    <th className="px-3 py-2 text-center">HTTP</th>
                                    <th className="px-3 py-2 text-left">Resposta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {webhookLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-6 text-gray-400">Nenhum webhook disparado ainda.</td></tr>
                                ) : webhookLogs.slice(0, 40).map((log, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 py-2 font-mono font-semibold text-purple-700">{log.evento}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{log.produto_id}</td>
                                        <td className="px-3 py-2 text-center">{log.attempt}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={clsx('px-2 py-0.5 rounded-full font-bold text-[10px]', log.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                                                {log.status || 'ERR'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{log.response_snippet}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase">
                                <tr>
                                    <th className="px-3 py-2 text-left">Data/Hora</th>
                                    <th className="px-3 py-2 text-left">Chave</th>
                                    <th className="px-3 py-2 text-left">Endpoint</th>
                                    <th className="px-3 py-2 text-center">Status</th>
                                    <th className="px-3 py-2 text-left">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {accessLogs.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-6 text-gray-400">Nenhum acesso registrado ainda.</td></tr>
                                ) : accessLogs.slice(0, 40).map((log, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{log.key_prefix || '—'}</td>
                                        <td className="px-3 py-2 font-mono text-gray-800">{log.method} {log.endpoint}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-full font-bold text-[10px]',
                                                log.status === 200 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            )}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-gray-500">{log.ip}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApiParceiros;
