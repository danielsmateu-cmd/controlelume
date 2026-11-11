import crypto from 'crypto';
import { getSetting, saveSetting } from './partnerSupabase.js';

export const WEBHOOK_CONFIG_SETTING = 'partner_webhook_config';
export const WEBHOOK_OUTBOX_SETTING = 'partner_webhook_outbox';
export const WEBHOOK_LOGS_SETTING = 'partner_webhook_logs';

// Política de retentativas pedida: 1 min, 5 min, 30 min, 2 h
export const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200];
export const MAX_WEBHOOK_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;
const COALESCE_WINDOW_MS = 5000;
const MAX_WEBHOOK_LOGS = 300;

export function signWebhookPayload(rawBody, secret, timestampIso) {
    const hmac = crypto
        .createHmac('sha256', String(secret || ''))
        .update(`${timestampIso}.${rawBody}`, 'utf8')
        .digest('hex');
    return `sha256=${hmac}`;
}

export function verifyWebhookSignature(rawBody, secret, timestampIso, signatureHeader) {
    if (!signatureHeader || !timestampIso) return false;
    const expected = signWebhookPayload(rawBody, secret, timestampIso);
    if (expected.length !== signatureHeader.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signatureHeader, 'utf8'));
    } catch {
        return false;
    }
}

export function generateWebhookSecret() {
    return crypto.randomBytes(32).toString('hex');
}

export async function appendWebhookLog(entry, client) {
    try {
        const logs = await getSetting(WEBHOOK_LOGS_SETTING, [], client);
        const next = [entry, ...(Array.isArray(logs) ? logs : [])].slice(0, MAX_WEBHOOK_LOGS);
        await saveSetting(WEBHOOK_LOGS_SETTING, next, client);
    } catch (err) {
        console.error('Error appending webhook log:', err.message);
    }
}

/**
 * Enqueues a webhook event into partner_webhook_outbox coalescing rapid edits
 * to the same produto_id within 5 seconds.
 */
