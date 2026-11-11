import React, { useState } from 'react';
import { Package, Image as ImageIcon, Video, FileCheck, Plus, Trash2, ArrowUp, ArrowDown, Copy, Zap, Loader2 } from 'lucide-react';

const ORIGIN_OPTIONS = [
    { value: '0', label: '0 - Nacional' },
    { value: '1', label: '1 - Estrangeira (Imp. Direta)' },
    { value: '2', label: '2 - Estrangeira (Merc. Interno)' },
    { value: '3', label: '3 - Nacional (>40% imp.)' },
    { value: '4', label: '4 - Nacional (PPB)' },
    { value: '5', label: '5 - Nacional (<40% imp.)' },
    { value: '8', label: '8 - Nacional (>70% imp.)' },
];

const CSOSN_OPTIONS = [
    { value: '102', label: '102 - Tributada pelo Simples sem permissão de crédito' },
    { value: '101', label: '101 - Tributada pelo Simples com permissão de crédito' },
    { value: '103', label: '103 - Isenção do ICMS no Simples p/ faixa de receita' },
    { value: '300', label: '300 - Imune' },
    { value: '400', label: '400 - Não tributada pelo Simples Nacional' },
    { value: '500', label: '500 - ICMS cobrado anteriormente por ST' },
    { value: '900', label: '900 - Outros' },
];

