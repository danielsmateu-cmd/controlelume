import { getSetting } from './partnerSupabase.js';

export const PARTNER_CHANNELS = ['meli', 'shopee', 'tiktok', 'amazon', 'site'];

const DEFAULT_ORIGIN_CEP = '13347-458';
const DEFAULT_BRAND = 'Lume Acrílicos';

export const FIELD_DICTIONARY = [
    { campo: 'id', tipo: 'string (UUID)', unidade: null, obrigatorio: true, descricao: 'Identificador fixo e imutável do produto no Controle Lume.' },
    { campo: 'codigo_ft', tipo: 'string', unidade: null, obrigatorio: true, descricao: 'Código interno da Ficha Técnica (ex: FT004).' },
    { campo: 'sku_principal', tipo: 'string | null', unidade: null, obrigatorio: false, descricao: 'SKU do produto no canal principal ativo (prioridade Mercado Livre).' },
    { campo: 'nome', tipo: 'string', unidade: null, obrigatorio: true, descricao: 'Nome base do produto no cadastro técnico.' },
    { campo: 'titulo_comercial', tipo: 'string | null', unidade: null, obrigatorio: false, descricao: 'Título comercial utilizado para anúncio no marketplace.' },
    { campo: 'descricao', tipo: 'string | null', unidade: null, obrigatorio: false, descricao: 'Descrição completa do produto em texto simples.' },
    { campo: 'marca', tipo: 'string', unidade: null, obrigatorio: true, descricao: 'Marca do produto.' },
    { campo: 'ean', tipo: 'string | null', unidade: null, obrigatorio: false, descricao: 'Código de barras GTIN/EAN quando aplicável.' },
    { campo: 'categoria', tipo: 'string | null', unidade: null, obrigatorio: false, descricao: 'Categoria ou linha do produto.' },
    { campo: 'situacao', tipo: 'string (enum)', unidade: null, obrigatorio: true, descricao: 'Situação da ficha: "ativo" ou "excluido". Itens marcados como "Não está à venda" não são enviados.' },
    { campo: 'preco_venda', tipo: 'number', unidade: 'R$', obrigatorio: true, descricao: 'Preço de venda ajustado do canal ativo principal (com 2 casas decimais).' },
    { campo: 'preco_promocional', tipo: 'number | null', unidade: 'R$', obrigatorio: false, descricao: 'Preço promocional no canal ativo, quando houver.' },
    { campo: 'estoque_disponivel', tipo: 'integer | null', unidade: 'un', obrigatorio: false, descricao: 'Quantidade disponível em estoque.' },
    { campo: 'cep_origem', tipo: 'string', unidade: null, obrigatorio: true, descricao: 'CEP de expedição para cálculo de frete.' },
    { campo: 'fotos', tipo: 'array<string>', unidade: 'URL HTTPS', obrigatorio: false, descricao: 'Links públicos HTTPS das imagens em ordem (foto principal na posição 0).' },
    { campo: 'video_url', tipo: 'string | null', unidade: 'URL HTTPS', obrigatorio: false, descricao: 'Link público HTTPS de vídeo do produto, quando houver.' },
    { campo: 'medidas_embalagem', tipo: 'object', unidade: 'cm / kg', obrigatorio: false, descricao: 'Dimensões da embalagem (comprimento_cm, largura_cm, altura_cm, peso_kg) e dimensões do produto sem caixa.' },
    { campo: 'fiscal', tipo: 'object', unidade: null, obrigatorio: false, descricao: 'Dados fiscais para Simples Nacional: ncm (8 dígitos), origem (0-8), cest e csosn.' },
    { campo: 'variacoes', tipo: 'array<object>', unidade: null, obrigatorio: false, descricao: 'Lista de variações (cor/modelo/tamanho) com id, nome, sku e preço/estoque por canal vendável.' },
    { campo: 'canais', tipo: 'object', unidade: null, obrigatorio: true, descricao: 'Mapa por marketplace ativo (meli, shopee, tiktok, amazon, site) contendo apenas canais liberados para venda, com preço ajustado e SKU próprio.' },
    { campo: 'criado_em', tipo: 'string (ISO 8601 UTC)', unidade: 'UTC', obrigatorio: true, descricao: 'Data e hora de criação da ficha em UTC.' },
    { campo: 'atualizado_em', tipo: 'string (ISO 8601 UTC)', unidade: 'UTC', obrigatorio: true, descricao: 'Data e hora da última alteração em UTC (considerando preço, variação, foto, estoque, fiscal e medidas).' },
    { campo: 'excluido_em', tipo: 'string (ISO 8601 UTC) | null', unidade: 'UTC', obrigatorio: false, descricao: 'Data e hora da exclusão em UTC quando situacao = "excluido".' },
];

