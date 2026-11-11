import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPartnerProduct,
    buildDeletedProduct,
    paginateCatalogItems,
    parseWeightToKg,
    FIELD_DICTIONARY,
} from '../api/_lib/partnerCatalog.js';
import { recalculateMaterialItem } from '../api/_lib/materialRecalc.js';
import {
    generateApiKey,
    hashApiKey,
    KEYS_SETTING,
    RATE_SETTING,
} from '../api/_lib/partnerSecurity.js';
import {
    signWebhookPayload,
    verifyWebhookSignature,
    generateWebhookSecret,
    enqueueWebhookEvent,
    processWebhookOutbox,
    WEBHOOK_CONFIG_SETTING,
    WEBHOOK_OUTBOX_SETTING,
} from '../api/_lib/partnerWebhook.js';
import { handlePartnerApiRequest } from '../api/parceiros-v1.js';

function createMockSupabase(initialSettings = {}, initialFts = []) {
    const store = { settings: { ...initialSettings }, fts: [...initialFts] };
    return {
        store,
        from(table) {
            if (table === 'settings') {
                return {
                    _key: null,
                    select() { return this; },
                    eq(col, val) {
                        if (col !== 'id') throw new Error(`column settings.${col} does not exist`);
                        this._key = val;
                        return this;
                    },
                    async maybeSingle() {
                        const val = Object.prototype.hasOwnProperty.call(store.settings, this._key)
                            ? { value: store.settings[this._key] }
                            : null;
                        return { data: val, error: null };
                    },
                    async upsert(row) {
                        if (!row || !row.id) throw new Error('settings.upsert requires id');
                        store.settings[row.id] = row.value;
                        return { error: null };
                    },
                };
            }
            if (table === 'fts') {
                return {
                    select() {
                        return Promise.resolve({ data: store.fts, error: null });
                    },
                };
            }
            throw new Error(`Unexpected table ${table}`);
        },
    };
}

function createMockRes() {
    const headers = {};
    let statusCode = 200;
    let body = null;
    return {
        headers,
        get statusCode() { return statusCode; },
        get body() { return body; },
        setHeader(k, v) { headers[k.toLowerCase()] = v; },
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            body = payload;
            return this;
        },
    };
}

