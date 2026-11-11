import crypto from 'crypto';
import {
    getSetting,
    getSupabaseClient,
    saveSetting,
    verifyAdminCredentials,
    verifySessionUser,
} from './_lib/partnerSupabase.js';
import { KEYS_SETTING, LOGS_SETTING, generateApiKey } from './_lib/partnerSecurity.js';
import { buildAllPartnerProducts, FIELD_DICTIONARY } from './_lib/partnerCatalog.js';
import {
    WEBHOOK_CONFIG_SETTING,
    WEBHOOK_LOGS_SETTING,
    WEBHOOK_OUTBOX_SETTING,
    deliverSingleWebhook,
    enqueueWebhookEvent,
    generateWebhookSecret,
    processWebhookOutbox,
} from './_lib/partnerWebhook.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function sanitizeKeyForUi(k) {
    return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        active: Boolean(k.active),
        rateLimitPerMin: k.rateLimitPerMin || 60,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
        revokedAt: k.revokedAt || null,
    };
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST.' });
    }

    let client;
    try {
        client = getSupabaseClient();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = req.query?.action || body.action;

    // 1. Ações de fila/envio de webhook em segundo plano (usuário logado do sistema)
    if (action === 'enqueue_webhook' || action === 'flush_webhooks') {
        const user = await verifySessionUser(body.userId, body.userLogin, client);
        if (!user) {
            return res.status(401).json({ error: 'Sessão inválida.' });
        }

        if (action === 'flush_webhooks') {
            const result = await processWebhookOutbox(client);
            return res.status(200).json({ ok: true, ...result });
        }

        const { evento, produto_id, ft_code, alterado_em } = body;
        if (!evento || !produto_id) {
            return res.status(400).json({ error: 'evento e produto_id são obrigatórios.' });
        }

        const enq = await enqueueWebhookEvent({ evento, produto_id, ft_code, alterado_em }, client);
        if (!enq.queued) {
            return res.status(200).json({ ok: true, skipped: enq.reason });
        }

        // Aguarda 5s para juntar várias edições seguidas da mesma ficha em um único webhook
        await sleep(5000);
        const latestOutbox = await getSetting(WEBHOOK_OUTBOX_SETTING, [], client);
        const currentEntry = (Array.isArray(latestOutbox) ? latestOutbox : []).find(
            x => x.id_evento === enq.id_evento
        );

        // Se outro salvamento mais recente atualizou o evento dentro dos 5s, deixa a última requisição disparar
        if (!currentEntry || currentEntry.updatedAtMs !== enq.updatedAtMs) {
            return res.status(200).json({ ok: true, coalesced: true, id_evento: enq.id_evento });
        }

        const proc = await processWebhookOutbox(client, { forceImmediateId: enq.id_evento });
        return res.status(200).json({ ok: true, id_evento: enq.id_evento, ...proc });
    }

    // 2. Ações administrativas (exigem credencial de Admin validada no banco)
    const admin = await verifyAdminCredentials(body.adminLogin, body.adminPassword, client);
    if (!admin) {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }

    try {
        if (action === 'dashboard') {
            const [keys, webhookConfig, outbox, accessLogs, webhookLogs, allProducts] = await Promise.all([
                getSetting(KEYS_SETTING, [], client),
                getSetting(WEBHOOK_CONFIG_SETTING, { enabled: false, url: '', secret: '' }, client),
                getSetting(WEBHOOK_OUTBOX_SETTING, [], client),
                getSetting(LOGS_SETTING, [], client),
                getSetting(WEBHOOK_LOGS_SETTING, [], client),
                buildAllPartnerProducts(client).catch(() => []),
            ]);

            const sampleProduct = allProducts.find(p => p.situacao === 'ativo') || null;

            return res.status(200).json({
                keys: (Array.isArray(keys) ? keys : []).map(sanitizeKeyForUi),
                webhook: {
                    enabled: Boolean(webhookConfig?.enabled),
                    url: webhookConfig?.url || '',
                    hasSecret: Boolean(webhookConfig?.secret),
                    secret: webhookConfig?.secret || '',
                },
                outboxCount: Array.isArray(outbox) ? outbox.length : 0,
                outboxPending: Array.isArray(outbox) ? outbox.slice(0, 20) : [],
                accessLogs: Array.isArray(accessLogs) ? accessLogs.slice(0, 100) : [],
                webhookLogs: Array.isArray(webhookLogs) ? webhookLogs.slice(0, 100) : [],
                sampleProduct,
                fieldsCount: FIELD_DICTIONARY.length,
                activeProductsCount: allProducts.filter(p => p.situacao === 'ativo').length,
            });
        }

        if (action === 'create_key') {
            const name = String(body.name || 'eBureau - Produção').trim();
            const rateLimitPerMin = Math.min(Math.max(parseInt(body.rateLimitPerMin, 10) || 60, 10), 300);
            const { rawKey, keyHash, keyPrefix } = generateApiKey();
            const existing = await getSetting(KEYS_SETTING, [], client);
            const list = Array.isArray(existing) ? existing : [];

            const record = {
                id: crypto.randomUUID(),
                name,
                keyHash,
                keyPrefix,
                active: true,
                rateLimitPerMin,
                createdAt: new Date().toISOString(),
                lastUsedAt: null,
                revokedAt: null,
            };

            await saveSetting(KEYS_SETTING, [record, ...list], client);
            // A chave completa é devolvida UMA ÚNICA VEZ agora e nunca é salva em texto puro
            return res.status(201).json({
                rawKey,
                key: sanitizeKeyForUi(record),
            });
        }

        if (action === 'toggle_key') {
            const { keyId, active } = body;
            const existing = await getSetting(KEYS_SETTING, [], client);
            const list = Array.isArray(existing) ? existing : [];
            const nowIso = new Date().toISOString();
            const next = list.map(k =>
                k.id === keyId
                    ? { ...k, active: Boolean(active), revokedAt: active ? null : nowIso }
                    : k
            );
            await saveSetting(KEYS_SETTING, next, client);
            return res.status(200).json({ ok: true, keys: next.map(sanitizeKeyForUi) });
        }

        if (action === 'delete_key') {
            const { keyId } = body;
            const existing = await getSetting(KEYS_SETTING, [], client);
            const next = (Array.isArray(existing) ? existing : []).filter(k => k.id !== keyId);
            await saveSetting(KEYS_SETTING, next, client);
            return res.status(200).json({ ok: true, keys: next.map(sanitizeKeyForUi) });
        }

        if (action === 'save_webhook') {
            const url = String(body.url || '').trim();
            const enabled = Boolean(body.enabled);
            if (url && !url.startsWith('https://') && !url.startsWith('http://localhost')) {
                return res.status(400).json({ error: 'A URL do webhook deve começar com https://' });
            }
            const current = (await getSetting(WEBHOOK_CONFIG_SETTING, {}, client)) || {};
            const secret = body.secret !== undefined && String(body.secret).trim() !== ''
                ? String(body.secret).trim()
                : (current.secret || generateWebhookSecret());

            const nextConfig = {
                url,
                enabled,
                secret,
                updatedAt: new Date().toISOString(),
            };
            await saveSetting(WEBHOOK_CONFIG_SETTING, nextConfig, client);
            return res.status(200).json({ ok: true, webhook: nextConfig });
        }

        if (action === 'rotate_webhook_secret') {
            const current = (await getSetting(WEBHOOK_CONFIG_SETTING, {}, client)) || {};
            const nextConfig = {
                ...current,
                secret: generateWebhookSecret(),
                updatedAt: new Date().toISOString(),
            };
            await saveSetting(WEBHOOK_CONFIG_SETTING, nextConfig, client);
            return res.status(200).json({ ok: true, webhook: nextConfig });
        }

        if (action === 'test_webhook') {
            const config = await getSetting(WEBHOOK_CONFIG_SETTING, null, client);
            if (!config?.url) {
                return res.status(400).json({ error: 'Configure e salve a URL do webhook primeiro.' });
            }
            const fakeEvent = {
                id_evento: crypto.randomUUID(),
                evento: 'produto.alterado',
                produto_id: '00000000-0000-0000-0000-000000000000',
                ft_code: 'TESTE',
                alterado_em: new Date().toISOString(),
                attempts: 0,
            };
            const delivery = await deliverSingleWebhook(fakeEvent, config, client);
            return res.status(200).json({ ok: true, delivery });
        }

        if (action === 'flush_outbox_now') {
            const result = await processWebhookOutbox(client);
            return res.status(200).json({ ok: true, ...result });
        }

        return res.status(400).json({ error: 'Ação desconhecida.' });
    } catch (err) {
        console.error('Erro em parceiros-admin:', err);
        return res.status(500).json({ error: err.message || 'Erro interno.' });
    }
}
