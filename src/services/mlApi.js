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
    // ===== MERCADO ADS =====
    async getAdsCampaigns() {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return [];
        
        // Removemos o try-catch vazio para que o adsAuditService possa ler o erro 403 real do Mercado Livre
        const data = await mlFetch(`/advertising/product_ads/campaigns/search?user_id=${tokens.ml_user_id}`);
        return data.results || data || [];
    },

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
        const data = await mlFetch(`/items?ids=${ids}&attributes=id,title,price,base_price,original_price,available_quantity,thumbnail,status,seller_sku,shipping,variations`);
        return data.map(r => r.body).filter(Boolean);
    },

    async getItemsFullDetails(itemIds) {
        if (!itemIds || itemIds.length === 0) return [];
        const ids = itemIds.slice(0, 20).join(',');
        const data = await mlFetch(`/items?ids=${ids}&include_attributes=all`);
        return data.map(r => r.body).filter(Boolean);
    },

    async getItemDescription(itemId) {
        try {
            return await mlFetch(`/items/${itemId}/description`);
        } catch (err) {
            return { plain_text: '' };
        }
    },

    async getCategoryPath(categoryId) {
        if (!categoryId) return '';
        if (!mlApi._categoryCache) mlApi._categoryCache = {};
        if (mlApi._categoryCache[categoryId]) return mlApi._categoryCache[categoryId];
        try {
            const data = await mlFetch(`/categories/${categoryId}`);
            const path = Array.isArray(data?.path_from_root) && data.path_from_root.length > 0
                ? data.path_from_root.map(c => c.name).join(' > ')
                : (data?.name || categoryId);
            mlApi._categoryCache[categoryId] = path;
            return path;
        } catch (err) {
            return categoryId;
        }
    },

    extractCatalogData(item, descData, categoryPath = '') {
        if (!item) return null;
        const findAttr = (attrId) => {
            const found = (item.attributes || []).find(a => a.id === attrId);
            return found?.value_name || '';
        };

        const rawEan = findAttr('GTIN');
        const invalidEans = ['não se aplica', 'nao se aplica', 'n/a', 'isento', 'sem código', 'sem codigo'];
        const ean = rawEan && !invalidEans.includes(rawEan.toLowerCase().trim()) ? rawEan.trim() : '';

        const brand = findAttr('BRAND') || 'Lume Acrílicos';
        const sku = item.seller_sku
            || item.seller_custom_field
            || findAttr('SELLER_SKU')
            || '';

        const photos = (item.pictures || [])
            .map(p => (p.secure_url || p.url || '').replace('http://', 'https://'))
            .filter(Boolean);

        if (photos.length === 0 && item.thumbnail) {
            photos.push(item.thumbnail.replace('http://', 'https://'));
        }

        const videoUrl = item.video_id
            ? (String(item.video_id).startsWith('http') ? item.video_id : `https://www.youtube.com/watch?v=${item.video_id}`)
            : '';

        const fullPrice = Number(item.original_price || (item.base_price && item.base_price > item.price ? item.base_price : item.price) || 0);
        const promoPrice = (item.original_price || (item.base_price && item.base_price > item.price))
            ? Number(item.price || 0)
            : null;

        const variations = (item.variations || []).map(v => {
            const vSkuAttr = (v.attributes || []).find(a => a.id === 'SELLER_SKU')?.value_name || '';
            const vSku = v.seller_custom_field || vSkuAttr || '';
            const vAttrText = (v.attribute_combinations || []).map(a => a.value_name).filter(Boolean).join(' / ');
            const vPhoto = v.picture_ids && v.picture_ids.length > 0
                ? `https://http2.mlstatic.com/D_${v.picture_ids[0]}-I.jpg`
                : '';

            return {
                mlVariationId: String(v.id),
                name: vAttrText || `Variação ${v.id}`,
                sku: vSku,
                stock: Number(v.available_quantity) || 0,
                price: Number(v.price) || fullPrice,
                promoPrice: promoPrice && promoPrice < (Number(v.price) || fullPrice) ? promoPrice : null,
                photo: vPhoto
            };
        });

        return {
            mlItemId: item.id,
            marketplaceTitle: item.title || '',
            description: descData?.plain_text || '',
            brand,
            ean,
            category: categoryPath || item.category_id || '',
            photos,
            videoUrl,
            sku,
            stock: Number(item.available_quantity) || 0,
            salePrice: fullPrice,
            promoPrice,
            ncm: findAttr('NCM') || '',
            variations
        };
    },

    mergeVariationsFromMl(existingVars = [], mlVariations = [], targetChannel = 'meli', opts = {}) {
        const { overwritePrices = false, overwriteStock = true } = opts;
        if (!Array.isArray(mlVariations) || mlVariations.length === 0) {
            return Array.isArray(existingVars) ? existingVars : [];
        }

        const norm = (s) => String(s || '').trim().toLowerCase();
        const usedMlIndices = new Set();

        const merged = (existingVars || []).map((v) => {
            const vSkuMeli = norm(v.skus?.meli || v.sku);
            const vName = norm(v.name);
            const vMlId = v.mlVariationId ? String(v.mlVariationId) : '';

            const matchIdx = mlVariations.findIndex((mv, idx) => {
                if (usedMlIndices.has(idx)) return false;
                if (vMlId && mv.mlVariationId && String(mv.mlVariationId) === vMlId) return true;
                if (mv.sku && vSkuMeli && norm(mv.sku) === vSkuMeli) return true;
                if (mv.name && vName && norm(mv.name) === vName) return true;
                return false;
            });

            if (matchIdx === -1) return v;
            usedMlIndices.add(matchIdx);
            const mv = mlVariations[matchIdx];
            const prevCh = v.channelData?.[targetChannel] || {};
            const prevMeli = v.channelData?.meli || {};

            const nextChannelData = {
                ...(v.channelData || {}),
                [targetChannel]: {
                    ...prevCh,
                    price: overwritePrices ? mv.price : (prevCh.price ?? mv.price ?? null),
                    promoPrice: overwritePrices ? mv.promoPrice : (prevCh.promoPrice ?? mv.promoPrice ?? null),
                    stock: overwriteStock ? mv.stock : (prevCh.stock ?? mv.stock ?? 0),
                },
            };

            if (targetChannel !== 'meli') {
                nextChannelData.meli = {
                    ...prevMeli,
                    price: prevMeli.price ?? mv.price ?? null,
                    promoPrice: prevMeli.promoPrice ?? mv.promoPrice ?? null,
                    stock: mv.stock ?? prevMeli.stock ?? 0,
                };
            }

            return {
                ...v,
                mlVariationId: v.mlVariationId || mv.mlVariationId,
                sku: v.sku || mv.sku || '',
                skus: {
                    ...(v.skus || {}),
                    ...(mv.sku && !v.skus?.meli ? { meli: mv.sku } : {}),
                },
                channelData: nextChannelData,
            };
        });

        // Cria automaticamente as variações do ML que ainda não existiam na FT
        mlVariations.forEach((mv, idx) => {
            if (usedMlIndices.has(idx)) return;
            const channelEntry = {
                price: mv.price ?? null,
                promoPrice: mv.promoPrice ?? null,
                stock: mv.stock ?? 0,
            };
            merged.push({
                id: mv.mlVariationId ? `ml_${mv.mlVariationId}` : `var_${Date.now()}_${idx}`,
                mlVariationId: mv.mlVariationId || '',
                name: mv.name || `Variação ${idx + 1}`,
                sku: mv.sku || '',
                skus: {
                    ...(mv.sku ? { meli: mv.sku } : {}),
                },
                channelData: {
                    meli: channelEntry,
                    ...(targetChannel !== 'meli' ? { [targetChannel]: { ...channelEntry } } : {}),
                },
            });
        });

        return merged;
    },

    _extractFiscalFromInvoiceItem(invItem) {
        if (!invItem) return null;
        const attrs = invItem.fiscal_data?.attributes || {};
        const rules = invItem.fiscal_data?.rules || [];
        const icmsRule = rules.find(r => r.name === 'ICMS_SIMPLES')?.attributes || {};
        return {
            ncm: attrs.ncm || '',
            cest: attrs.cest || '',
            origin: attrs.origin_detail !== undefined && attrs.origin_detail !== null ? String(attrs.origin_detail) : '',
            csosn: attrs.csosn || icmsRule.csosn || '',
            ean: invItem.attributes?.ean || '',
        };
    },

    async getItemFiscalInfo(mlItemId, candidateSkus = []) {
        const result = { ncm: '', cest: '', origin: '', csosn: '', ean: '' };
        const mergeInto = (src) => {
            if (!src) return;
            if (!result.ncm && src.ncm) result.ncm = String(src.ncm);
            if (!result.cest && src.cest) result.cest = String(src.cest);
            if (result.origin === '' && src.origin !== undefined && src.origin !== null && src.origin !== '') {
                result.origin = String(src.origin);
            }
            if (!result.csosn && src.csosn) result.csosn = String(src.csosn);
            if (!result.ean && src.ean) result.ean = String(src.ean);
        };

        // 1. Tenta via NF-e emitida em pedidos recentes deste anúncio (traz NCM, CEST, Origem, CSOSN e EAN)
        try {
            const tokens = await mlAuth.getTokens();
            if (tokens?.ml_user_id && mlItemId) {
                const ordersRes = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&q=${encodeURIComponent(mlItemId)}&limit=8&sort=date_desc`);
                for (const order of (ordersRes?.results || [])) {
                    try {
                        const inv = await mlFetch(`/users/${tokens.ml_user_id}/invoices/orders/${order.id}`);
                        const invItem = (inv?.items || []).find(it => it.external_product_id === mlItemId) || (inv?.items || [])[0];
                        if (invItem) {
                            mergeInto(mlApi._extractFiscalFromInvoiceItem(invItem));
                            if (result.ncm) break;
                        }
                    } catch (_) {
                        // Pedido sem NF-e emitida no ML — tenta o próximo pedido
                    }
                }
            }
        } catch (_) {}

        // 2. Fallback por SKU na API fiscal do Mercado Livre
        if (!result.ncm) {
            const uniqueSkus = [...new Set((candidateSkus || []).map(s => String(s || '').trim()).filter(Boolean))];
            for (const sku of uniqueSkus) {
                try {
                    const data = await mlFetch(`/items/fiscal_information/${encodeURIComponent(sku)}`);
                    const tax = data?.tax_information;
                    if (tax) {
                        mergeInto({
                            ncm: tax.ncm || '',
                            cest: tax.cest || '',
                            origin: tax.origin_detail !== undefined && tax.origin_detail !== null ? String(tax.origin_detail) : '',
                            csosn: tax.csosn || '',
                            ean: tax.ean || '',
                        });
                        if (result.ncm) break;
                    }
                } catch (_) {}
            }
        }

        return result;
    },

    async getBulkFiscalMap(extractedItems = [], onProgress = null) {
        const fiscalMap = {};
        if (!Array.isArray(extractedItems) || extractedItems.length === 0) return fiscalMap;

        let tokens = null;
        try {
            tokens = await mlAuth.getTokens();
        } catch (_) {}

        const mergeFiscal = (itemId, src) => {
            if (!src) return;
            const cur = fiscalMap[itemId] || { ncm: '', cest: '', origin: '', csosn: '', ean: '' };
            if (!cur.ncm && src.ncm) cur.ncm = String(src.ncm);
            if (!cur.cest && src.cest) cur.cest = String(src.cest);
            if (cur.origin === '' && src.origin !== undefined && src.origin !== null && src.origin !== '') {
                cur.origin = String(src.origin);
            }
            if (!cur.csosn && src.csosn) cur.csosn = String(src.csosn);
            if (!cur.ean && src.ean) cur.ean = String(src.ean);
            fiscalMap[itemId] = cur;
        };

        // 1. Varre os últimos 150 pedidos pagos para mapear NF-es por ml_item_id rapidamente
        if (tokens?.ml_user_id) {
            try {
                const targetIds = new Set(extractedItems.map(i => i.mlItemId));
                const orderByItem = {};
                for (const offset of [0, 50, 100]) {
                    if (onProgress) onProgress(`Mapeando notas fiscais recentes (${offset + 50} pedidos)...`);
                    const res = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&sort=date_desc&limit=50&offset=${offset}`);
                    const results = res?.results || [];
                    for (const ord of results) {
                        for (const oi of (ord.order_items || [])) {
                            const mid = oi.item?.id;
                            if (mid && targetIds.has(mid) && !orderByItem[mid]) {
                                orderByItem[mid] = ord.id;
                            }
                        }
                    }
                    if (results.length < 50) break;
                }

                // Busca cada pedido único encontrado (uma NF-e pode conter múltiplos itens)
                const uniqueOrderIds = [...new Set(Object.values(orderByItem))];
                for (let i = 0; i < uniqueOrderIds.length; i += 5) {
                    if (onProgress) onProgress(`Extraindo NCM/CEST/Origem das NF-es (${Math.min(i + 5, uniqueOrderIds.length)}/${uniqueOrderIds.length})...`);
                    const batch = uniqueOrderIds.slice(i, i + 5);
                    await Promise.all(batch.map(async (orderId) => {
                        try {
                            const inv = await mlFetch(`/users/${tokens.ml_user_id}/invoices/orders/${orderId}`);
                            for (const invItem of (inv?.items || [])) {
                                if (invItem.external_product_id) {
                                    mergeFiscal(invItem.external_product_id, mlApi._extractFiscalFromInvoiceItem(invItem));
                                }
                            }
                        } catch (_) {}
                    }));
                }
            } catch (_) {}
        }

        // 2. Para itens ainda sem NCM, tenta busca individual por SKU / histórico de pedidos do anúncio
        const missing = extractedItems.filter(it => !fiscalMap[it.mlItemId]?.ncm);
        for (let i = 0; i < missing.length; i += 4) {
            if (onProgress) onProgress(`Consultando dados fiscais restantes (${Math.min(i + 4, missing.length)}/${missing.length})...`);
            const batch = missing.slice(i, i + 4);
            await Promise.all(batch.map(async (it) => {
                const candidateSkus = [it.sku, ...(it.variations || []).map(v => v.sku)].filter(Boolean);
                const info = await mlApi.getItemFiscalInfo(it.mlItemId, candidateSkus);
                if (info.ncm || info.cest || info.csosn || info.ean) {
                    mergeFiscal(it.mlItemId, info);
                }
            }));
        }

        return fiscalMap;
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

    
    async calculateSalesVelocity(daysBack = 30) {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return {};
        
        const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
        const to = new Date().toISOString();
        
        let allOrders = [];
        let offset = 0;
        const limit = 50;
        let total = 0;
        
        do {
            const data = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&order.status=paid&order.date_created.from=${from}&order.date_created.to=${to}&sort=date_desc&limit=${limit}&offset=${offset}`);
            if (!data.results || data.results.length === 0) break;
            
            allOrders = allOrders.concat(data.results);
            total = data.paging?.total || 0;
            offset += limit;
            
            if (offset >= 500) break; // limit to 500 orders
        } while (offset < total);
        
        const tally = {};
        for (const order of allOrders) {
            for (const item of order.order_items || []) {
                const mlId = item.item?.id;
                const qty = item.quantity || 1;
                const variationId = item.item?.variation_id;
                
                if (mlId) {
                    if (!tally[mlId]) tally[mlId] = { total: 0, variations: {} };
                    tally[mlId].total += qty;
                    if (variationId) {
                        if (!tally[mlId].variations[variationId]) tally[mlId].variations[variationId] = 0;
                        tally[mlId].variations[variationId] += qty;
                    }
                }
            }
        }
        return tally;
    },

    async getAllOrdersByDate(dateFrom, dateTo) {
        const tokens = await mlAuth.getTokens();
        if (!tokens?.ml_user_id) return [];
        
        let allOrders = [];
        let offset = 0;
        const limit = 50;
        let total = 0;
        
        do {
            const data = await mlFetch(`/orders/search?seller=${tokens.ml_user_id}&order.date_created.from=${dateFrom}&order.date_created.to=${dateTo}&sort=date_desc&limit=${limit}&offset=${offset}`);
            if (!data.results || data.results.length === 0) break;
            
            allOrders = allOrders.concat(data.results);
            total = data.paging?.total || 0;
            offset += limit;
            
            if (offset >= 2000) break;
        } while (offset < total);
        
        return allOrders;
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
        const { data: existingData } = await supabase.from('marketplace_listings').select('ml_item_id, variations');
        const existingMap = {};
        if (existingData) {
            existingData.forEach(r => { existingMap[r.ml_item_id] = r.variations || []; });
        }

        const rows = items.map(item => {
            const existingVars = existingMap[item.id] || [];
            return {
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
                variations: item.variations && item.variations.length > 0 ? item.variations.map(v => {
                    const existV = existingVars.find(ev => ev.id === v.id);
                    return {
                        id: v.id,
                        stock: v.available_quantity,
                        stock_physical: existV ? (existV.stock_physical || 0) : 0,
                        thumbnail: v.picture_ids && v.picture_ids.length > 0 ? `https://http2.mlstatic.com/D_${v.picture_ids[0]}-I.jpg` : null,
                        attributes: v.attribute_combinations ? v.attribute_combinations.map(a => a.value_name).join(' / ') : 'Variado'
                    };
                }) : null,
                updated_at: new Date().toISOString(),
            };
        });
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

    async linkVariationFt(listingId, variationId, ftId) {
        // Fetch current listing to get variations array
        const { data } = await supabase.from('marketplace_listings').select('variations').eq('id', listingId).single();
        if (!data || !data.variations) return false;
        
        const updatedVariations = data.variations.map(v => 
            String(v.id) === String(variationId) ? { ...v, ft_id: ftId } : v
        );
        
        const { error } = await supabase
            .from('marketplace_listings')
            .update({ variations: updatedVariations, updated_at: new Date().toISOString() })
            .eq('id', listingId);
        return !error;
    },

    
    async updateVariationPhysicalStock(listingId, variationsArray) {
        const { error } = await supabase
            .from('marketplace_listings')
            .update({ variations: variationsArray, updated_at: new Date().toISOString() })
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