function buildTestEnvironment() {
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const { rawKey: revokedKey, keyHash: revokedHash, keyPrefix: revokedPrefix } = generateApiKey();

    const fts = [
        {
            id: '11111111-1111-4111-8111-111111111111',
            ft_code: 'FT001',
            name: 'Organizador Acrílico Cristal',
            sale_price: 100,
            created_at: '2026-01-10T10:00:00.000Z',
            updated_at: '2026-11-01T10:00:00.000Z',
        },
        {
            id: '22222222-2222-4222-8222-222222222222',
            ft_code: 'FT002',
            name: 'Display Balcão Lume',
            sale_price: 80,
            created_at: '2026-02-10T10:00:00.000Z',
            updated_at: '2026-11-05T12:00:00.000Z',
        },
        {
            id: '33333333-3333-4333-8333-333333333333',
            ft_code: 'FT003',
            name: 'Produto Uso Interno Sem Venda',
            sale_price: 55,
            created_at: '2026-02-12T10:00:00.000Z',
            updated_at: '2026-11-05T12:00:00.000Z',
        },
        {
            id: '44444444-4444-4444-8444-444444444444',
            ft_code: 'FT004',
            name: 'Suporte Porta Luvas',
            sale_price: 199,
            created_at: '2026-03-01T08:00:00.000Z',
            updated_at: '2026-11-10T15:30:00.000Z',
        },
    ];

    const settings = {
        [KEYS_SETTING]: [
            {
                id: 'key-1',
                name: 'eBureau',
                keyHash,
                keyPrefix,
                active: true,
                rateLimitPerMin: 60,
                createdAt: '2026-11-11T00:00:00.000Z',
            },
            {
                id: 'key-2',
                name: 'Antiga',
                keyHash: revokedHash,
                keyPrefix: revokedPrefix,
                active: false,
                rateLimitPerMin: 60,
                createdAt: '2026-10-01T00:00:00.000Z',
            },
        ],
        ft_overrides_meli: {
            FT001: {
                sku: 'FT001-ML',
                salePrice: 129.9,
                promoPrice: 119.9,
                stock: 15,
                marketplaceTitle: 'Organizador Premium Acrílico',
                description: 'Descrição limpa',
                brand: 'Lume Acrílicos',
                ean: '7890000000011',
                ncm: '39205100',
                origin: '0',
                cest: '2805800',
                csosn: '102',
                photos: ['http://http2.mlstatic.com/foto1.jpg', 'https://http2.mlstatic.com/foto2.jpg'],
                materials: [{ name: 'Acrílico 3mm Cristal (20x30cm) @meta:id:1;t:sheet;x:20;y:30;p:100;pm2:50', value: 18.5 }],
                directCostsRS: [{ name: 'Envios', value: 19.9 }],
                directCostsPercent: [{ name: 'Taxa ML', percentage: 16 }, { name: 'NF', percentage: 9.5 }],
                rankPrice: 99.9,
                updatedAt: '2026-11-11T09:00:00.000Z',
            },
            FT003: {
                sku: 'FT003-INT',
                notForSale: true,
                salePrice: 55,
                updatedAt: '2026-11-09T12:00:00.000Z',
            },
            FT004: {
                sku: 'FT004-ML',
                salePrice: 220,
                stock: 32,
                notForSale: false,
                materials: [{ name: 'Acrílico 3mm', value: 50 }],
                directCostsRS: [{ name: 'Envios', value: 20 }],
                directCostsPercent: [{ name: 'Taxa ML', percentage: 16 }],
                updatedAt: '2026-11-10T15:30:00.000Z',
            },
        },
        ft_overrides_shopee: {
            FT001: {
                sku: 'FT001-SH',
                salePrice: 134.5,
                stock: 15,
                notForSale: false,
                updatedAt: '2026-11-11T09:00:00.000Z',
            },
            FT004: {
                notForSale: true, // bloqueado na Shopee apenas!
                salePrice: 210,
                updatedAt: '2026-11-10T16:00:00.000Z',
            },
        },
        ft_overrides_tiktok: {},
        ft_overrides_amazon: {},
        ft_overrides_site: {},
        ft_variations: {
            FT004: [
                {
                    id: 'ml_1',
                    name: 'Bronze',
                    sku: 'ft04b',
                    skus: { meli: 'ft04b' },
                    channelData: {
                        meli: { price: 220, promoPrice: null, stock: 10 },
                        shopee: { price: 210, promoPrice: null, stock: 5 },
                    },
                },
            ],
        },
        precificacao_product_data: {
            '11111111-1111-4111-8111-111111111111': {
                medidasComCaixa: '30x20x15',
                medidasSemCaixa: '28x18x12',
                pesoComCaixa: '0,85',
                pesoSemCaixa: '0,60',
            },
            '44444444-4444-4444-8444-444444444444': {
                medidasComCaixa: '30x20x20',
                medidasSemCaixa: '24x15x9',
                pesoComCaixa: '850',
                pesoSemCaixa: '550',
            },
        },
        ft_deleted_log: [
            {
                id: '99999999-9999-4999-8999-999999999999',
                ft_code: 'FT099',
                name: 'Produto Antigo Removido',
                deleted_at: '2026-11-08T18:00:00.000Z',
            },
        ],
    };

    return { rawKey, revokedKey, client: createMockSupabase(settings, fts) };
}

test('API Key é salva apenas como hash e chave inválida/revogada/ausente retorna 401', async () => {
    const { rawKey, revokedKey, client } = buildTestEnvironment();
    const stored = client.store.settings[KEYS_SETTING];
    assert.equal(stored.some(k => JSON.stringify(k).includes(rawKey)), false, 'Chave em texto puro nunca pode estar no banco');
    assert.equal(stored[0].keyHash, hashApiKey(rawKey));

    for (const authHeader of [undefined, 'Bearer chave-errada', `Bearer ${revokedKey}`]) {
        const res = createMockRes();
        await handlePartnerApiRequest({
            method: 'GET',
            url: '/api/parceiros/v1/saude',
            headers: { authorization: authHeader, host: 'api.lume.com.br', 'x-forwarded-proto': 'https' },
            query: { route: 'saude' },
        }, res, { client });
        assert.equal(res.statusCode, 401);
    }
});