const FtMarketplaceFieldsSection = ({
    form,
    setForm,
    currentMarketplace,
    platformLabel,
    readOnly = false,
    onPullFromMl,
    pullingMl = false,
    onReplicateAll,
    replicatingAll = false,
}) => {
    const [newPhotoUrl, setNewPhotoUrl] = useState('');
    const photos = Array.isArray(form.photos) ? form.photos : [];
    const hasVariations = Array.isArray(form.variations) && form.variations.length > 0;

    const handleAddPhoto = () => {
        const url = newPhotoUrl.trim();
        if (!url) return;
        const normalized = url.startsWith('http://') ? url.replace('http://', 'https://') : url;
        setForm(prev => ({
            ...prev,
            photos: [...(Array.isArray(prev.photos) ? prev.photos : []), normalized]
        }));
        setNewPhotoUrl('');
    };

    const handleRemovePhoto = (index) => {
        setForm(prev => ({
            ...prev,
            photos: (prev.photos || []).filter((_, i) => i !== index)
        }));
    };

    const handleMovePhoto = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= photos.length) return;
        const next = [...photos];
        [next[index], next[target]] = [next[target], next[index]];
        setForm(prev => ({ ...prev, photos: next }));
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 rounded-xl border border-indigo-200/80 space-y-4">
            {/* Cabeçalho da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                <div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={15} className="text-indigo-600" />
                        <span>Dados Comerciais, Mídia & Fiscal ({platformLabel})</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        Campos exclusivos de marketplace e parceiros (não alteram a Ficha Técnica Global).
                    </p>
                </div>
                {!readOnly && (
                    <div className="flex flex-wrap items-center gap-2">
                        {onPullFromMl && (
                            <button
                                type="button"
                                onClick={onPullFromMl}
                                disabled={pullingMl}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                                title="Buscar fotos, descrição, EAN, marca, categoria e estoque do anúncio vinculado no Mercado Livre"
                            >
                                {pullingMl ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                                <span>{pullingMl ? 'Puxando...' : 'Puxar do ML'}</span>
                            </button>
                        )}
                        {onReplicateAll && (
                            <button
                                type="button"
                                onClick={onReplicateAll}
                                disabled={replicatingAll}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                                title="Copiar Descrição, Marca, EAN, Categoria, Fotos, Vídeo, Fiscal e CEP para Shopee, TikTok, Amazon e Site (preserva preços e SKUs de cada canal)"
                            >
                                {replicatingAll ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                                <span>{replicatingAll ? 'Replicando...' : 'Replicar p/ outros canais'}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bloco 1: Identificação Comercial, Preço Promo e Estoque */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Título Comercial do Anúncio
                    </label>
                    <input
                        type="text"
                        value={form.marketplaceTitle || ''}
                        onChange={(e) => setForm({ ...form, marketplaceTitle: e.target.value })}
                        readOnly={readOnly}
                        placeholder={form.name || 'Nome comercial exibido no marketplace'}
                        className="w-full text-xs font-semibold text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Preço Promocional (R$)
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.promoPrice ?? ''}
                        onChange={(e) => setForm({ ...form, promoPrice: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        readOnly={readOnly}
                        placeholder="Opcional"
                        className="w-full text-xs font-bold text-emerald-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Estoque Disponível
                    </label>
                    {hasVariations ? (
                        <div className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 font-semibold">
                            Total variações: {(form.variations || []).reduce((acc, v) => acc + (Number(v.channelData?.[currentMarketplace]?.stock ?? v.stock) || 0), 0)} un
                        </div>
                    ) : (
                        <input
                            type="number"
                            min="0"
                            value={form.stock ?? ''}
                            onChange={(e) => setForm({ ...form, stock: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                            readOnly={readOnly}
                            placeholder="0"
                            className="w-full text-xs font-bold text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Marca</label>
                    <input
                        type="text"
                        value={form.brand ?? 'Lume Acrílicos'}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                        readOnly={readOnly}
                        placeholder="Lume Acrílicos"
                        className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">EAN / GTIN (Cód. Barras)</label>
                    <input
                        type="text"
                        value={form.ean || ''}
                        onChange={(e) => setForm({ ...form, ean: e.target.value })}
                        readOnly={readOnly}
                        placeholder="Ex: 7891234567890"
                        className="w-full text-xs font-mono text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Categoria / Linha</label>
                    <input
                        type="text"
                        value={form.category || ''}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        readOnly={readOnly}
                        placeholder="Ex: Casa e Decoração > Organizadores"
                        className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">CEP de Origem</label>
                    <input
                        type="text"
                        value={form.originCep ?? '13347-458'}
                        onChange={(e) => setForm({ ...form, originCep: e.target.value })}
                        readOnly={readOnly}
                        placeholder="13347-458"
                        className="w-full text-xs font-mono text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                </div>
            </div>

            {/* Bloco 2: Descrição */}
            <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Descrição Completa do Produto
                </label>
                <textarea
                    rows={4}
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    readOnly={readOnly}
                    placeholder="Descrição detalhada do produto para os anúncios (medidas, material, instruções, diferenciais)..."
                    className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-400 outline-none resize-y"
                />
            </div>

            {/* Bloco 3: Fiscal (Simples Nacional) */}
            <div className="bg-white/90 p-3 rounded-lg border border-gray-200/80 space-y-2">
                <h5 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck size={14} className="text-emerald-600" />
                    <span>Dados Fiscais (Simples Nacional)</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">NCM</label>
                        <input
                            type="text"
                            value={form.ncm || ''}
                            onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                            readOnly={readOnly}
                            placeholder="Ex: 39269090"
                            className="w-full text-xs font-mono text-gray-800 border border-gray-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">Origem da Mercadoria</label>
                        <select
                            value={form.origin ?? '0'}
                            onChange={(e) => setForm({ ...form, origin: e.target.value })}
                            disabled={readOnly}
                            className="w-full text-xs text-gray-800 border border-gray-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                        >
                            {ORIGIN_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">CEST (se houver)</label>
                        <input
                            type="text"
                            value={form.cest || ''}
                            onChange={(e) => setForm({ ...form, cest: e.target.value })}
                            readOnly={readOnly}
                            placeholder="Opcional"
                            className="w-full text-xs font-mono text-gray-800 border border-gray-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">CSOSN</label>
                        <select
                            value={form.csosn ?? '102'}
                            onChange={(e) => setForm({ ...form, csosn: e.target.value })}
                            disabled={readOnly}
                            className="w-full text-xs text-gray-800 border border-gray-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                        >
                            {CSOSN_OPTIONS.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bloco 4: Fotos e Vídeos */}
            <div className="bg-white/90 p-3 rounded-lg border border-gray-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-indigo-600" />
                        <span>Fotos (Links Públicos HTTPS) — {photos.length}</span>
                    </h5>
                    <span className="text-[10px] text-gray-400">A 1ª foto é a capa principal</span>
                </div>

                {!readOnly && (
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={newPhotoUrl}
                            onChange={(e) => setNewPhotoUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddPhoto();
                                }
                            }}
                            placeholder="Cole o link HTTPS da foto e clique em Adicionar"
                            className="flex-1 text-xs text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleAddPhoto}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                            <Plus size={13} />
                            <span>Adicionar</span>
                        </button>
                    </div>
                )}

                {photos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {photos.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                <img
                                    src={url}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-10 h-10 rounded object-cover border border-gray-200 bg-white shrink-0"
                                    onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${idx === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {idx === 0 ? '#1 Principal' : `#${idx + 1}`}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 truncate mt-0.5 font-mono" title={url}>{url}</p>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <button type="button" onClick={() => handleMovePhoto(idx, -1)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-indigo-600 disabled:opacity-30 cursor-pointer" title="Subir">
                                            <ArrowUp size={12} />
                                        </button>
                                        <button type="button" onClick={() => handleMovePhoto(idx, 1)} disabled={idx === photos.length - 1} className="p-1 text-gray-500 hover:text-indigo-600 disabled:opacity-30 cursor-pointer" title="Descer">
                                            <ArrowDown size={12} />
                                        </button>
                                        <button type="button" onClick={() => handleRemovePhoto(idx)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer" title="Remover">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-gray-400 italic">Nenhuma foto vinculada ainda (use "Puxar do ML" ou adicione links acima).</p>
                )}

                <div className="pt-1 border-t border-gray-100">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Video size={13} className="text-indigo-500" />
                        <span>Link de Vídeo (HTTPS, opcional)</span>
                    </label>
                    <input
                        type="url"
                        value={form.videoUrl || ''}
                        onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                        readOnly={readOnly}
                        placeholder="https://..."
                        className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default FtMarketplaceFieldsSection;
