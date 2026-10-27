import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Barcode, Plus, Trash2, Copy, FileText, Download, 
  ExternalLink, RefreshCw, Check, AlertCircle, Layers, Tag, 
  Settings2, HelpCircle, ArrowRight, Sparkles, X, ChevronDown, ChevronUp
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import clsx from 'clsx';

// ==========================================
// FUNÇÕES AUXILIARES DE PARSER DE CÓDIGO ZPL
// ==========================================

// Decodificar caracteres hexadecimais no formato ZPL (^FH com _XX em UTF-8)
export const decodeZplHex = (str) => {
  if (!str) return '';
  return str.replace(/(?:_[0-9A-Fa-f]{2})+/g, (match) => {
    try {
      const hexPairs = match.split('_').filter(Boolean);
      const bytes = new Uint8Array(hexPairs.map(h => parseInt(h, 16)));
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      return match;
    }
  }).trim();
};

// Analisar ZPL nativo e extrair etiquetas individuais estruturadas
export const parseZplToLabels = (zplText) => {
  if (!zplText) return { labels: [], detectedModel: '110x25', totalLabelsCount: 0 };

  const blocks = zplText.match(/\^XA[\s\S]*?\^XZ/gi) || [];
  if (blocks.length === 0) {
    return { labels: [], detectedModel: '110x25', totalLabelsCount: 0 };
  }

  let maxY = 0;
  let hasTwoColumns = false;
  const rawLabels = [];

  for (const block of blocks) {
    const fieldRegex = /\^FO(\d+),(\d+)([\s\S]*?)\^FD([\s\S]*?)\^FS/gi;
    let match;
    const fields = [];

    while ((match = fieldRegex.exec(block)) !== null) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      if (y > maxY) maxY = y;
      if (x >= 350) hasTwoColumns = true;

      const cmd = match[3];
      const rawData = match[4];
      const data = decodeZplHex(rawData);
      const isBarcode = cmd.includes('^BC') || cmd.includes('^BY') || cmd.includes('^B3');

      fields.push({ x, y, cmd, data, isBarcode });
    }

    const leftFields = fields.filter(f => f.x < 350);
    const rightFields = fields.filter(f => f.x >= 350);

    const processFieldGroup = (colFields) => {
      if (!colFields || colFields.length === 0) return null;

      let code = '';
      let title = '';
      let variation = '';
      let sku = '';

      // 1. Procurar código de barras
      for (const f of colFields) {
        if (f.isBarcode || (!code && /^[A-Z0-9]{5,20}$/i.test(f.data) && !f.data.toUpperCase().startsWith('SKU:'))) {
          if (f.data && f.data.length >= 4) {
            code = f.data;
          }
        }
      }

      // 2. Procurar SKU
      for (const f of colFields) {
        if (/^SKU:/i.test(f.data)) {
          sku = f.data.replace(/^SKU:\s*/i, '').trim();
        }
      }

      // 3. Procurar Título e Variação
      for (const f of colFields) {
        const text = f.data.trim();
        if (!text || text === code || /^SKU:/i.test(text)) continue;

        if (text.length > 18 && !title) {
          title = text;
        } else if (text.length <= 18 && !variation) {
          variation = text;
        } else if (!title) {
          title = text;
        }
      }

      if (!title && colFields.length > 0) {
        const validTexts = colFields
          .map(f => f.data.trim())
          .filter(t => t && t !== code && !/^SKU:/i.test(t));
        if (validTexts.length > 0) {
          title = validTexts.reduce((a, b) => (a.length >= b.length ? a : b));
        }
      }

      if (code || title) {
        let fullTitle = title || `Produto ${code}`;
        if (variation && !fullTitle.includes(variation)) {
          fullTitle = `${fullTitle} - ${variation}`;
        }
        return {
          code: code || sku || 'PROD',
          title: fullTitle,
          sku: sku || ''
        };
      }
      return null;
    };

    if (hasTwoColumns || (leftFields.length > 0 && rightFields.length > 0)) {
      const left = processFieldGroup(leftFields);
      if (left) rawLabels.push(left);

      const right = processFieldGroup(rightFields);
      if (right) rawLabels.push(right);
    } else {
      const single = processFieldGroup(fields);
      if (single) rawLabels.push(single);
    }
  }

  // Se a altura Y máxima for maior que 400 dots (~50mm), é etiqueta alta (100x150 mm)
  const detectedModel = maxY > 400 ? '100x150' : '110x25';
  const totalLabelsCount = rawLabels.length;

  // Agrupar produtos idênticos para somar as quantidades
  const aggregatedMap = new Map();
  for (const item of rawLabels) {
    const key = `${item.code}___${item.sku}___${item.title}`;
    if (aggregatedMap.has(key)) {
      aggregatedMap.get(key).quantity += 1;
    } else {
      aggregatedMap.set(key, {
        id: 'zpl-' + Math.random().toString(36).substr(2, 9),
        code: item.code,
        title: item.title,
        sku: item.sku,
        quantity: 1
      });
    }
  }

  return {
    labels: Array.from(aggregatedMap.values()),
    detectedModel,
    totalLabelsCount
  };
};

