import { getSupabaseClient } from './_lib/partnerSupabase.js';
import {
    FIELD_DICTIONARY,
    buildAllPartnerProducts,
    getSinglePartnerProduct,
    paginateCatalogItems,
} from './_lib/partnerCatalog.js';
import {
    authenticatePartnerKey,
    enforceRateLimit,
    extractClientIp,
    isHttpsRequest,
    logPartnerAccess,
    touchKeyLastUsed,
} from './_lib/partnerSecurity.js';

function resolveRoute(req) {
    if (req.query?.route) {
        return {
            route: String(req.query.route),
            id: req.query.id ? String(req.query.id) : null,
        };
    }
    const rawUrl = String(req.url || '').split('?')[0];
    const clean = rawUrl.replace(/^\/api\/parceiros\/v1\/?/, '').replace(/^\/+|\/+$/g, '');
    if (!clean || clean === 'saude') return { route: 'saude', id: null };
    if (clean === 'campos') return { route: 'campos', id: null };
    if (clean === 'produtos') return { route: 'produtos', id: null };
    if (clean.startsWith('produtos/')) {
        return { route: 'produto', id: decodeURIComponent(clean.slice('produtos/'.length)) };
    }
    return { route: 'unknown', id: null };
}

export async function handlePartnerApiRequest(req, res, deps = {}) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const ip = extractClientIp(req);
    const { route, id } = resolveRoute(req);
    const endpointLabel = id ? `/api/parceiros/v1/produtos/${id}` : `/api/parceiros/v1/${route}`;

    let client;
    try {
        client = deps.client || getSupabaseClient();
    } catch (err) {
        return res.status(500).json({ erro: 'Erro de configuração do servidor.' });
    }

    const logAccess = deps.logPartnerAccess || logPartnerAccess;

    // 1. Exigir HTTPS em produção
    if (!isHttpsRequest(req)) {
        await logAccess({ method: req.method, endpoint: endpointLabel, status: 403, ip }, client);
        return res.status(403).json({ erro: 'Acesso permitido apenas via HTTPS.' });
    }

    // 2. API estritamente somente leitura (GET)
    if (req.method !== 'GET') {
        await logAccess({ method: req.method, endpoint: endpointLabel, status: 405, ip }, client);
        return res.status(405).json({ erro: 'Método não permitido. Esta API é somente leitura (GET).' });
    }

    // 3. Autenticação por Bearer Key (armazenada apenas como hash)
    const authFn = deps.authenticatePartnerKey || authenticatePartnerKey;
    const auth = await authFn(req.headers?.authorization, client);
    if (!auth.valid) {
        await logAccess({ method: req.method, endpoint: endpointLabel, status: 401, ip }, client);
        return res.status(401).json({ erro: 'Não autorizado. Informe uma chave de API válida em Authorization: Bearer <chave>.' });
    }

    const { keyRecord, allKeys } = auth;

    // 4. Limite de requisições por minuto por chave (60/min padrão)
    const rateFn = deps.enforceRateLimit || enforceRateLimit;
    const rate = await rateFn(keyRecord, client);
    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

    if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        await logAccess({
            keyId: keyRecord.id,
            keyPrefix: keyRecord.keyPrefix,
            method: req.method,
            endpoint: endpointLabel,
            status: 429,
            ip,
        }, client);
        return res.status(429).json({
            erro: 'Limite de requisições por minuto excedido.',
            tentar_novamente_em_segundos: rate.retryAfterSec,
        });
    }

    // Atualiza lastUsedAt e grava log sem armazenar payload de resposta
    const touchFn = deps.touchKeyLastUsed || touchKeyLastUsed;
    touchFn(keyRecord.id, allKeys, client).catch(() => {});

    try {
        if (route === 'saude') {
            await logAccess({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                method: req.method,
                endpoint: endpointLabel,
                status: 200,
                ip,
            }, client);
            return res.status(200).json({
                status: 'ok',
                servico: 'Controle Lume - API Parceiros',
                versao: 'v1',
                agora_utc: new Date().toISOString(),
            });
        }

        if (route === 'campos') {
            await logAccess({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                method: req.method,
                endpoint: endpointLabel,
                status: 200,
                ip,
            }, client);
            return res.status(200).json({
                versao: 'v1',
                total_campos: FIELD_DICTIONARY.length,
                campos: FIELD_DICTIONARY,
            });
        }

        if (route === 'produtos') {
            const listAllFn = deps.buildAllPartnerProducts || buildAllPartnerProducts;
            const allItems = await listAllFn(client);
            const result = paginateCatalogItems(allItems, {
                alteradosDesde: req.query?.alterados_desde || null,
                cursor: req.query?.cursor || null,
                limite: req.query?.limite || 50,
            });

            await logAccess({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                method: req.method,
                endpoint: endpointLabel,
                status: 200,
                ip,
            }, client);

            return res.status(200).json(result);
        }

        if (route === 'produto' && id) {
            const getOneFn = deps.getSinglePartnerProduct || getSinglePartnerProduct;
            const item = await getOneFn(id, client);
            if (!item) {
                await logAccess({
                    keyId: keyRecord.id,
                    keyPrefix: keyRecord.keyPrefix,
                    method: req.method,
                    endpoint: endpointLabel,
                    status: 404,
                    ip,
                }, client);
                return res.status(404).json({ erro: 'Produto não encontrado ou indisponível para parceiros.' });
            }

            await logAccess({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                method: req.method,
                endpoint: endpointLabel,
                status: 200,
                ip,
            }, client);
            return res.status(200).json({ produto: item });
        }

        await logAccess({
            keyId: keyRecord.id,
            keyPrefix: keyRecord.keyPrefix,
            method: req.method,
            endpoint: endpointLabel,
            status: 404,
            ip,
        }, client);
        return res.status(404).json({ erro: 'Endpoint não encontrado.' });
    } catch (err) {
        const status = err?.statusCode || 500;
        await logAccess({
            keyId: keyRecord.id,
            keyPrefix: keyRecord.keyPrefix,
            method: req.method,
            endpoint: endpointLabel,
            status,
            ip,
        }, client);
        return res.status(status).json({ erro: status === 400 ? err.message : 'Erro interno ao consultar catálogo.' });
    }
}

export default async function handler(req, res) {
    return handlePartnerApiRequest(req, res);
}
