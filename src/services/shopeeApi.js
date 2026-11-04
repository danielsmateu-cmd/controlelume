// src/services/shopeeApi.js
// Servico de integracao com a API oficial da Shopee (Open Platform v2)

import { supabase } from '../lib/supabase';
import { api } from './api';

const SHOPEE_BASE_URL = 'https://partner.shopeemobile.com';

// Helper nativo para calcular assinatura HMAC-SHA256
async function hmacSha256(keyStr, messageStr) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyStr);
    const msgData = encoder.encode(messageStr);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ===== CONFIGURAÇÕES DAS CREDENCIAIS =====
export const shopeeConfig = {
    async getCredentials() {
        try {
            // 1. Tenta carregar do Supabase (permite configurar direto pela interface sem mexer em código/Vercel)
            const settingsCreds = await api.getSettings('shopee_credentials');
            if (settingsCreds && settingsCreds.partner_id && settingsCreds.partner_key) {
                return {
                    partner_id: String(settingsCreds.partner_id).trim(),
                    partner_key: String(settingsCreds.partner_key).trim(),
                    redirect_uri: settingsCreds.redirect_uri || window.location.origin + '/ecommerce'
                };
            }
        } catch (e) {
            console.warn('Não foi possível ler shopee_credentials do settings:', e);
        }

        // 2. Fallback para variáveis de ambiente
        const envPartnerId = import.meta.env.VITE_SHOPEE_PARTNER_ID;
        const envPartnerKey = import.meta.env.VITE_SHOPEE_PARTNER_KEY;
        const envRedirect = import.meta.env.VITE_SHOPEE_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/ecommerce' : '');

        return {
            partner_id: envPartnerId ? String(envPartnerId).trim() : '',
            partner_key: envPartnerKey ? String(envPartnerKey).trim() : '',
            redirect_uri: envRedirect
        };
    },

    async saveCredentials(creds) {
        return await api.saveSettings('shopee_credentials', {
            partner_id: String(creds.partner_id || '').trim(),
            partner_key: String(creds.partner_key || '').trim(),
            redirect_uri: creds.redirect_uri || (window.location.origin + '/ecommerce'),
            updated_at: new Date().toISOString()
        });
    }
};