export default function Etiquetas() {
  // Modelo da etiqueta: '110x25' (2 colunas de 50x25mm) ou '100x150' (1 coluna de 100x150mm)
  const [model, setModel] = useState('110x25');

  // Campo de texto para colar códigos do Mercado Livre
  const [pastedCode, setPastedCode] = useState('');
  const [detectedType, setDetectedType] = useState(null); // 'zpl' | 'codes' | null
  const [zplError, setZplError] = useState(null);

  // Lista de etiquetas adicionadas para impressão
  const [labels, setLabels] = useState([
    {
      id: '1',
      title: 'Porta Fotos - Diplomas Quadro De Parede Em Acrílico 33x42cm',
      sku: 'ft24',
      code: 'KUVJ26590',
      quantity: 4
    },
    {
      id: '2',
      title: 'Caixa de Acrílico 15x15x15 Cristal',
      sku: 'CX-15X15-CR',
      code: 'ADJA34480',
      quantity: 2
    }
  ]);

  // Formulário de adição manual rápida
  const [manualTitle, setManualTitle] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualQty, setManualQty] = useState(1);

  // Configurações avançadas do rolo térmico (ajustadas conforme o padrão exato do Mercado Livre)
  const [showSettings, setShowSettings] = useState(false);
  const [config110x25, setConfig110x25] = useState({
    rollWidth: 110,     // Largura total do rolo em mm
    rollHeight: 25,     // Altura de cada passo em mm
    labelWidth: 50,     // Largura de cada etiqueta individual em mm
    labelHeight: 21,    // Altura útil de impressão em mm
    barcodeWidth: 34,   // Largura contida do código de barras em mm (Padrão Labelary / ML)
    barcodeHeight: 6.2, // Altura das barras em mm
    marginLeft: 3,      // Margem esquerda em mm
    gap: 4,             // Espaçamento entre as duas colunas em mm
    marginTop: 1.2,     // Margem superior em mm
    fontSizeTitle: 7.2, // pt (título do produto)
    fontSizeSku: 8.5,   // pt (SKU aumentado para destaque na produção)
    fontSizeCode: 8.5   // pt (código legível centralizado abaixo do código de barras)
  });

  const [config100x150, setConfig100x150] = useState({
    width: 100,         // mm
    height: 150,        // mm
    margin: 5           // mm
  });

  // Estado de geração de PDF / Impressão
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Cache de códigos de barras renderizados (DataURL)
  const [barcodeCache, setBarcodeCache] = useState({});

  // Helper para gerar o DataURL do código de barras usando JsBarcode (Apenas barras, sem texto embutido)
  const getBarcodeDataUrl = (codeText) => {
    if (!codeText) return null;
    const clean = String(codeText).trim();
    if (barcodeCache[clean]) return barcodeCache[clean];

    try {
      const canvas = document.createElement('canvas');
      // Gerar apenas as barras com máxima nitidez (displayValue: false)
      JsBarcode(canvas, clean, {
        format: 'CODE128',
        width: 2,
        height: 44,
        displayValue: false,
        margin: 0
      });
      const dataUrl = canvas.toDataURL('image/png');
      setBarcodeCache(prev => ({ ...prev, [clean]: dataUrl }));
      return dataUrl;
    } catch (err) {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, clean, {
          width: 2,
          height: 44,
          displayValue: false,
          margin: 0
        });
        const dataUrl = canvas.toDataURL('image/png');
        setBarcodeCache(prev => ({ ...prev, [clean]: dataUrl }));
        return dataUrl;
      } catch (e2) {
        return null;
      }
    }
  };

  // Atualizar cache de códigos de barras quando a lista mudar
  useEffect(() => {
    labels.forEach(item => {
      if (item.code && !barcodeCache[item.code]) {
        getBarcodeDataUrl(item.code);
      }
    });
  }, [labels]);

  // Identificar automaticamente o tipo de código colado
  useEffect(() => {
    const trimmed = pastedCode.trim();
    if (!trimmed) {
      setDetectedType(null);
      setZplError(null);
      return;
    }

    if (trimmed.includes('^XA') && trimmed.includes('^XZ')) {
      setDetectedType('zpl');
      setZplError(null);
    } else {
      setDetectedType('codes');
      setZplError(null);
    }
  }, [pastedCode]);

  // Quantidade de blocos ZPL detectados no texto colado
  const zplBlocksCount = pastedCode.includes('^XA') ? (pastedCode.match(/\^XA/gi) || []).length : 0;

  // Processar texto colado (ZPL ou lista de códigos/SKUs)
  const processPastedText = () => {
    const text = pastedCode.trim();
    if (!text) return;

    // 1. Processar ZPL localmente
    if (detectedType === 'zpl') {
      const { labels: parsedLabels, detectedModel, totalLabelsCount } = parseZplToLabels(text);

      if (parsedLabels.length > 0) {
        // Pré-aquecer cache dos códigos de barras gerados
        parsedLabels.forEach(p => {
          if (p.code) getBarcodeDataUrl(p.code);
        });

        if (detectedModel && detectedModel !== model) {
          setModel(detectedModel);
        }

        // Se a lista só tem os dois itens iniciais fictícios, substitui diretamente
        const isDefaultOnly = labels.length <= 2 && (labels[0]?.id === '1' || labels[0]?.id === '2');
        if (isDefaultOnly) {
          setLabels(parsedLabels);
        } else {
          setLabels(prev => [...prev, ...parsedLabels]);
        }

        setPastedCode('');
        setDetectedType(null);
        setZplError(null);
        alert(`✅ Sucesso! ${totalLabelsCount} etiqueta(s) importada(s) do ZPL (${parsedLabels.length} produto(s) agrupado(s)).\n\nAgora você pode clicar em "Imprimir Direto na Térmica" ou "Baixar PDF".`);
        return;
      } else {
        setZplError('Não foi possível extrair dados válidos do código ZPL. Verifique se o código possui blocos ^XA ... ^XZ.');
        return;
      }
    }

    // 2. Processar texto linha por linha (códigos simples ou delimitados)
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    const newItems = [];

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();

      // Formato com separadores: SKU | Titulo | Codigo | Qtd
      if (cleanLine.includes('|') || cleanLine.includes(';') || cleanLine.includes('\t')) {
        const sep = cleanLine.includes('|') ? '|' : cleanLine.includes(';') ? ';' : '\t';
        const parts = cleanLine.split(sep).map(p => p.trim());

        let title = parts[0] || `Produto ${idx + 1}`;
        let sku = parts[1] || '';
        let code = parts[2] || parts[0];
        let quantity = parseInt(parts[3], 10) || 1;

        if (/^\d{8,14}$/.test(parts[0]) || /^MLBU/i.test(parts[0])) {
          code = parts[0];
          title = parts[1] || `Produto ${parts[0]}`;
          sku = parts[2] || '';
        }

        newItems.push({
          id: 'pasted-' + Date.now() + '-' + idx,
          title,
          sku,
          code,
          quantity: quantity > 0 ? quantity : 1
        });
      } else {
        const barcodeMatch = cleanLine.match(/\b(\d{8,14}|[A-Z]{3,}\d{4,}|\w+)\b/i);
        const code = barcodeMatch ? barcodeMatch[0] : cleanLine;
        const title = cleanLine !== code ? cleanLine.replace(code, '').trim() : `Produto ${code}`;

        newItems.push({
          id: 'pasted-' + Date.now() + '-' + idx,
          title: title || `Produto ${code}`,
          sku: code,
          code: code,
          quantity: 1
        });
      }
    });

    if (newItems.length > 0) {
      newItems.forEach(item => {
        if (item.code) getBarcodeDataUrl(item.code);
      });

      const isDefaultOnly = labels.length <= 2 && (labels[0]?.id === '1' || labels[0]?.id === '2');
      if (isDefaultOnly) {
        setLabels(newItems);
      } else {
        setLabels(prev => [...prev, ...newItems]);
      }

      setPastedCode('');
      setDetectedType(null);
      alert(`${newItems.length} etiqueta(s) adicionada(s) à lista com sucesso!`);
    } else {
      alert('Nenhum código reconhecido no texto informado.');
    }
  };

  // Baixar código ZPL puro como arquivo .zpl
  const handleDownloadZpl = () => {
    if (!pastedCode.trim()) return;
    const blob = new Blob([pastedCode.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiquetas_${model}_${new Date().toISOString().slice(0, 10)}.zpl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copiar ZPL para a área de transferência
  const handleCopyZpl = async () => {
    if (!pastedCode.trim()) return;
    try {
      await navigator.clipboard.writeText(pastedCode.trim());
      alert('Código ZPL copiado para a área de transferência!');
    } catch (e) {
      alert('Falha ao copiar.');
    }
  };

  // Adicionar item manualmente
  const handleAddManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim() && !manualTitle.trim()) {
      alert('Preencha ao menos o código de barras ou o título do produto.');
      return;
    }

    const code = manualCode.trim() || manualSku.trim() || '789' + Date.now().toString().slice(-10);
    const newItem = {
      id: 'manual-' + Date.now(),
      title: manualTitle.trim() || `Produto ${code}`,
      sku: manualSku.trim() || code,
      code: code,
      quantity: Number(manualQty) > 0 ? Number(manualQty) : 1
    };

    getBarcodeDataUrl(newItem.code);
    setLabels(prev => [...prev, newItem]);
    setManualTitle('');
    setManualSku('');
    setManualCode('');
    setManualQty(1);
  };

  // Remover item da lista
  const handleRemoveLabel = (id) => {
    setLabels(prev => prev.filter(l => l.id !== id));
  };

  // Atualizar quantidade de um item
  const handleUpdateQty = (id, delta) => {
    setLabels(prev => prev.map(l => {
      if (l.id === id) {
        const next = l.quantity + delta;
        return next > 0 ? { ...l, quantity: next } : l;
      }
      return l;
    }));
  };

  // Limpar lista inteira
  const handleClearAll = () => {
    if (labels.length === 0) return;
    if (confirm('Tem certeza que deseja limpar todas as etiquetas da lista?')) {
      setLabels([]);
    }
  };

  // Quantidade total de etiquetas individuais
  const totalLabelUnits = labels.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);

  // Total de páginas no modelo 110x25 (cada página tem 2 colunas)
  const totalPages110x25 = Math.ceil(totalLabelUnits / 2);

  // ==========================================
  // GERAÇÃO DE PDF PERSONALIZADO MILIMÉTRICO
  // ==========================================
  const generatePdfBlob = async () => {
    if (labels.length === 0) {
      alert('Adicione ao menos uma etiqueta para gerar o PDF.');
      return null;
    }

    // Expandir lista de etiquetas de acordo com a quantidade (filtrando nulos ou vazios)
    const expandedList = [];
    labels.forEach(item => {
      if (!item || (!item.code && !item.title && !item.sku)) return;
      const q = Number(item.quantity) || 1;
      for (let i = 0; i < q; i++) {
        expandedList.push(item);
      }
    });

    if (expandedList.length === 0) {
      alert('Nenhuma etiqueta válida encontrada para gerar a impressão.');
      return null;
    }

    if (model === '110x25') {
      // ----------------------------------------------------
      // MODELO 110 x 25 mm (2 colunas de 50x25mm cada)
      // ----------------------------------------------------
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [config110x25.rollWidth, config110x25.rollHeight] // [110, 25]
      });

      const { marginLeft, gap, labelWidth, labelHeight, marginTop } = config110x25;
      const totalPairs = Math.ceil(expandedList.length / 2);
      let pageCount = 0;

      for (let pageIdx = 0; pageIdx < totalPairs; pageIdx++) {
        const leftItem = expandedList[pageIdx * 2];
        const rightItem = expandedList[pageIdx * 2 + 1] || null;

        // Garantir que pares completamente vazios nunca gerem uma página em branco
        if (!leftItem && !rightItem) continue;

        if (pageCount > 0) {
          doc.addPage([config110x25.rollWidth, config110x25.rollHeight], 'landscape');
        }
        pageCount++;

        // Renderizar Coluna Esquerda
        if (leftItem) {
          const xLeft = marginLeft;
          const yLeft = marginTop;
          renderSingleLabel50x25(doc, leftItem, xLeft, yLeft, labelWidth, labelHeight, config110x25);
        }

        // Renderizar Coluna Direita
        if (rightItem) {
          const xRight = marginLeft + labelWidth + gap;
          const yRight = marginTop;
          renderSingleLabel50x25(doc, rightItem, xRight, yRight, labelWidth, labelHeight, config110x25);
        }
      }

      return doc.output('blob');
    } else {
      // ----------------------------------------------------
      // MODELO 100 x 150 mm (1 coluna de 100x150mm)
      // ----------------------------------------------------
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150]
      });

      for (let idx = 0; idx < expandedList.length; idx++) {
        if (idx > 0) {
          doc.addPage([100, 150], 'portrait');
        }

        const item = expandedList[idx];
        renderSingleLabel100x150(doc, item, idx + 1, expandedList.length);
      }

      return doc.output('blob');
    }
  };

  // Renderizar 1 etiqueta individual de 50x25 mm dentro do PDF (Padrão Idêntico ao Labelary / ML)
  const renderSingleLabel50x25 = (doc, item, x, y, width, height, cfg) => {
    const { barcodeWidth, barcodeHeight, fontSizeTitle, fontSizeSku, fontSizeCode } = cfg;
    
    // 1. Código de barras com largura contida (34 mm por padrão) e centralizado na etiqueta de 50 mm
    const bWidth = barcodeWidth || 34;
    const bHeight = barcodeHeight || 6.2;
    const barcodeX = x + (width - bWidth) / 2;
    const barcodeY = y + 0.8;

    const barcodeDataUrl = getBarcodeDataUrl(item.code);
    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, bWidth, bHeight);
    } else {
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.text(`* ${item.code} *`, x + width / 2, y + 5, { align: 'center' });
    }

    // 2. Texto do Código Legível (Entre o código de barras e o título)
    // Vetorial, nítido, em negrito e bem legível (sem pixelização de imagem)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSizeCode || 8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(String(item.code || '').trim(), x + width / 2, y + 9.8, { align: 'center' });

    // 3. Título do Produto (mais legível, 1 ou 2 linhas)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSizeTitle || 7.2);
    doc.setTextColor(0, 0, 0);

    const titleLines = doc.splitTextToSize(item.title || 'Produto sem título', width - 4);
    const displayedLines = titleLines.slice(0, 2);

    if (displayedLines.length === 1) {
      doc.text(displayedLines[0], x + 2, y + 14.0);
    } else {
      doc.text(displayedLines[0], x + 2, y + 13.0);
      doc.text(displayedLines[1], x + 2, y + 15.8);
    }

    // 4. SKU em Destaque Aumentado (para facilitar na linha de produção e sem cortar no rodapé)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSizeSku || 8.5);
    doc.setTextColor(0, 0, 0);

    const skuText = item.sku ? `SKU: ${item.sku}` : (item.code ? `SKU: ${item.code}` : '');
    if (skuText) {
      doc.text(skuText, x + 2, y + 20.0);
    }
  };

  // Renderizar 1 etiqueta de 100x150 mm (Padrão Transporte / Despacho)
  const renderSingleLabel100x150 = (doc, item, currentIdx, total) => {
    // Borda Externa elegante
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.8);
    doc.rect(4, 4, 92, 142);

    // Cabeçalho da Etiqueta
    doc.setFillColor(245, 245, 245);
    doc.rect(4.5, 4.5, 91, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text('LUME • IDENTIFICAÇÃO E ENVIO', 50, 13, { align: 'center' });

    // Linha divisória
    doc.line(4, 18.5, 96, 18.5);

    // Código de Barras Grande Principal (Centralizado)
    const barcodeDataUrl = getBarcodeDataUrl(item.code);
    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, 'PNG', 15, 24, 70, 26);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(String(item.code || '').trim(), 50, 54, { align: 'center' });
    }

    // Linha divisória
    doc.line(4, 60, 96, 60);

    // Detalhes do Produto / Pacote
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('DESCRIÇÃO DO PRODUTO / CONTEÚDO:', 8, 68);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(item.title || 'Produto sem descrição', 84);
    doc.text(titleLines.slice(0, 3), 8, 75);

    // Box de SKU e Referência
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(8, 95, 84, 18, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(8, 95, 84, 18, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('SKU / CÓDIGO DO VENDEDOR', 12, 101);

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(item.sku || item.code, 12, 108);

    // Rodapé / Paginação
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Volume ${currentIdx} de ${total} • Gerado via Controle Lume`, 50, 138, { align: 'center' });
    doc.text(new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 50, 142, { align: 'center' });
  };

  // Ação: Baixar PDF gerado
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) return;

      const filename = `etiquetas_${model}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
      alert('Erro ao gerar o arquivo PDF das etiquetas.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Ação: Abrir PDF em nova aba para visualização
  const handleOpenPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF:', err);
      alert('Erro ao gerar o PDF para visualização.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Ação: Imprimir Direto (abre janela de impressão com buffer seguro para lotes grandes)
  const handleDirectPrint = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) return;

      const blobUrl = URL.createObjectURL(blob);
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = blobUrl;

      document.body.appendChild(printIframe);

      printIframe.onload = () => {
        // Lotes grandes (ex: 252 etiquetas = 126 páginas) exigem tempo para o PDFium
        // decodificar e renderizar todos os canvases no navegador antes de abrir o print().
        // Chamar com apenas 300ms fazia páginas não renderizadas saírem em branco na térmica!
        const totalItems = labels.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
        const bufferDelay = Math.min(2500, Math.max(600, totalItems * 8));

        setTimeout(() => {
          try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
          } catch (e) {
            window.open(blobUrl, '_blank');
          } finally {
            // Limpar iframe e liberar memória após 1 minuto
            setTimeout(() => {
              try {
                if (printIframe.parentNode) {
                  printIframe.parentNode.removeChild(printIframe);
                }
              } catch (e2) {}
              URL.revokeObjectURL(blobUrl);
            }, 60000);
          }
        }, bufferDelay);
      };
    } catch (err) {
      console.error('Erro na impressão direta:', err);
      alert('Erro ao iniciar a impressão direta.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1550px] mx-auto space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
            <Barcode size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Gerador de Etiquetas Térmicas
              <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                100% Nativo & Offline
              </span>
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              Cole códigos do Mercado Livre (ZPL / Barras / SKU) ou crie suas etiquetas de produto e envio para impressão direta.
            </p>
          </div>
        </div>

        {/* Seletor de Modelo de Etiqueta */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200/80">
          <button
            type="button"
            onClick={() => setModel('110x25')}
            className={clsx(
              'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm',
              model === '110x25'
                ? 'bg-white text-indigo-600 shadow-md border border-gray-100'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Tag size={16} className={model === '110x25' ? 'text-indigo-600' : 'text-gray-400'} />
            <div className="text-left">
              <div className="leading-tight font-extrabold">110 x 25 mm</div>
              <div className="text-[10px] font-normal text-gray-500">2 Colunas (50x25) • Produto</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModel('100x150')}
            className={clsx(
              'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm',
              model === '100x150'
                ? 'bg-white text-indigo-600 shadow-md border border-gray-100'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Layers size={16} className={model === '100x150' ? 'text-indigo-600' : 'text-gray-400'} />
            <div className="text-left">
              <div className="leading-tight font-extrabold">100 x 150 mm</div>
              <div className="text-[10px] font-normal text-gray-500">1 Coluna • Transporte / ML</div>
            </div>
          </button>
        </div>
      </div>

      {/* Grid Principal: Entrada de Dados & Prévia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= COLUNA ESQUERDA: ENTRADA DE CÓDIGOS E ITENS (7 colunas) ================= */}
        <div className="lg:col-span-7 space-y-6">

          {/* Card 1: Colar Código do Mercado Livre */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  ML
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Colar Código do Mercado Livre</h3>
                  <p className="text-[11px] text-gray-500">Cole o código ZPL (^XA...) ou lista copiada de produtos / códigos</p>
                </div>
              </div>

              {detectedType === 'zpl' && (
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-200">
                  <Sparkles size={13} />
                  Código ZPL ({zplBlocksCount} bloco{zplBlocksCount > 1 ? 's' : ''})
                </span>
              )}
            </div>

            <div className="p-5 space-y-3">
              <textarea
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder={`Cole aqui o código gerado pelo Mercado Livre...\n\nExemplos aceitos:\n- Código ZPL térmico: ^XA^FO65,18^BCN...^FS^XZ\n- Código de barras simples: 7898901234567\n- Código MLBU do Full: MLBU10928374\n- Lista de produtos (uma por linha): SKU | Título | Código | Quantidade`}
                rows={5}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPastedCode('')}
                    disabled={!pastedCode}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                  >
                    Limpar
                  </button>

                  {detectedType === 'zpl' && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadZpl}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-200 rounded-lg flex items-center gap-1 transition-all"
                        title="Baixar arquivo .zpl bruto"
                      >
                        <Download size={13} />
                        Baixar .ZPL
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyZpl}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 transition-all"
                        title="Copiar código ZPL"
                      >
                        <Copy size={13} />
                        Copiar
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={processPastedText}
                  disabled={!pastedCode.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {detectedType === 'zpl' ? (
                    <>
                      <Sparkles size={14} />
                      Importar {zplBlocksCount > 0 ? (zplBlocksCount * 2) + ' ' : ''}Etiquetas do ZPL
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      Carregar Etiquetas da Lista
                    </>
                  )}
                </button>
              </div>

              {zplError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  <span>{zplError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Adição Manual Rápida */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Plus size={16} className="text-indigo-600" />
                Adicionar Etiqueta Manualmente
              </h3>
              <span className="text-[11px] text-gray-400">Preencha e adicione à fila de impressão</span>
            </div>

            <form onSubmit={handleAddManual} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Título do Produto / Descrição</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ex: Caixa Acrílico 15x15x15 cm Cristal"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">SKU / Variação</label>
                  <input
                    type="text"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    placeholder="Ex: CX-15X15-CR"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Código de Barras / EAN / MLBU</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: 7898901234567 ou KUVJ26590"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={manualQty}
                    onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  Adicionar à Fila
                </button>
              </div>
            </form>
          </div>

          {/* Card 3: Lista de Etiquetas na Fila */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-sm">Etiquetas na Fila de Impressão</h3>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-full">
                  {totalLabelUnits} {totalLabelUnits === 1 ? 'etiqueta' : 'etiquetas'}
                </span>
                {model === '110x25' && (
                  <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                    ({totalPages110x25} passos/páginas do rolo)
                  </span>
                )}
              </div>

              {labels.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  Limpar Fila
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {labels.length === 0 ? (
                <div className="p-8 text-center text-gray-400 space-y-2">
                  <Barcode size={32} className="mx-auto text-gray-300 stroke-1" />
                  <p className="text-xs">Nenhuma etiqueta na fila.</p>
                  <p className="text-[11px] text-gray-400">Cole um código ZPL ou adicione produtos acima para imprimir.</p>
                </div>
              ) : (
                labels.map((item, index) => (
                  <div key={item.id || index} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate" title={item.title}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-mono">
                          {item.sku && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">SKU: {item.sku}</span>}
                          <span>Código: {item.code}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-1 text-xs font-extrabold text-gray-900 min-w-[28px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ================= COLUNA DIREITA: PRÉVIA E IMPRESSÃO (5 colunas) ================= */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          
          {/* Card de Ações de Impressão Direta */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-900 text-sm">Impressão Térmica</h3>
                <p className="text-[11px] text-gray-500">
                  Modelo: <strong className="text-indigo-600">{model === '110x25' ? '110 x 25 mm (2 Colunas)' : '100 x 150 mm (1 Coluna)'}</strong>
                </p>
              </div>

              <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full border border-green-200">
                Pronto p/ Imprimir
              </span>
            </div>

            {/* Botão de Impressão Direta na Impressora Térmica */}
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isGeneratingPdf || labels.length === 0}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.01] cursor-pointer"
            >
              {isGeneratingPdf ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Gerando Impressão...
                </>
              ) : (
                <>
                  <Printer size={20} />
                  IMPRIMIR DIRETO NA TÉRMICA
                </>
              )}
            </button>

            {/* Ações secundárias de PDF */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || labels.length === 0}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Download size={14} className="text-gray-500" />
                Baixar PDF
              </button>

              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={isGeneratingPdf || labels.length === 0}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ExternalLink size={14} className="text-gray-500" />
                Abrir em Nova Aba
              </button>
            </div>
          </div>

          {/* Configurações Avançadas do Rolo (Colapsável) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Settings2 size={15} className="text-indigo-600" />
                Ajustes Finos de Medidas e Fontes
              </span>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSettings && (
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-3 text-xs">
                {model === '110x25' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Largura das Barras (mm)</label>
                        <input
                          type="number"
                          step="1"
                          value={config110x25.barcodeWidth}
                          onChange={(e) => setConfig110x25(c => ({ ...c, barcodeWidth: parseFloat(e.target.value) || 34 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Tamanho Fonte SKU (pt)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.fontSizeSku}
                          onChange={(e) => setConfig110x25(c => ({ ...c, fontSizeSku: parseFloat(e.target.value) || 8.5 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Tamanho Código Central (pt)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.fontSizeCode}
                          onChange={(e) => setConfig110x25(c => ({ ...c, fontSizeCode: parseFloat(e.target.value) || 8.5 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Tamanho Título (pt)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.fontSizeTitle}
                          onChange={(e) => setConfig110x25(c => ({ ...c, fontSizeTitle: parseFloat(e.target.value) || 7.2 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Altura / Passo do Rolo (mm)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.rollHeight}
                          onChange={(e) => setConfig110x25(c => ({ ...c, rollHeight: parseFloat(e.target.value) || 25 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                          title="Padrão 25mm. Ajuste se sua impressora exigir o passo com GAP (ex: 28mm)"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Margem Superior (mm)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.marginTop}
                          onChange={(e) => setConfig110x25(c => ({ ...c, marginTop: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Margem Esquerda (mm)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.marginLeft}
                          onChange={(e) => setConfig110x25(c => ({ ...c, marginLeft: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Espaço Central / Gap (mm)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={config110x25.gap}
                          onChange={(e) => setConfig110x25(c => ({ ...c, gap: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Margem de Impressão (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={config100x150.margin}
                      onChange={(e) => setConfig100x150(c => ({ ...c, margin: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card de Dicas de Impressão Sem Falhas na Térmica */}
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs space-y-2 text-amber-950 shadow-2xs">
            <div className="flex items-center gap-2 font-black text-amber-900 text-xs">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
              <span>Como Evitar Etiquetas em Branco na Impressora Térmica:</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-amber-900/90 pl-5 list-disc leading-relaxed">
              <li>
                <strong>Calibração de GAP (Passo):</strong> Se a impressora pulou etiquetas no meio do lote, o sensor óptico da máquina perdeu o alinhamento com o corte do papel. <em>Pressione e segure o botão FEED da impressora até a luz piscar para ela reconhecer a altura exata da etiqueta e do GAP.</em>
              </li>
              <li>
                <strong>Margens na Janela de Impressão:</strong> Na tela de impressão do Chrome/Edge, mude <strong>Margens</strong> de "Padrão" para <strong>"Nenhuma"</strong>. Margens padrão do navegador ultrapassam a altura de 25mm e fazem o driver avançar etiquetas em branco.
              </li>
              <li>
                <strong>Escala:</strong> Deixe sempre em <strong>"Padrão" (100%)</strong> ou Tamanho Real (nunca "Ajustar à página").
              </li>
              <li>
                <strong>Lotes Grandes (+50 etiquetas):</strong> Se preferir, clique em <strong>"Abrir em Nova Aba"</strong> ou <strong>"Baixar PDF"</strong> para imprimir direto com todas as páginas 100% cacheadas.
              </li>
            </ul>
          </div>

          {/* Pré-visualização da Etiqueta em Escala */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-600" />
                Pré-visualização do Rolo Térmico
              </h3>
              <span className="text-[10px] text-gray-400">Escala visual aproximada</span>
            </div>

            {model === '110x25' ? (
              /* Preview 110 x 25 mm (2 Colunas no formato padrão ML) */
              <div className="bg-gray-100 rounded-xl p-3 border border-gray-200 space-y-2">
                <div className="text-[10px] text-gray-500 font-bold text-center">
                  Passo 1 do Rolo (Largura 110mm x Altura 25mm)
                </div>

                {/* Simulação física do rolo de 2 colunas com bordas tracejadas */}
                <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-2.5 flex items-center justify-center gap-2 shadow-inner">
                  
                  {/* Coluna 1 (50x25mm) */}
                  <div className="w-[145px] h-[82px] bg-white border border-dashed border-gray-400 rounded p-1.5 flex flex-col justify-between shadow-xs">
                    {/* Código de barras com largura contida e texto legível centralizado */}
                    <div className="flex flex-col items-center">
                      <div className="w-[75%] h-5 flex items-center justify-center overflow-hidden">
                        {labels[0]?.code && barcodeCache[labels[0].code] ? (
                          <img src={barcodeCache[labels[0].code]} alt="Barcode" className="max-h-full w-full object-fill" />
                        ) : (
                          <div className="w-full h-4 bg-gray-200 flex items-center justify-center text-[7px] font-mono">||||||||||||||||</div>
                        )}
                      </div>
                      <div className="text-[9px] font-black text-gray-950 font-mono tracking-wider mt-0.5">
                        {labels[0]?.code || 'CÓDIGO'}
                      </div>
                    </div>

                    {/* Título do produto */}
                    <div className="text-[7.5px] font-medium text-gray-900 leading-tight line-clamp-2 px-0.5">
                      {labels[0]?.title || 'Título do Produto'}
                    </div>

                    {/* SKU aumentado e em destaque para a produção */}
                    <div className="text-[8.5px] font-black text-gray-950 font-mono px-0.5 pt-0.5 border-t border-gray-100">
                      {labels[0]?.sku ? `SKU: ${labels[0].sku}` : (labels[0]?.code ? `SKU: ${labels[0].code}` : 'SKU')}
                    </div>
                  </div>

                  {/* Espaço central (Gap 4mm) */}
                  <div className="w-1.5 h-14 border-r border-dotted border-gray-300" />

                  {/* Coluna 2 (50x25mm) */}
                  <div className="w-[145px] h-[82px] bg-white border border-dashed border-gray-400 rounded p-1.5 flex flex-col justify-between shadow-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-[75%] h-5 flex items-center justify-center overflow-hidden">
                        {((labels[1] || labels[0])?.code && barcodeCache[(labels[1] || labels[0]).code]) ? (
                          <img src={barcodeCache[(labels[1] || labels[0]).code]} alt="Barcode" className="max-h-full w-full object-fill" />
                        ) : (
                          <div className="w-full h-4 bg-gray-200 flex items-center justify-center text-[7px] font-mono">||||||||||||||||</div>
                        )}
                      </div>
                      <div className="text-[9px] font-black text-gray-950 font-mono tracking-wider mt-0.5">
                        {(labels[1] || labels[0])?.code || 'CÓDIGO'}
                      </div>
                    </div>

                    <div className="text-[7.5px] font-medium text-gray-900 leading-tight line-clamp-2 px-0.5">
                      {(labels[1] || labels[0])?.title || 'Título do Produto 2'}
                    </div>

                    <div className="text-[8.5px] font-black text-gray-950 font-mono px-0.5 pt-0.5 border-t border-gray-100">
                      {(labels[1] || labels[0])?.sku ? `SKU: ${(labels[1] || labels[0]).sku}` : ((labels[1] || labels[0])?.code ? `SKU: ${(labels[1] || labels[0]).code}` : 'SKU')}
                    </div>
                  </div>

                </div>

                <p className="text-[10px] text-gray-400 text-center">
                  As etiquetas serão impressas em pares contínuos de duas colunas.
                </p>
              </div>
            ) : (
              /* Preview 100 x 150 mm (1 Coluna Envio) */
              <div className="bg-gray-100 rounded-xl p-3 border border-gray-200 flex flex-col items-center">
                <div className="w-[200px] h-[300px] bg-white border border-gray-400 rounded shadow-md p-3 flex flex-col justify-between">
                  <div className="border-b border-gray-200 pb-1 text-center">
                    <span className="text-[10px] font-extrabold text-gray-800">LUME • ENVIO</span>
                  </div>

                  <div className="py-2 flex flex-col items-center justify-center">
                    {labels[0]?.code && barcodeCache[labels[0].code] ? (
                      <>
                        <img src={barcodeCache[labels[0].code]} alt="Barcode" className="max-h-14 max-w-[85%] object-fill" />
                        <span className="font-bold font-mono text-[10px] mt-1">{labels[0].code}</span>
                      </>
                    ) : (
                      <div className="w-full h-12 bg-gray-200 flex items-center justify-center text-[9px] font-mono">||||||||||||||||||||||||</div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded p-1.5 text-[8px] space-y-1">
                    <div className="font-bold text-gray-900 truncate">{labels[0]?.title || 'Caixa Acrílico 15x15x15'}</div>
                    <div className="text-gray-900 font-bold font-mono text-[9px]">SKU: {labels[0]?.sku || 'CX-15'}</div>
                  </div>

                  <div className="text-[7px] text-gray-400 text-center border-t border-gray-100 pt-1">
                    100 x 150 mm • Padrão Mercado Envios / Correios
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