test('Apenas GET e HTTPS são aceitos (405 para POST e 403 para HTTP)', async () => {
    const { rawKey, client } = buildTestEnvironment();

    const resPost = createMockRes();
    await handlePartnerApiRequest({
        method: 'POST',
        url: '/api/parceiros/v1/produtos',
        headers: { authorization: `Bearer ${rawKey}`, host: 'api.lume.com.br', 'x-forwarded-proto': 'https' },
        query: { route: 'produtos' },
    }, resPost, { client });
    assert.equal(resPost.statusCode, 405);

    const resHttp = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/saude',
        headers: { authorization: `Bearer ${rawKey}`, host: 'api.lume.com.br', 'x-forwarded-proto': 'http' },
        query: { route: 'saude' },
    }, resHttp, { client });
    assert.equal(resHttp.statusCode, 403);
});

test('Chave válida lê /saude, /campos e /produtos com filtros, exclusões e campos proibidos bloqueados', async () => {
    const { rawKey, client } = buildTestEnvironment();

    const resSaude = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/saude',
        headers: { authorization: `Bearer ${rawKey}`, host: 'localhost:5173' },
        query: { route: 'saude' },
    }, resSaude, { client });
    assert.equal(resSaude.statusCode, 200);
    assert.equal(resSaude.body.status, 'ok');

    const resCampos = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/campos',
        headers: { authorization: `Bearer ${rawKey}`, host: 'localhost:5173' },
        query: { route: 'campos' },
    }, resCampos, { client });
    assert.equal(resCampos.statusCode, 200);
    assert.equal(resCampos.body.campos.length, FIELD_DICTIONARY.length);

    // Consulta incremental desde 2026-11-08: deve retornar FT099 (excluída), FT003 (inativo), FT004 e FT001
    const resProd = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/produtos',
        headers: { authorization: `Bearer ${rawKey}`, host: 'localhost:5173' },
        query: { route: 'produtos', alterados_desde: '2026-11-08T00:00:00.000Z', limite: '100' },
    }, resProd, { client });
    assert.equal(resProd.statusCode, 200);

    const codes = resProd.body.itens.map(i => i.codigo_ft);
    assert.deepEqual(codes, ['FT099', 'FT003', 'FT004', 'FT001']);

    const ft099 = resProd.body.itens.find(i => i.codigo_ft === 'FT099');
    assert.equal(ft099.situacao, 'excluido');
    assert.ok(ft099.excluido_em);

    const ft003List = resProd.body.itens.find(i => i.codigo_ft === 'FT003');
    assert.equal(ft003List.situacao, 'inativo');
    assert.equal(ft003List.excluido_em, null);

    const ft001 = resProd.body.itens.find(i => i.codigo_ft === 'FT001');
    assert.equal(ft001.preco_venda, 129.9);
    assert.equal(ft001.canais.shopee.preco_venda, 134.5);
    assert.deepEqual(ft001.fotos, ['https://http2.mlstatic.com/foto1.jpg', 'https://http2.mlstatic.com/foto2.jpg']);
    assert.equal(ft001.medidas_embalagem.comprimento_cm, 30);
    assert.equal(ft001.medidas_embalagem.peso_kg, 0.85);
    assert.equal(ft001.medidas_embalagem.produto_sem_caixa_peso_kg, 0.6);

    // Custos e margens por canal com nome do material limpo (sem @meta)
    assert.equal(ft001.canais.meli.materiais[0].nome, 'Acrílico 3mm Cristal (20x30cm)');
    assert.equal(ft001.canais.meli.materiais[0].valor_rs, 18.5);
    assert.equal(ft001.canais.meli.custos_fixos_rs[0].nome, 'Envios');
    assert.equal(ft001.canais.meli.custos_percentuais[0].nome, 'Taxa ML');
    assert.equal(ft001.canais.meli.margem_minima_percentual, 10);
    assert.ok(ft001.canais.meli.preco_minimo > 0);
    assert.ok(Math.abs(ft001.canais.meli.margem_rs - (129.9 - (18.5 + 19.9 + 129.9 * 0.255))) < 0.05);

    const ft004 = resProd.body.itens.find(i => i.codigo_ft === 'FT004');
    assert.equal(ft004.canais.shopee, undefined, 'Canal marcado Não Vender na FT004 não deve sair');
    assert.equal(ft004.variacoes[0].sku_por_canal.shopee, undefined);
    assert.equal(ft004.medidas_embalagem.peso_kg, 0.85, 'Pesos digitados em gramas devem sair em kg');
    assert.equal(ft004.medidas_embalagem.produto_sem_caixa_peso_kg, 0.55);

    // FT003 (notForSale em todos overrides) deve retornar situacao="inativo" no GET /produtos/FT003
    const res003 = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/produtos/FT003',
        headers: { authorization: `Bearer ${rawKey}`, host: 'localhost:5173' },
        query: { route: 'produto', id: 'FT003' },
    }, res003, { client });
    assert.equal(res003.statusCode, 200);
    assert.equal(res003.body.produto.situacao, 'inativo');

    // Garante que domínios proibidos (fornecedor, cliente, pedido, usuário/senha, rankPrice, productionTime) NUNCA apareçam
    const serialized = JSON.stringify(resProd.body);
    for (const forbidden of ['@meta:', 'rankPrice', 'productionTime', 'fornecedor', 'cliente', 'pedido', 'senha', 'funcionario', 'password']) {
        assert.equal(serialized.includes(forbidden), false, `Campo/tag proibido vazou: ${forbidden}`);
    }
});

