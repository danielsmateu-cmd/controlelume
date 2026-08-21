const fs = require('fs');
let content = fs.readFileSync('src/services/mlApi.js', 'utf8');

const oldVarMap = `variations: item.variations && item.variations.length > 0 ? item.variations.map(v => ({
                id: v.id,
                stock: v.available_quantity,
                attributes: v.attribute_combinations ? v.attribute_combinations.map(a => a.value_name).join(' / ') : 'Variado'
            })) : null,`;

const newVarMap = `variations: item.variations && item.variations.length > 0 ? item.variations.map(v => ({
                id: v.id,
                stock: v.available_quantity,
                thumbnail: v.picture_ids && v.picture_ids.length > 0 ? \`https://http2.mlstatic.com/D_\${v.picture_ids[0]}-I.jpg\` : null,
                attributes: v.attribute_combinations ? v.attribute_combinations.map(a => a.value_name).join(' / ') : 'Variado'
            })) : null,`;

if (content.includes("item.variations.map(v => ({")) {
  content = content.replace(/variations: item\.variations[\s\S]*?\)\) : null,/, newVarMap);
  fs.writeFileSync('src/services/mlApi.js', content);
  console.log("Patched mlApi.js variations");
} else {
  console.log("Not found variations map");
}