function roundMoney(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

function toIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
}

function toHttpsUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://')) return 'https://' + trimmed.slice(7);
    if (trimmed.startsWith('https://')) return trimmed;
    return null;
}

function parseNumberFlexible(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const clean = String(raw).trim().replace(',', '.').match(/[\d.]+/);
    if (!clean) return null;
    const n = parseFloat(clean[0]);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function parseDimensionsString(raw) {
    if (!raw || typeof raw !== 'string') return { comprimento_cm: null, largura_cm: null, altura_cm: null };
    const nums = raw.replace(/,/g, '.').match(/[\d.]+/g);
    if (!nums || nums.length < 3) return { comprimento_cm: null, largura_cm: null, altura_cm: null };
    return {
        comprimento_cm: parseFloat(nums[0]) || null,
        largura_cm: parseFloat(nums[1]) || null,
        altura_cm: parseFloat(nums[2]) || null,
    };
}

function toIsoUtc(value, fallback = null) {
    if (!value) return fallback;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function latestIsoUtc(...values) {
    let best = null;
    let bestMs = -1;
    for (const v of values) {
        if (!v) continue;
        const d = new Date(v);
        const ms = d.getTime();
        if (!Number.isNaN(ms) && ms > bestMs) {
            bestMs = ms;
            best = d.toISOString();
        }
    }
    return best;
}

/**
 * Checks whether the FT should be excluded completely because the user marked
 * "Não está à venda" across all configured channels (or primary when others aren't customized).
 */
export function isProductMarkedNotForSale(ftCode, overridesByChannel) {
    const explicitOverrides = PARTNER_CHANNELS
        .map(ch => overridesByChannel?.[ch]?.[ftCode])
        .filter(Boolean);

    if (explicitOverrides.length === 0) return false;
    return explicitOverrides.every(ovr => Boolean(ovr.notForSale));
}

/**
 * Pure allow-listed serializer for an active FT.
 * Explicitly NEVER accesses or forwards costs, margins, rankPrice, production time,
 * customers, orders, employees, passwords, or suppliers.
 */
export function buildPartnerProduct(baseFt, context = {}) {
    const {
        overridesByChannel = {},
        ftVariationsMap = {},
        precificacaoData = {},
    } = context;

    if (!baseFt || !baseFt.id || !baseFt.ft_code) return null;

    if (isProductMarkedNotForSale(baseFt.ft_code, overridesByChannel)) {
        return null;
    }

    const activeChannels = {};
    const channelUpdateTimestamps = [];

    for (const ch of PARTNER_CHANNELS) {
        const ovr = overridesByChannel?.[ch]?.[baseFt.ft_code] || null;
        if (ovr?.notForSale) continue; // Canal marcado como "Não vender" não sai na API

        const price = roundMoney(ovr?.salePrice ?? baseFt.sale_price);
        const promoPrice = roundMoney(ovr?.promoPrice);
        const stock = toIntOrNull(ovr?.stock);
        const chUpdated = toIsoUtc(ovr?.updatedAt);
        if (chUpdated) channelUpdateTimestamps.push(chUpdated);

        activeChannels[ch] = {
            sku: ovr?.sku ? String(ovr.sku).trim() : null,
            titulo_comercial: ovr?.marketplaceTitle ? String(ovr.marketplaceTitle).trim() : null,
            preco_venda: price ?? 0,
            preco_promocional: promoPrice,
            estoque_disponivel: stock,
            atualizado_em: chUpdated || toIsoUtc(baseFt.updated_at),
        };
    }

    const activeChannelKeys = Object.keys(activeChannels);
    if (activeChannelKeys.length === 0) return null;

    // Canal de referência principal para campos compartilhados (prioriza meli)
    const primaryKey = activeChannels.meli ? 'meli' : activeChannelKeys[0];
    const primaryOvr = overridesByChannel?.[primaryKey]?.[baseFt.ft_code] || {};
    const findFirstField = (getter) => {
        const fromPrimary = getter(primaryOvr);
        if (fromPrimary !== undefined && fromPrimary !== null && fromPrimary !== '') return fromPrimary;
        for (const ch of activeChannelKeys) {
            const val = getter(overridesByChannel?.[ch]?.[baseFt.ft_code] || {});
            if (val !== undefined && val !== null && val !== '') return val;
        }
        return null;
    };

    const rawPhotos = findFirstField(o => Array.isArray(o.photos) && o.photos.length > 0 ? o.photos : null) || [];
    const fotos = rawPhotos.map(toHttpsUrl).filter(Boolean);
    const video_url = toHttpsUrl(findFirstField(o => o.videoUrl));

    const precif = precificacaoData?.[baseFt.id] || {};
    const dimComCaixa = parseDimensionsString(precif.medidasComCaixa);
    const dimSemCaixa = parseDimensionsString(precif.medidasSemCaixa);

    const rawVars = Array.isArray(ftVariationsMap?.[baseFt.ft_code])
        ? ftVariationsMap[baseFt.ft_code]
        : (Array.isArray(primaryOvr.variations) ? primaryOvr.variations : []);

    const variacoes = rawVars.map(v => {
        const sku_por_canal = {};
        const preco_por_canal = {};
        const preco_promocional_por_canal = {};
        const estoque_por_canal = {};

        for (const ch of activeChannelKeys) {
            const vSku = v.skus?.[ch] || (ch === primaryKey ? v.sku : '') || '';
            if (vSku) sku_por_canal[ch] = String(vSku).trim();

            const chData = v.channelData?.[ch] || {};
            const chPrice = roundMoney(chData.price ?? activeChannels[ch].preco_venda);
            if (chPrice !== null) preco_por_canal[ch] = chPrice;

            const chPromo = roundMoney(chData.promoPrice);
            if (chPromo !== null) preco_promocional_por_canal[ch] = chPromo;

            const chStock = toIntOrNull(chData.stock);
            if (chStock !== null) estoque_por_canal[ch] = chStock;
        }

        return {
            id: String(v.id || v.mlVariationId || v.name || ''),
            nome: String(v.name || '').trim(),
            sku: (sku_por_canal[primaryKey] || (v.sku ? String(v.sku).trim() : null)) || null,
            sku_por_canal,
            preco_por_canal,
            preco_promocional_por_canal,
            estoque_por_canal,
        };
    });

    const criado_em = toIsoUtc(baseFt.created_at, new Date().toISOString());
    const atualizado_em = latestIsoUtc(baseFt.updated_at, ...channelUpdateTimestamps, criado_em);

    return {
        id: String(baseFt.id),
        codigo_ft: String(baseFt.ft_code),
        sku_principal: activeChannels[primaryKey].sku || null,
        nome: String(baseFt.name || ''),
        titulo_comercial: findFirstField(o => o.marketplaceTitle) || String(baseFt.name || ''),
        descricao: findFirstField(o => o.description) || null,
        marca: findFirstField(o => o.brand) || DEFAULT_BRAND,
        ean: findFirstField(o => o.ean) || null,
        categoria: findFirstField(o => o.category) || null,
        situacao: 'ativo',
        preco_venda: activeChannels[primaryKey].preco_venda,
        preco_promocional: activeChannels[primaryKey].preco_promocional,
        estoque_disponivel: activeChannels[primaryKey].estoque_disponivel,
        cep_origem: findFirstField(o => o.originCep) || DEFAULT_ORIGIN_CEP,
        fotos,
        video_url,
        medidas_embalagem: {
            comprimento_cm: dimComCaixa.comprimento_cm,
            largura_cm: dimComCaixa.largura_cm,
            altura_cm: dimComCaixa.altura_cm,
            peso_kg: parseNumberFlexible(precif.pesoComCaixa),
            texto_com_caixa: precif.medidasComCaixa || null,
            produto_sem_caixa_comprimento_cm: dimSemCaixa.comprimento_cm,
            produto_sem_caixa_largura_cm: dimSemCaixa.largura_cm,
            produto_sem_caixa_altura_cm: dimSemCaixa.altura_cm,
            produto_sem_caixa_peso_kg: parseNumberFlexible(precif.pesoSemCaixa),
        },
        fiscal: {
            ncm: findFirstField(o => o.ncm) || null,
            origem: findFirstField(o => o.origin) ?? '0',
            cest: findFirstField(o => o.cest) || null,
            csosn: findFirstField(o => o.csosn) ?? '102',
        },
        variacoes,
        canais: activeChannels,
        criado_em,
        atualizado_em,
        excluido_em: null,
    };
}

export function buildDeletedProduct(deletedEntry) {
    if (!deletedEntry || !deletedEntry.id) return null;
    const deletedIso = toIsoUtc(deletedEntry.deleted_at, new Date().toISOString());
    return {
        id: String(deletedEntry.id),
        codigo_ft: String(deletedEntry.ft_code || ''),
        sku_principal: null,
        nome: String(deletedEntry.name || ''),
        titulo_comercial: null,
        descricao: null,
        marca: DEFAULT_BRAND,
        ean: null,
        categoria: null,
        situacao: 'excluido',
        preco_venda: null,
        preco_promocional: null,
        estoque_disponivel: null,
        cep_origem: DEFAULT_ORIGIN_CEP,
        fotos: [],
        video_url: null,
        medidas_embalagem: null,
        fiscal: null,
        variacoes: [],
        canais: {},
        criado_em: deletedIso,
        atualizado_em: deletedIso,
        excluido_em: deletedIso,
    };
}

export function encodeCursor(atualizadoEm, id) {
    const payload = JSON.stringify({ t: atualizadoEm, id });
    return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursorStr) {
    if (!cursorStr || typeof cursorStr !== 'string') return null;
    try {
        const parsed = JSON.parse(Buffer.from(cursorStr, 'base64url').toString('utf8'));
        if (parsed && typeof parsed.t === 'string' && typeof parsed.id === 'string') {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export function paginateCatalogItems(items, { alteradosDesde = null, cursor = null, limite = 50 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 100);
    const sinceMs = alteradosDesde ? new Date(alteradosDesde).getTime() : null;
    if (alteradosDesde && Number.isNaN(sinceMs)) {
        const err = new Error('Parâmetro "alterados_desde" deve estar em formato ISO 8601 válido.');
        err.statusCode = 400;
        throw err;
    }

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
        const err = new Error('Parâmetro "cursor" inválido.');
        err.statusCode = 400;
        throw err;
    }

    const sorted = [...items].sort((a, b) => {
        const ta = new Date(a.atualizado_em).getTime();
        const tb = new Date(b.atualizado_em).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
    });

    const filtered = sorted.filter(item => {
        const itemMs = new Date(item.atualizado_em).getTime();
        if (sinceMs !== null && itemMs < sinceMs) return false;
        if (decodedCursor) {
            const curMs = new Date(decodedCursor.t).getTime();
            if (itemMs < curMs) return false;
            if (itemMs === curMs && String(item.id) <= String(decodedCursor.id)) return false;
        }
        return true;
    });

    const pageItems = filtered.slice(0, safeLimit);
    const hasMore = filtered.length > safeLimit;
    const last = pageItems[pageItems.length - 1];
    const proximo_cursor = hasMore && last ? encodeCursor(last.atualizado_em, last.id) : null;

    return {
        itens: pageItems,
        proximo_cursor,
        limite: safeLimit,
        total_retornado: pageItems.length,
    };
}

export async function loadPartnerCatalogContext(client) {
    const [
        ftsRes,
        meliOvr,
        shopeeOvr,
        tiktokOvr,
        amazonOvr,
        siteOvr,
        ftVariationsMap,
        precificacaoData,
        deletedLog,
    ] = await Promise.all([
        client.from('fts').select('id, ft_code, name, sale_price, created_at, updated_at'),
        getSetting('ft_overrides_meli', {}, client),
        getSetting('ft_overrides_shopee', {}, client),
        getSetting('ft_overrides_tiktok', {}, client),
        getSetting('ft_overrides_amazon', {}, client),
        getSetting('ft_overrides_site', {}, client),
        getSetting('ft_variations', {}, client),
        getSetting('precificacao_product_data', {}, client),
        getSetting('ft_deleted_log', [], client),
    ]);

    if (ftsRes.error) {
        throw new Error(`Erro ao carregar FTs: ${ftsRes.error.message}`);
    }

    return {
        baseFts: ftsRes.data || [],
        overridesByChannel: {
            meli: meliOvr || {},
            shopee: shopeeOvr || {},
            tiktok: tiktokOvr || {},
            amazon: amazonOvr || {},
            site: siteOvr || {},
        },
        ftVariationsMap: ftVariationsMap || {},
        precificacaoData: precificacaoData || {},
        deletedLog: Array.isArray(deletedLog) ? deletedLog : [],
    };
}

export async function buildAllPartnerProducts(client) {
    const ctx = await loadPartnerCatalogContext(client);
    const activeIds = new Set();
    const products = [];

    for (const baseFt of ctx.baseFts) {
        const built = buildPartnerProduct(baseFt, ctx);
        if (built) {
            activeIds.add(built.id);
            products.push(built);
        }
    }

    for (const del of ctx.deletedLog) {
        if (del?.id && !activeIds.has(String(del.id))) {
            const tomb = buildDeletedProduct(del);
            if (tomb) products.push(tomb);
        }
    }

    return products;
}

export async function getSinglePartnerProduct(id, client) {
    const ctx = await loadPartnerCatalogContext(client);
    const baseFt = ctx.baseFts.find(f => String(f.id) === String(id) || String(f.ft_code) === String(id));
    if (baseFt) {
        return buildPartnerProduct(baseFt, ctx);
    }
    const del = ctx.deletedLog.find(d => String(d.id) === String(id) || String(d.ft_code) === String(id));
    return del ? buildDeletedProduct(del) : null;
}