export async function enqueueWebhookEvent({ evento, produto_id, ft_code = null, alterado_em = null }, client) {
    const config = await getSetting(WEBHOOK_CONFIG_SETTING, null, client);
    if (!config?.enabled || !config?.url) {
        return { queued: false, reason: 'webhook_disabled' };
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const changeIso = alterado_em || nowIso;

    const outbox = await getSetting(WEBHOOK_OUTBOX_SETTING, [], client);
    const queue = Array.isArray(outbox) ? [...outbox] : [];

    const existingIdx = queue.findIndex(
        item => String(item.produto_id) === String(produto_id) && item.attempts === 0
    );

    let eventId;
    if (existingIdx !== -1) {
        const prev = queue[existingIdx];
        let nextEvento = evento;
        if (prev.evento === 'produto.criado' && evento === 'produto.alterado') {
            nextEvento = 'produto.criado';
        }
        eventId = prev.id_evento;
        queue[existingIdx] = {
            ...prev,
            evento: nextEvento,
            ft_code: ft_code || prev.ft_code,
            alterado_em: changeIso,
            updatedAtMs: nowMs,
            nextAttemptAt: new Date(nowMs + COALESCE_WINDOW_MS).toISOString(),
        };
    } else {
        eventId = crypto.randomUUID();
        queue.push({
            id_evento: eventId,
            evento,
            produto_id: String(produto_id),
            ft_code: ft_code ? String(ft_code) : null,
            alterado_em: changeIso,
            attempts: 0,
            maxAttempts: MAX_WEBHOOK_ATTEMPTS,
            createdAt: nowIso,
            updatedAtMs: nowMs,
            nextAttemptAt: new Date(nowMs + COALESCE_WINDOW_MS).toISOString(),
            lastStatus: null,
            lastError: null,
        });
    }

    await saveSetting(WEBHOOK_OUTBOX_SETTING, queue, client);
    return { queued: true, id_evento: eventId, updatedAtMs: nowMs };
}

export async function deliverSingleWebhook(eventItem, config, client, fetchImpl = fetch) {
    const timestampIso = new Date().toISOString();
    const payload = {
        id_evento: eventItem.id_evento,
        evento: eventItem.evento,
        produto_id: eventItem.produto_id,
        codigo_ft: eventItem.ft_code || null,
        alterado_em: eventItem.alterado_em,
    };
    const rawBody = JSON.stringify(payload);
    const assinatura = signWebhookPayload(rawBody, config.secret || '', timestampIso);

    const startMs = Date.now();
    let status = 0;
    let responseSnippet = '';
    let ok = false;
    let errorMsg = null;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const resp = await fetchImpl(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ControleLume-Webhook/1.0',
                'X-Lume-Assinatura': assinatura,
                'X-Lume-Timestamp': timestampIso,
                'X-Lume-Evento': eventItem.evento,
                'X-Lume-Id-Evento': eventItem.id_evento,
            },
            body: rawBody,
            signal: controller.signal,
        });
        clearTimeout(timer);
        status = resp.status;
        ok = resp.ok;
        const txt = await resp.text().catch(() => '');
        responseSnippet = txt.slice(0, 300);
        if (!ok) {
            errorMsg = `HTTP ${status}`;
        }
    } catch (err) {
        errorMsg = err?.name === 'AbortError' ? 'Timeout (8s)' : (err?.message || 'Erro de rede');
    }

    const durationMs = Date.now() - startMs;
    await appendWebhookLog({
        id_evento: eventItem.id_evento,
        evento: eventItem.evento,
        produto_id: eventItem.produto_id,
        url: config.url,
        status,
        ok,
        attempt: eventItem.attempts + 1,
        response_snippet: responseSnippet || errorMsg || '',
        timestamp: timestampIso,
        duration_ms: durationMs,
    }, client);

    return { ok, status, errorMsg, durationMs };
}

export async function processWebhookOutbox(client, { forceImmediateId = null, fetchImpl = fetch } = {}) {
    const config = await getSetting(WEBHOOK_CONFIG_SETTING, null, client);
    if (!config?.enabled || !config?.url) {
        return { processed: 0, delivered: 0, failed: 0 };
    }

    const outbox = await getSetting(WEBHOOK_OUTBOX_SETTING, [], client);
    const queue = Array.isArray(outbox) ? [...outbox] : [];
    if (queue.length === 0) {
        return { processed: 0, delivered: 0, failed: 0 };
    }

    const nowMs = Date.now();
    const remaining = [];
    let processed = 0;
    let delivered = 0;
    let failed = 0;

    for (const item of queue) {
        const dueMs = new Date(item.nextAttemptAt).getTime();
        const isDue = (item.id_evento === forceImmediateId) || (!Number.isNaN(dueMs) && dueMs <= nowMs);
        if (!isDue) {
            remaining.push(item);
            continue;
        }

        processed++;
        const result = await deliverSingleWebhook(item, config, client, fetchImpl);
        if (result.ok) {
            delivered++;
        } else {
            const nextAttemptNum = item.attempts + 1;
            if (nextAttemptNum >= (item.maxAttempts || MAX_WEBHOOK_ATTEMPTS)) {
                // Desiste após esgotar todas as tentativas (consulta incremental cobre o restante)
                failed++;
            } else {
                const delaySec = RETRY_DELAYS_SECONDS[item.attempts] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
                remaining.push({
                    ...item,
                    attempts: nextAttemptNum,
                    lastStatus: result.status,
                    lastError: result.errorMsg,
                    nextAttemptAt: new Date(Date.now() + delaySec * 1000).toISOString(),
                });
            }
        }
    }

    await saveSetting(WEBHOOK_OUTBOX_SETTING, remaining, client);
    return { processed, delivered, failed, remaining: remaining.length };
}
