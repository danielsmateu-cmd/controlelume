// src/services/mlApi.js
// Servico de integracao com a API do Mercado Livre

import { supabase } from '../lib/supabase';

const ML_CLIENT_ID = import.meta.env.VITE_ML_CLIENT_ID;
const ML_CLIENT_SECRET = import.meta.env.VITE_ML_CLIENT_SECRET;
const ML_REDIRECT_URI = import.meta.env.VITE_ML_REDIRECT_URI;
const ML_BASE_URL = 'https://api.mercadolibre.com';

// ===== AUTH =====

export const mlAuth = {
    getAuthUrl() {
        return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}`;
    },

    async exchangeCode(code) {
        try {
            const response = await fetch(`${ML_BASE_URL}/oauth/token`, {
                method: 'POST',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded' 
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: ML_CLIENT_ID,
                    client_secret: ML_CLIENT_SECRET,
                    code,
                    redirect_uri: ML_REDIRECT_URI,
                }).toString(),
            });
            const data = await response.json();
            if (data.access_token) {
                await mlAuth.saveTokens(data);
                return { success: true, data };
            }
            return { success: false, error: data };
        } catch (err) {
            console.error('ML exchangeCode:', err);
            return { success: false, error: err };
        }
    },

    async saveTokens(tokenData) {
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
        const payload = {
            platform: 'ml',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            ml_user_id: String(tokenData.user_id),
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabase.from('marketplace_tokens').select('id').eq('platform', 'ml').single();
        if (existing) {
            const { error } = await supabase.from('marketplace_tokens').update(payload).eq('id', existing.id);
            if (error) console.error('Update tokens error:', error);
        } else {
            const { error } = await supabase.from('marketplace_tokens').insert([payload]);
            if (error) console.error('Insert tokens error:', error);
        }
    },

    async getTokens() {
        const { data } = await supabase
            .from('marketplace_tokens')
            .select('*')
            .eq('platform', 'ml')
            .single();
        return data;
    },

    async refreshToken() {
        try {
            const tokens = await mlAuth.getTokens();
            if (!tokens?.refresh_token) return null;
            const response = await fetch(`${ML_BASE_URL}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: ML_CLIENT_ID,
                    client_secret: ML_CLIENT_SECRET,
                    refresh_token: tokens.refresh_token,
                }),
            });
            const data = await response.json();
            if (data.access_token) {
                await mlAuth.saveTokens(data);
                return data.access_token;
            }
            return null;
        } catch (err) {
            console.error('ML refreshToken:', err);
            return null;
        }
    },

    async getValidToken() {
        const tokens = await mlAuth.getTokens();
        if (!tokens) return null;
        const expiresAt = new Date(tokens.expires_at).getTime();
        const now = Date.now();
        if (expiresAt - now < 30 * 60 * 1000) {
            return await mlAuth.refreshToken();
        }
        return tokens.access_token;
    },

    async isConnected() {
        const tokens = await mlAuth.getTokens();
        return !!tokens?.access_token;
    },

    async disconnect() {
        await supabase.from('marketplace_tokens').delete().eq('platform', 'ml');
    }
};

// ===== API CALLS =====

async function mlFetch(path, options = {}) {
    const token = await mlAuth.getValidToken();
    if (!token) throw new Error('ML nao conectado');

    // Usamos nosso Vercel Serverless Function como Proxy para contornar o CORS do ML
    const targetUrl = `${ML_BASE_URL}${path}`;
    const proxyUrl = `/api/mlproxy?target=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `ML API error: ${response.status}`);
    }
    return response.json();
}

export const mlApi = {
    async getMe() {
        return mlFetch('/users/me');
    },

    async getMyItems(offset = 0, limit = 50) {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return { results: [], paging: { total: 0 } };
        return mlFetch(`/users/${tokens.ml_user_id}/items/search?status=active&offset=${offset}&limit=${limit}`);
    },

    async getItemsDetails(itemIds) {
        if (!itemIds || itemIds.length === 0) return [];
        const ids = itemIds.slice(0, 20).join(',');
        const data = await mlFetch(`/items?ids=${ids}&attributes=id,title,price,base_price,original_price,available_quantity,thumbnail,status,seller_sku,shipping`);
        return data.map(r => r.body).filter(Boolean);
    },

    async getItem(itemId) {
        return mlFetch(`/items/${itemId}`);
    },

    async updateStock(itemId, quantity) {
        return mlFetch(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ available_quantity: quantity }),
        });
    },

    async pauseItem(itemId) {
        return mlFetch(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'paused' }),
        });
    },

    async reactivateItem(itemId) {
        return mlFetch(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'active' }),
        });
    },

    async getPendingOrders() {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return [];
        const data = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&order.status=paid&sort=date_asc&limit=50`);
        return data.results || [];
    },

    async getSalesHistory(dateFrom, dateTo) {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return [];
        const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = dateTo || new Date().toISOString();
        const data = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&order.status=paid&order.date_created.from=${from}&order.date_created.to=${to}&sort=date_desc&limit=100`);
        return data.results || [];
    },
};

export const mlListings = {
    async saveListings(items) {
        const rows = items.map(item => ({
            platform: 'ml',
            ml_item_id: item.id,
            title: item.title,
            sku: item.seller_sku || '',
            thumbnail_url: item.thumbnail?.replace('http://', 'https://') || '',
            status: item.status,
            price: item.original_price || (item.base_price && item.base_price > item.price ? item.base_price : item.price) || 0,
            price_promo: (item.original_price || (item.base_price && item.base_price > item.price)) ? item.price : null,
            stock_ml: item.available_quantity || 0,
            logistic_type: item.shipping?.logistic_type || 'default',
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('marketplace_listings').upsert(rows, { onConflict: 'ml_item_id' });
        if (error) console.error('saveListings error:', error);
    },

    async getListings() {
        const { data, error } = await supabase
            .from('marketplace_listings')
            .select('*')
            .eq('platform', 'ml')
            .order('title');
        if (error) return [];
        return data || [];
    },

    async linkFt(listingId, ftId) {
        const { error } = await supabase
            .from('marketplace_listings')
            .update({ ft_id: ftId, updated_at: new Date().toISOString() })
            .eq('id', listingId);
        return !error;
    },

    async updatePhysicalStock(listingId, quantity) {
        const { error } = await supabase
            .from('marketplace_listings')
            .update({ stock_physical: quantity, updated_at: new Date().toISOString() })
            .eq('id', listingId);
        return !error;
    },
};