test('Paginação por cursor não pula nem repete fichas mesmo com limite pequeno', async () => {
    const items = [
        buildDeletedProduct({ id: 'a1', ft_code: 'FT1', name: 'A1', deleted_at: '2026-11-10T10:00:00.000Z' }),
        buildDeletedProduct({ id: 'a2', ft_code: 'FT2', name: 'A2', deleted_at: '2026-11-10T10:00:00.000Z' }),
        buildDeletedProduct({ id: 'a3', ft_code: 'FT3', name: 'A3', deleted_at: '2026-11-10T11:00:00.000Z' }),
        buildDeletedProduct({ id: 'a4', ft_code: 'FT4', name: 'A4', deleted_at: '2026-11-10T12:00:00.000Z' }),
        buildDeletedProduct({ id: 'a5', ft_code: 'FT5', name: 'A5', deleted_at: '2026-11-10T13:00:00.000Z' }),
    ];

    const collected = [];
    let cursor = null;
    do {
        const page = paginateCatalogItems(items, { cursor, limite: 2 });
        collected.push(...page.itens.map(i => i.id));
        cursor = page.proximo_cursor;
    } while (cursor);

    assert.deepEqual(collected, ['a1', 'a2', 'a3', 'a4', 'a5']);
});

test('Rate limit de 60 req/min retorna 429 com Retry-After ao exceder', async () => {
    const { rawKey, client } = buildTestEnvironment();
    const now = Date.now();
    client.store.settings[RATE_SETTING] = {
        'key-1': Array.from({ length: 60 }, (_, idx) => now - 10_000 + idx),
    };

    const res = createMockRes();
    await handlePartnerApiRequest({
        method: 'GET',
        url: '/api/parceiros/v1/saude',
        headers: { authorization: `Bearer ${rawKey}`, host: 'localhost:5173' },
        query: { route: 'saude' },
    }, res, { client });

    assert.equal(res.statusCode, 429);
    assert.ok(parseInt(res.headers['retry-after'], 10) >= 1);
});

