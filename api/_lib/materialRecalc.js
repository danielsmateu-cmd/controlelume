/**
 * Recalcula uma linha de material vinculada via tag @meta quando o preço/dimensão
 * do material central muda, preservando custos extras em R$ e % intactos.
 */
export function parseMetaMaterialName(encodedName) {
    if (!encodedName || typeof encodedName !== 'string') {
        return { displayName: '', isMeta: false, config: {} };
    }
    const idx = encodedName.indexOf(' @meta:');
    if (idx === -1) {
        return { displayName: encodedName.trim(), isMeta: false, config: {} };
    }

    const nameWithSuffix = encodedName.slice(0, idx);
    const metaStr = encodedName.slice(idx + ' @meta:'.length);
    const originalName = nameWithSuffix.replace(/\s\(\d+(\.\d+)?(x\d+(\.\d+)?)?(cm|un)\)$/, '').trim();

    const config = {};
    for (const pair of metaStr.split(';')) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) continue;
        const key = pair.slice(0, colonIdx);
        const val = pair.slice(colonIdx + 1);
        if (key === 'id') config.materialId = val;
        else if (key === 't') config.type = val;
        else if (key === 'x') config.x = parseFloat(val);
        else if (key === 'y') config.y = parseFloat(val);
        else if (key === 'l') config.length = parseFloat(val);
        else if (key === 'q') config.quantity = parseFloat(val);
        else if (key === 'p') config.price = parseFloat(val);
        else if (key === 'pm2') config.pricePerM2 = parseFloat(val);
    }

    return {
        displayName: nameWithSuffix.trim(),
        originalName,
        isMeta: true,
        config,
    };
}

export function cleanMaterialNameForPartner(rawName) {
    if (!rawName || typeof rawName !== 'string') return '';
    return rawName.split(' @meta:')[0].replace(/\s+/g, ' ').trim();
}

export function recalculateMaterialItem(item, updatedMaterial) {
    if (!item || !updatedMaterial || updatedMaterial.id === undefined || updatedMaterial.id === null) {
        return { item, changed: false };
    }
    const parsed = parseMetaMaterialName(item.name);
    if (!parsed.isMeta || String(parsed.config.materialId) !== String(updatedMaterial.id)) {
        return { item, changed: false };
    }

    const cfg = parsed.config;
    const matType = cfg.type || updatedMaterial.type || 'sheet';
    const baseName = (updatedMaterial.name || parsed.originalName || '').trim();
    const newPrice = Number(updatedMaterial.price) || 0;

    let newValue = Number(item.value) || 0;
    let newEncodedName = item.name;

    if (matType === 'unit' && Number.isFinite(cfg.quantity) && cfg.quantity > 0) {
        newValue = parseFloat((cfg.quantity * newPrice).toFixed(2));
        newEncodedName = `${baseName} (${cfg.quantity}un) @meta:id:${updatedMaterial.id};t:unit;q:${cfg.quantity};p:${newPrice}`;
    } else if (matType === 'linear' && Number.isFinite(cfg.length) && cfg.length > 0) {
        newValue = parseFloat(((cfg.length / 100) * newPrice).toFixed(2));
        newEncodedName = `${baseName} (${cfg.length}cm) @meta:id:${updatedMaterial.id};t:linear;l:${cfg.length};p:${newPrice}`;
    } else if (matType === 'sheet' && Number.isFinite(cfg.x) && cfg.x > 0 && Number.isFinite(cfg.y) && cfg.y > 0) {
        const w = Number(updatedMaterial.width) || 0;
        const h = Number(updatedMaterial.height) || 0;
        const pm2 = Number(updatedMaterial.pricePerM2 ?? updatedMaterial.price_per_m2)
            || (w > 0 && h > 0 ? newPrice / ((w * h) / 10000) : (cfg.pricePerM2 || 0));
        const areaM2 = (cfg.x * cfg.y) / 10000;
        newValue = parseFloat((areaM2 * pm2).toFixed(2));
        newEncodedName = `${baseName} (${cfg.x}x${cfg.y}cm) @meta:id:${updatedMaterial.id};t:sheet;x:${cfg.x};y:${cfg.y};p:${newPrice};pm2:${pm2}`;
    } else {
        return { item, changed: false };
    }

    const oldVal = parseFloat((Number(item.value) || 0).toFixed(2));
    const changed = newValue !== oldVal || newEncodedName !== item.name;
    if (!changed) return { item, changed: false };

    return {
        changed: true,
        item: {
            ...item,
            name: newEncodedName,
            value: newValue,
        },
    };
}
