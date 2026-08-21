const fs = require('fs');
let content = fs.readFileSync('src/services/mlApi.js', 'utf8');

const newFunc = `
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
            const data = await mlFetch(\`/orders/search?seller=\${tokens.ml_user_id}&order.status=paid&order.date_created.from=\${from}&order.date_created.to=\${to}&sort=date_desc&limit=\${limit}&offset=\${offset}\`);
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
`;

content = content.replace(/async getSalesHistory\(dateFrom, dateTo\) \{/, newFunc + '\n    async getSalesHistory(dateFrom, dateTo) {');

fs.writeFileSync('src/services/mlApi.js', content);
console.log("Added calculateSalesVelocity");