test('Webhook assina HMAC-SHA256 corretamente, agrupa edições e agenda retentativas em falha', async () => {
    const secret = 'whsec_test_12345';
    const ts = '2026-11-11T14:00:00.000Z';
    const body = JSON.stringify({ evento: 'produto.alterado', produto_id: '111' });
    const sig = signWebhookPayload(body, secret, ts);

    assert.equal(verifyWebhookSignature(body, secret, ts, sig), true);
    assert.equal(verifyWebhookSignature(body + ' ', secret, ts, sig), false);
    assert.equal(verifyWebhookSignature(body, 'outro-segredo', ts, sig), false);

    const client = createMockSupabase({
        [WEBHOOK_CONFIG_SETTING]: {
            enabled: true,
            url: 'https://erp.ebureau.test/webhook',
            secret,
        },
    });

    const q1 = await enqueueWebhookEvent({ evento: 'produto.criado', produto_id: 'prod-1', ft_code: 'FT010' }, client);
    const q2 = await enqueueWebhookEvent({ evento: 'produto.alterado', produto_id: 'prod-1', ft_code: 'FT010' }, client);
    assert.equal(q1.id_evento, q2.id_evento, 'Edições rápidas na mesma ficha devem coalescer para um único evento');
    assert.equal(client.store.settings[WEBHOOK_OUTBOX_SETTING][0].evento, 'produto.criado');

    // Simula falha HTTP 500 -> deve incrementar attempts e agendar retry em 60s
    let firstAttemptHeaders = null;
    const mockFetchFail = async (_url, opts) => {
        firstAttemptHeaders = opts.headers;
        return new Response('Erro servidor', { status: 500 });
    };
    const procFail = await processWebhookOutbox(client, { forceImmediateId: q2.id_evento, fetchImpl: mockFetchFail });
    assert.equal(procFail.delivered, 0);
    assert.equal(procFail.remaining, 1);
    assert.equal(client.store.settings[WEBHOOK_OUTBOX_SETTING][0].attempts, 1);

    await new Promise(r => setTimeout(r, 15));

    // Simula sucesso HTTP 200 na próxima entrega verificando novo timestamp + assinatura recalculada
    let receivedHeaders = null;
    let receivedRaw = null;
    const mockFetchOk = async (_url, opts) => {
        receivedHeaders = opts.headers;
        receivedRaw = opts.body;
        return new Response('ok', { status: 200 });
    };
    const procOk = await processWebhookOutbox(client, { forceImmediateId: q2.id_evento, fetchImpl: mockFetchOk });
    assert.equal(procOk.delivered, 1);
    assert.equal(procOk.remaining, 0);
    assert.notEqual(
        receivedHeaders['X-Lume-Timestamp'],
        firstAttemptHeaders['X-Lume-Timestamp'],
        'Retentativa deve enviar um novo X-Lume-Timestamp'
    );
    assert.equal(
        verifyWebhookSignature(receivedRaw, secret, receivedHeaders['X-Lume-Timestamp'], receivedHeaders['X-Lume-Assinatura']),
        true
    );
    assert.ok(generateWebhookSecret().length >= 64, 'Segredo gerado deve ter ao menos 32 bytes em hex');
});

test('Conversão de pesos para kg e recálculo de material central sem alterar custos extras', () => {
    assert.equal(parseWeightToKg('850'), 0.85);
    assert.equal(parseWeightToKg('550'), 0.55);
    assert.equal(parseWeightToKg('1200'), 1.2);
    assert.equal(parseWeightToKg('0,85'), 0.85);
    assert.equal(parseWeightToKg('850g'), 0.85);
    assert.equal(parseWeightToKg('1,25 kg'), 1.25);

    const sheetItem = {
        name: 'Acrílico 2mm (50x50cm) @meta:id:55;t:sheet;x:50;y:50;p:100;pm2:50',
        value: 12.5,
    };
    const updated = recalculateMaterialItem(sheetItem, {
        id: 55,
        name: 'Acrílico 2mm Novo',
        type: 'sheet',
        width: 200,
        height: 100,
        price: 120,
        pricePerM2: 60,
    });
    assert.equal(updated.changed, true);
    assert.equal(updated.item.value, 15);
    assert.ok(updated.item.name.startsWith('Acrílico 2mm Novo (50x50cm) @meta:'));

    const unitOther = { name: 'Parafuso @meta:id:99;t:unit;q:2;p:1.5', value: 3 };
    assert.equal(recalculateMaterialItem(unitOther, { id: 55, price: 200 }).changed, false);
});
