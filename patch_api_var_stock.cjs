const fs = require('fs');
let content = fs.readFileSync('src/services/mlApi.js', 'utf8');

const newSave = `async saveListings(items) {
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
                        thumbnail: v.picture_ids && v.picture_ids.length > 0 ? \`https://http2.mlstatic.com/D_\${v.picture_ids[0]}-I.jpg\` : null,
                        attributes: v.attribute_combinations ? v.attribute_combinations.map(a => a.value_name).join(' / ') : 'Variado'
                    };
                }) : null,
                updated_at: new Date().toISOString(),
            };
        });
        const { error } = await supabase.from('marketplace_listings').upsert(rows, { onConflict: 'ml_item_id' });
        if (error) console.error('saveListings error:', error);
    },`;

content = content.replace(/async saveListings[\s\S]*?if \(error\) console\.error\('saveListings error:', error\);\n    \},/, newSave);

const updateMethod = `
    async updateVariationPhysicalStock(listingId, variationsArray) {
        const { error } = await supabase
            .from('marketplace_listings')
            .update({ variations: variationsArray, updated_at: new Date().toISOString() })
            .eq('id', listingId);
        return !error;
    },
`;

content = content.replace(/async updatePhysicalStock\(listingId, quantity\) \{/, updateMethod + '\n    async updatePhysicalStock(listingId, quantity) {');

fs.writeFileSync('src/services/mlApi.js', content);
console.log("Updated mlApi.js with variation stock logic");