// ===== AUTENTICAÇÃO E TOKENS =====
export const shopeeAuth = {
    // Gera URL de autorização da loja Shopee
    async getAuthUrl(customRedirectUri) {
        const creds = await shopeeConfig.getCredentials();
        if (!creds.partner_id || !creds.partner_key) {
            throw new Error('Partner ID e Partner Key da Shopee não configurados.');
        }

        const path = '/api/v2/shop/auth_partner';
        const timestamp = Math.floor(Date.now() / 1000);
        const baseString = `${creds.partner_id}${path}${timestamp}`;
        const sign = await hmacSha256(creds.partner_key, baseString);
        const redirect = customRedirectUri || creds.redirect_uri || window.location.origin + '/ecommerce';

        return `${SHOPEE_BASE_URL}${path}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;
    },

    // Troca o código recebido no redirecionamento pelo access_token e refresh_token
    async exchangeCode(code, shopId) {
        try {
            const creds = await shopeeConfig.getCredentials();
            if (!creds.partner_id || !creds.partner_key) {
                return { success: false, error: 'Credenciais da Shopee não configuradas' };
            }

            const path = '/api/v2/auth/token/get';
            const timestamp = Math.floor(Date.now() / 1000);
            const baseString = `${creds.partner_id}${path}${timestamp}`;
            const sign = await hmacSha256(creds.partner_key, baseString);

            const targetUrl = `${SHOPEE_BASE_URL}${path}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}`;
            const proxyUrl = `/api/shopeeproxy?target=${encodeURIComponent(targetUrl)}`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: String(code).trim(),
                    partner_id: Number(creds.partner_id),
                    shop_id: Number(shopId)
                })
            });

            const data = await response.json();

            if (data.access_token) {
                await shopeeAuth.saveTokens(data, shopId);
                return { success: true, data };
            }

            return { success: false, error: data.message || data.error || data };
        } catch (err) {
            console.error('Shopee exchangeCode error:', err);
            return { success: false, error: err.message };
        }
    },

    async saveTokens(tokenData, shopId) {
        // Shopee access_token dura 4 horas (14400 segundos)
        const expiresInSec = tokenData.expire_in || 14400;
        const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

        const payload = {
            platform: 'shopee',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            ml_user_id: String(shopId || tokenData.shop_id || ''),
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
        };

        const { data: existing } = await supabase
            .from('marketplace_tokens')
            .select('id')
            .eq('platform', 'shopee')
            .single();

        if (existing) {
            await supabase.from('marketplace_tokens').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('marketplace_tokens').insert([payload]);
        }
    },

    async getTokens() {
        const { data } = await supabase
            .from('marketplace_tokens')
            .select('*')
            .eq('platform', 'shopee')
            .single();
        return data;
    },

    async refreshToken() {
        try {
            const tokens = await shopeeAuth.getTokens();
            if (!tokens?.refresh_token) return null;

            const creds = await shopeeConfig.getCredentials();
            if (!creds.partner_id || !creds.partner_key) return null;

            const path = '/api/v2/auth/access_token/get';
            const timestamp = Math.floor(Date.now() / 1000);
            const baseString = `${creds.partner_id}${path}${timestamp}`;
            const sign = await hmacSha256(creds.partner_key, baseString);

            const targetUrl = `${SHOPEE_BASE_URL}${path}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}`;
            const proxyUrl = `/api/shopeeproxy?target=${encodeURIComponent(targetUrl)}`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: tokens.refresh_token,
                    partner_id: Number(creds.partner_id),
                    shop_id: Number(tokens.ml_user_id)
                })
            });

            const data = await response.json();
            if (data.access_token) {
                await shopeeAuth.saveTokens(data, tokens.ml_user_id);
                return data.access_token;
            }
            return null;
        } catch (err) {
            console.error('Shopee refreshToken error:', err);
            return null;
        }
    },

    async getValidToken() {
        const tokens = await shopeeAuth.getTokens();
        if (!tokens?.access_token) return null;

        const expiresAt = new Date(tokens.expires_at).getTime();
        const now = Date.now();

        // Renova se faltar menos de 30 minutos para expirar
        if (expiresAt - now < 30 * 60 * 1000) {
            return await shopeeAuth.refreshToken();
        }

        return tokens.access_token;
    },

    async isConnected() {
        const tokens = await shopeeAuth.getTokens();
        return Boolean(tokens?.access_token);
    },

    async disconnect() {
        await supabase.from('marketplace_tokens').delete().eq('platform', 'shopee');
    }
};

// ===== REQUISIÇÕES ASSINADAS NA API SHOPEE =====
async function shopeeFetch(path, queryParams = {}, options = {}) {
    const creds = await shopeeConfig.getCredentials();
    const tokens = await shopeeAuth.getTokens();
    const accessToken = await shopeeAuth.getValidToken();

    if (!creds.partner_id || !creds.partner_key) {
        throw new Error('Partner ID e Partner Key da Shopee não configurados.');
    }
    if (!tokens || !accessToken) {
        throw new Error('Shopee não está conectada ou o token expirou.');
    }

    const shopId = tokens.ml_user_id;
    const timestamp = Math.floor(Date.now() / 1000);

    // Na Shopee v2 para endpoints de loja:
    // baseString = partner_id + path + timestamp + access_token + shop_id
    const baseString = `${creds.partner_id}${path}${timestamp}${accessToken}${shopId}`;
    const sign = await hmacSha256(creds.partner_key, baseString);

    const urlParams = new URLSearchParams({
        partner_id: creds.partner_id,
        timestamp: String(timestamp),
        sign,
        access_token: accessToken,
        shop_id: String(shopId),
        ...queryParams
    });

    const targetUrl = `${SHOPEE_BASE_URL}${path}?${urlParams.toString()}`;
    const proxyUrl = `/api/shopeeproxy?target=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Erro API Shopee: ${response.status}`);
    }

    const data = await response.json();
    if (data.error && data.error.length > 0) {
        throw new Error(data.message || data.error);
    }

    return data.response || data;
}

// ===== MÉTODOS DE VENDAS E PEDIDOS =====
export const shopeeApi = {
    // Busca informações da Loja
    async getShopInfo() {
        return await shopeeFetch('/api/v2/shop/get_shop_info');
    },

    // Busca pedidos do mês e calcula a agregação de itens e faturamento
    async getMonthlyOrders(yearStr, monthStr) {
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        // Timestamps UNIX em segundos (Shopee usa segundos)
        const timeFrom = Math.floor(new Date(year, month - 1, 1, 0, 0, 0).getTime() / 1000);
        const timeTo = Math.floor(new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000);

        let allOrderSns = [];
        let cursor = '';
        let hasMore = true;

        // 1. Listar pedidos do período
        while (hasMore) {
            const params = {
                time_range_field: 'create_time',
                time_from: String(timeFrom),
                time_to: String(timeTo),
                page_size: '50',
                response_optional_fields: 'order_status'
            };
            if (cursor) params.cursor = cursor;

            const res = await shopeeFetch('/api/v2/order/get_order_list', params);
            const list = res.order_list || [];

            for (const ord of list) {
                // Ignora cancelados
                if (ord.order_status !== 'CANCELLED') {
                    allOrderSns.push(ord.order_sn);
                }
            }

            hasMore = Boolean(res.more);
            cursor = res.next_cursor || '';
            if (allOrderSns.length > 2000) break; // Segurança
        }

        if (allOrderSns.length === 0) {
            return {};
        }

        // 2. Buscar detalhes dos pedidos em lotes de 50
        const currentTally = {};
        const chunkSize = 50;

        for (let i = 0; i < allOrderSns.length; i += chunkSize) {
            const chunk = allOrderSns.slice(i, i + chunkSize);
            const detailRes = await shopeeFetch('/api/v2/order/get_order_detail', {
                order_sn_list: chunk.join(','),
                response_optional_fields: 'item_list,total_amount,pay_time'
            });

            const orderDetails = detailRes.order_list || [];

            for (const order of orderDetails) {
                for (const item of order.item_list || []) {
                    const sku = item.model_sku || item.item_sku || '';
                    const productName = item.item_name || 'Produto Shopee';
                    const varName = item.model_name || '';
                    const qty = item.model_quantity_purchased || 1;
                    const price = item.model_discounted_price || item.model_original_price || 0;

                    const tallyKey = sku 
                        ? `sku_${sku.toLowerCase().trim()}` 
                        : `item_${item.item_id}_${item.model_id || '0'}`;

                    if (!currentTally[tallyKey]) {
                        currentTally[tallyKey] = {
                            total: 0,
                            revenue: 0,
                            title: productName + (varName ? ` (${varName})` : ''),
                            productName,
                            varName,
                            shopeeSku: sku,
                            tallyKey,
                            itemId: item.item_id,
                            modelId: item.model_id
                        };
                    }

                    currentTally[tallyKey].total += qty;
                    currentTally[tallyKey].revenue += (qty * price);
                }
            }
        }

        return currentTally;
    }
};
