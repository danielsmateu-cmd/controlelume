import crypto from 'crypto';
import { getSetting, saveSetting } from './partnerSupabase.js';

export const KEYS_SETTING = 'partner_api_keys';
export const LOGS_SETTING = 'partner_api_logs';
export const RATE_SETTING = 'partner_rate_limits';

const DEFAULT_RATE_LIMIT = 60;
const MAX_ACCESS_LOGS = 500;

export function hashApiKey(rawKey) {
    return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest('hex');
}

export function generateApiKey() {
    const token = crypto.randomBytes(24).toString('hex');
    const rawKey = `lume_live_${token}`;
    return {
        rawKey,
        keyHash: hashApiKey(rawKey),
        keyPrefix: rawKey.slice(0, 16) + '...'
    };
}

function safeCompareHex(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
        return false;
    }
}

export function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

export function isHttpsRequest(req) {
    const host = String(req.headers?.host || '').toLowerCase();
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
    const proto = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
    if (!proto) return true; // Local test mocks without proxy headers
    return proto === 'https';
}

export function extractClientIp(req) {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

export async function authenticatePartnerKey(authHeader, client) {
    const rawKey = extractBearerToken(authHeader);
    if (!rawKey) return { valid: false, reason: 'missing_token' };

    const incomingHash = hashApiKey(rawKey);
    const keys = await getSetting(KEYS_SETTING, [], client);
    const keyList = Array.isArray(keys) ? keys : [];

    const matched = keyList.find(k => k.active && safeCompareHex(k.keyHash, incomingHash));
    if (!matched) return { valid: false, reason: 'invalid_or_revoked' };

    return { valid: true, keyRecord: matched, allKeys: keyList };
}

export function checkSlidingWindowLimit(timestamps = [], nowMs = Date.now(), limitPerMin = DEFAULT_RATE_LIMIT) {
    const cutoff = nowMs - 60_000;
    const recent = (Array.isArray(timestamps) ? timestamps : []).filter(t => typeof t === 'number' && t > cutoff);
    if (recent.length >= limitPerMin) {
        const oldest = recent[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
        return { allowed: false, retryAfterSec, recent };
    }
    return { allowed: true, retryAfterSec: 0, recent: [...recent, nowMs] };
}

export async function enforceRateLimit(keyRecord, client) {
    const limit = keyRecord.rateLimitPerMin || DEFAULT_RATE_LIMIT;
    const nowMs = Date.now();
    const rateMap = (await getSetting(RATE_SETTING, {}, client)) || {};
    const existing = rateMap[keyRecord.id] || [];
    const { allowed, retryAfterSec, recent } = checkSlidingWindowLimit(existing, nowMs, limit);

    if (!allowed) {
        return { allowed: false, retryAfterSec, remaining: 0, limit };
    }

    const nextMap = { ...rateMap, [keyRecord.id]: recent };
    await saveSetting(RATE_SETTING, nextMap, client);
    return { allowed: true, retryAfterSec: 0, remaining: Math.max(0, limit - recent.length), limit };
}

export async function logPartnerAccess({ keyId = null, keyPrefix = null, method, endpoint, status, ip }, client) {
    try {
        const existing = await getSetting(LOGS_SETTING, [], client);
        const list = Array.isArray(existing) ? existing : [];
        const entry = {
            timestamp: new Date().toISOString(),
            key_id: keyId,
            key_prefix: keyPrefix,
            method,
            endpoint,
            status,
            ip,
        };
        const updated = [entry, ...list].slice(0, MAX_ACCESS_LOGS);
        await saveSetting(LOGS_SETTING, updated, client);
    } catch (err) {
        console.error('Error recording partner access log:', err.message);
    }
}

export async function touchKeyLastUsed(keyId, allKeys, client) {
    try {
        const updated = (Array.isArray(allKeys) ? allKeys : []).map(k =>
            k.id === keyId ? { ...k, lastUsedAt: new Date().toISOString() } : k
        );
        await saveSetting(KEYS_SETTING, updated, client);
    } catch (_) {}
}
