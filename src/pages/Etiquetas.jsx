import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Barcode, Plus, Trash2, Copy, FileText, Download, 
  ExternalLink, RefreshCw, Check, AlertCircle, Layers, Tag, 
  Settings2, HelpCircle, ArrowRight, Sparkles, X, ChevronDown, ChevronUp
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import clsx from 'clsx';

export default function Etiquetas() {
  // Modelo da etiqueta: '110x25' (2 colunas de 50x25mm) ou '100x150' (1 coluna de 100x150mm)
  const [model, setModel] = useState('110x25');

  // Campo de texto para colar códigos do Mercado Livre
  const [pastedCode, setPastedCode] = useState('');
  const [isProcessingCode, setIsProcessingCode] = useState(false);
  const [isProcessingZpl, setIsProcessingZpl] = useState(false);
  const [detectedType, setDetectedType] = useState(null); // 'zpl' | 'codes' | null

  // ZPL Renderizado (quando for ZPL do ML)
  const [zplPreviewUrl, setZplPreviewUrl] = useState(null);
  const [zplPdfBlob, setZplPdfBlob] = useState(null);
  const [zplError, setZplError] = useState(null);

  // Lista de etiquetas adicionadas para impressão
  const [labels, setLabels] = useState([
    {
      id: '1',
      title: 'Caixa de Acrílico 15x15x15 Cristal',
      sku: 'CX-15X15-CR',
      code: '7898901234567',
      quantity: 4
    },
    {
      id: '2',
      title: 'Expositor Acrílico com Tampa',
      sku: 'EXP-ACR-002',
      code: 'MLBU10928374',
      quantity: 2
    }
  ]);

  // Formulário de adição manual rápida
  const [manualTitle, setManualTitle] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualQty, setManualQty] = useState(1);

  // Configurações avançadas do rolo térmico
  const [showSettings, setShowSettings] = useState(false);
  const [config110x25, setConfig110x25] = useState({
    rollWidth: 110,     // Largura total do rolo em mm
    rollHeight: 25,     // Altura de cada passo em mm
    labelWidth: 50,     // Largura de cada etiqueta individual em mm
    labelHeight: 21,    // Altura útil de impressão em mm
    marginLeft: 3,      // Margem esquerda em mm
    gap: 4,             // Espaçamento entre as duas colunas em mm
    marginTop: 2,       // Margem superior em mm
    showCompanyName: false,
    fontSizeTitle: 7.5, // pt
    fontSizeSku: 6.5    // pt
  });

  const [config100x150, setConfig100x150] = useState({
    width: 100,         // mm
    height: 150,        // mm
    margin: 5,          // mm
    recipientName: '',
    recipientAddress: '',
    recipientCity: '',
    trackingCode: ''
  });

  // Estado de geração de PDF / Impressão
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);

  // Cache de códigos de barras renderizados (DataURL)
  const [barcodeCache, setBarcodeCache] = useState({});

  // Helper para gerar o DataURL do código de barras usando JsBarcode
  const getBarcodeDataUrl = (codeText) => {
    if (!codeText) return null;
    const clean = String(codeText).trim();
    if (barcodeCache[clean]) return barcodeCache[clean];

    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, clean, {
        format: 'CODE128',
        width: 2,
        height: 42,
        displayValue: true,
        fontSize: 13,
        font: 'monospace',
        textMargin: 2,
        margin: 0
      });
      const dataUrl = canvas.toDataURL('image/png');
      setBarcodeCache(prev => ({ ...prev, [clean]: dataUrl }));
      return dataUrl;
    } catch (err) {
      console.warn('Erro ao gerar código CODE128 para:', clean, err);
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, clean, {
          width: 2,
          height: 42,
          displayValue: true,
          fontSize: 13,
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
      setZplPreviewUrl(null);
      setZplPdfBlob(null);
      setZplError(null);
      return;
    }

    if (trimmed.includes('^XA') && trimmed.includes('^XZ')) {
      setDetectedType('zpl');
      // Se for ZPL, sugerir mudar para 100x150 se tiver dimensões de envio
      if (trimmed.includes('100') || trimmed.includes('150') || trimmed.includes('1200') || trimmed.includes('800')) {
        setModel('100x150');
      }
    } else {
      setDetectedType('codes');
      setZplPreviewUrl(null);
      setZplPdfBlob(null);
      setZplError(null);
    }
  }, [pastedCode]);

  // Processar código ZPL via Labelary
  const processZpl = async () => {
    if (!pastedCode.trim()) return;
    setIsProcessingZpl(true);
    setZplError(null);

    const is4x6 = model === '100x150';
    const labelaryEndpoint = is4x6 
      ? 'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/' 
      : 'https://api.labelary.com/v1/printers/8dpmm/labels/110x25/0/';

    try {
      const formData = new FormData();
      formData.append('file', new Blob([pastedCode.trim()]), 'label.zpl');

      // 1. Obter imagem PNG para pré-visualização
      const imgRes = await fetch(labelaryEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'image/png' },
        body: formData
      });

      if (!imgRes.ok) {
        throw new Error(`Erro ao renderizar ZPL (Status ${imgRes.status}). Verifique se o código ZPL é válido.`);
      }

      const imgBlob = await imgRes.blob();
      const imgUrl = URL.createObjectURL(imgBlob);
      setZplPreviewUrl(imgUrl);

      // 2. Obter PDF para impressão de alta qualidade
      const pdfFormData = new FormData();
      pdfFormData.append('file', new Blob([pastedCode.trim()]), 'label.zpl');

      const pdfRes = await fetch(labelaryEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/pdf' },
        body: pdfFormData
      });

      if (pdfRes.ok) {
        const pdfData = await pdfRes.blob();
        setZplPdfBlob(pdfData);
      }
    } catch (err) {
      console.error('Erro ao processar ZPL:', err);
      setZplError(err.message || 'Falha ao processar código ZPL.');
    } finally {
      setIsProcessingZpl(false);
    }
  };

  // Processar lista de códigos colados (MLBU, EAN, SKU, Títulos)
  const processPastedText = () => {
    const text = pastedCode.trim();
    if (!text) return;

    if (detectedType === 'zpl') {
      processZpl();
      return;
    }

    // Processar linha por linha
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

        // Se o primeiro campo parecer um código de barras (só números ou começa com MLBU)
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
        // Linha simples (apenas código ou nome com código)
        // Ex: "7891234567890" ou "MLBU12345678" ou "Caixa Acrilico 7891234567890"
        const barcodeMatch = cleanLine.match(/\b(\d{8,14}|MLBU\w+)\b/i);
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
      setLabels(prev => [...prev, ...newItems]);
      setPastedCode('');
      setDetectedType(null);
      alert(`${newItems.length} etiqueta(s) adicionada(s) à lista com sucesso!`);
    } else {
      alert('Nenhum código reconhecido no texto informado.');
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
    if (detectedType === 'zpl' && zplPdfBlob) {
      return zplPdfBlob;
    }

    if (labels.length === 0) {
      alert('Adicione ao menos uma etiqueta para gerar o PDF.');
      return null;
    }

    // Expandir lista de etiquetas de acordo com a quantidade
    const expandedList = [];
    labels.forEach(item => {
      const q = Number(item.quantity) || 1;
      for (let i = 0; i < q; i++) {
        expandedList.push(item);
      }
    });

    if (model === '110x25') {
      // ----------------------------------------------------
      // MODELO 110 x 25 mm (2 colunas de 50x25mm cada)
      // ----------------------------------------------------
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [config110x25.rollHeight, config110x25.rollWidth] // [25, 110]
      });

      const { marginLeft, gap, labelWidth, labelHeight, marginTop, fontSizeTitle, fontSizeSku } = config110x25;

      const totalPairs = Math.ceil(expandedList.length / 2);

      for (let pageIdx = 0; pageIdx < totalPairs; pageIdx++) {
        if (pageIdx > 0) {
          doc.addPage([config110x25.rollWidth, config110x25.rollHeight], 'landscape');
        }

        const leftItem = expandedList[pageIdx * 2];
        const rightItem = expandedList[pageIdx * 2 + 1] || null;

        // Renderizar Coluna Esquerda
        if (leftItem) {
          const xLeft = marginLeft;
          const yLeft = marginTop;
          renderSingleLabel50x25(doc, leftItem, xLeft, yLeft, labelWidth, labelHeight, fontSizeTitle, fontSizeSku);
        }

        // Renderizar Coluna Direita
        if (rightItem) {
          const xRight = marginLeft + labelWidth + gap;
          const yRight = marginTop;
          renderSingleLabel50x25(doc, rightItem, xRight, yRight, labelWidth, labelHeight, fontSizeTitle, fontSizeSku);
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

  // Renderizar 1 etiqueta individual de 50x25 mm dentro do PDF
  const renderSingleLabel50x25 = (doc, item, x, y, width, height, fontSizeTitle, fontSizeSku) => {
    // 1. Título do Produto (negrito, truncado ou até 2 linhas)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSizeTitle);
    doc.setTextColor(0, 0, 0);

    const titleLines = doc.splitTextToSize(item.title || 'Produto sem título', width - 2);
    // Limitar a no máximo 2 linhas para não invadir o código de barras
    const displayedLines = titleLines.slice(0, 2);
    doc.text(displayedLines, x + 1, y + 3);

    // 2. SKU / Variação
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSizeSku);
    doc.setTextColor(60, 60, 60);

    const skuText = item.sku ? `SKU: ${item.sku}` : '';
    const ySku = y + (displayedLines.length === 1 ? 6.5 : 8.5);
    if (skuText) {
      doc.text(skuText, x + 1, ySku);
    }

    // 3. Código de Barras
    const barcodeDataUrl = getBarcodeDataUrl(item.code);
    if (barcodeDataUrl) {
      const barcodeY = y + 9.5;
      const barcodeH = 10.5;
      const barcodeW = width - 4;
      doc.addImage(barcodeDataUrl, 'PNG', x + 2, barcodeY, barcodeW, barcodeH);
    } else {
      // Fallback texto se o código não puder ser gerado
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.text(`* ${item.code} *`, x + width / 2, y + 15, { align: 'center' });
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
      doc.addImage(barcodeDataUrl, 'PNG', 10, 24, 80, 32);
    }

    // Linha divisória
    doc.line(4, 62, 96, 62);

    // Detalhes do Produto / Pacote
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('DESCRIÇÃO DO PRODUTO / CONTEÚDO:', 8, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(item.title || 'Produto sem descrição', 84);
    doc.text(titleLines.slice(0, 3), 8, 77);

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
    doc.setFontSize(12);
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

  // Ação: Imprimir Direto (abre janela de impressão com configuração milimétrica)
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
        setTimeout(() => {
          try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
          } catch (e) {
            // Se iframe print falhar por política de segurança, abre em nova aba
            window.open(blobUrl, '_blank');
          }
        }, 300);
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
                Pronto p/ Térmica
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
            <Printer size={16} className={model === '100x150' ? 'text-indigo-600' : 'text-gray-400'} />
            <div className="text-left">
              <div className="leading-tight font-extrabold">100 x 150 mm</div>
              <div className="text-[10px] font-normal text-gray-500">1 Coluna • Envio / Despacho</div>
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
                  <p className="text-[11px] text-gray-500">Aceita código ZPL (^XA...), códigos de barras (789..., MLBU...) ou lista copiada de produtos</p>
                </div>
              </div>

              {detectedType === 'zpl' && (
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-200 animate-pulse">
                  <Sparkles size={13} />
                  Código ZPL Detectado
                </span>
              )}
            </div>

            <div className="p-5 space-y-3">
              <textarea
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder={`Cole aqui o código gerado pelo Mercado Livre...\n\nExemplos aceitos:\n- Código ZPL térmico: ^XA^FO50,50^ADN,36,20^FD...^FS^XZ\n- Código de barras simples: 7898901234567\n- Código MLBU do Full: MLBU10928374\n- Lista de produtos copiados (uma por linha): SKU | Título | Código | Quantidade`}
                rows={5}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPastedCode('')}
                  disabled={!pastedCode}
                  className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                >
                  Limpar Campo
                </button>

                <button
                  type="button"
                  onClick={processPastedText}
                  disabled={!pastedCode.trim() || isProcessingZpl}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition-all"
                >
                  {isProcessingZpl ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Processando ZPL...
                    </>
                  ) : detectedType === 'zpl' ? (
                    <>
                      <Sparkles size={14} />
                      Renderizar Etiqueta ZPL
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
                    placeholder="Ex: CX-15X15"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Código de Barras (EAN / MLBU)</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: 7898901234567"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Quantidade</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-bold"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Card 3: Lista de Etiquetas na Fila */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900 text-sm">
                  Fila de Impressão ({labels.length} produto{labels.length === 1 ? '' : 's'})
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  Total: {totalLabelUnits} etiqueta{totalLabelUnits === 1 ? '' : 's'} 
                  {model === '110x25' && ` (${totalPages110x25} página${totalPages110x25 === 1 ? '' : 's'})`}
                </span>

                {labels.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {labels.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Nenhuma etiqueta na fila de impressão. Cole os códigos do Mercado Livre acima ou adicione manualmente.
                </div>
              ) : (
                labels.map((item) => (
                  <div key={item.id} className="p-3.5 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Miniatura do Código de Barras */}
                      <div className="w-20 h-11 bg-white border border-gray-200 rounded-lg p-1 flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden">
                        {barcodeCache[item.code] ? (
                          <img src={barcodeCache[item.code]} alt="Barcode" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-gray-400 font-mono">Gerando...</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 text-xs truncate" title={item.title}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-mono">
                          {item.sku && <span className="bg-gray-100 px-1.5 py-0.2 rounded text-gray-700">{item.sku}</span>}
                          <span>{item.code}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-1 text-xs font-extrabold text-gray-900 min-w-[28px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
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
                Pronto
              </span>
            </div>

            {/* Botão de Impressão Direta na Impressora Térmica */}
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isGeneratingPdf || (labels.length === 0 && !zplPreviewUrl)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.01]"
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
                disabled={isGeneratingPdf || (labels.length === 0 && !zplPreviewUrl)}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={14} className="text-gray-500" />
                Baixar PDF
              </button>

              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={isGeneratingPdf || (labels.length === 0 && !zplPreviewUrl)}
                className="py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} className="text-indigo-600" />
                Abrir PDF Nova Aba
              </button>
            </div>
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

            {/* Preview do ZPL renderizado */}
            {detectedType === 'zpl' && zplPreviewUrl ? (
              <div className="bg-gray-100 rounded-xl p-3 flex flex-col items-center justify-center border border-gray-200">
                <img src={zplPreviewUrl} alt="ZPL Preview" className="max-w-full max-h-[380px] object-contain rounded shadow-sm bg-white" />
                <span className="text-[10px] text-gray-500 mt-2 font-mono">Renderização exata do código ZPL via Labelary</span>
              </div>
            ) : model === '110x25' ? (
              /* Preview 110 x 25 mm (2 Colunas) */
              <div className="bg-gray-100 rounded-xl p-3 border border-gray-200 space-y-2">
                <div className="text-[10px] text-gray-500 font-bold text-center">
                  Passo 1 do Rolo (Largura 110mm x Altura 25mm)
                </div>

                {/* Simulação física do rolo de 2 colunas com bordas tracejadas */}
                <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-2.5 flex items-center justify-center gap-2 shadow-inner">
                  {/* Coluna 1 (50x25mm) */}
                  <div className="w-[145px] h-[75px] bg-white border border-dashed border-gray-400 rounded p-1.5 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="text-[8px] font-bold text-gray-900 truncate">
                        {labels[0]?.title || 'Título do Produto'}
                      </div>
                      <div className="text-[7px] text-gray-500 font-mono">
                        {labels[0]?.sku ? `SKU: ${labels[0].sku}` : 'SKU-001'}
                      </div>
                    </div>
                    <div className="w-full h-8 flex items-center justify-center overflow-hidden">
                      {labels[0]?.code && barcodeCache[labels[0].code] ? (
                        <img src={barcodeCache[labels[0].code]} alt="Barcode" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="w-full h-5 bg-gray-200 flex items-center justify-center text-[7px] font-mono">||||||||||||||||</div>
                      )}
                    </div>
                  </div>

                  {/* Espaço central (Gap 4mm) */}
                  <div className="w-1.5 h-12 border-r border-dotted border-gray-300" />

                  {/* Coluna 2 (50x25mm) */}
                  <div className="w-[145px] h-[75px] bg-white border border-dashed border-gray-400 rounded p-1.5 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="text-[8px] font-bold text-gray-900 truncate">
                        {labels[1]?.title || labels[0]?.title || 'Título do Produto 2'}
                      </div>
                      <div className="text-[7px] text-gray-500 font-mono">
                        {labels[1]?.sku ? `SKU: ${labels[1].sku}` : (labels[0]?.sku || 'SKU-002')}
                      </div>
                    </div>
                    <div className="w-full h-8 flex items-center justify-center overflow-hidden">
                      {((labels[1] || labels[0])?.code && barcodeCache[(labels[1] || labels[0]).code]) ? (
                        <img src={barcodeCache[(labels[1] || labels[0]).code]} alt="Barcode" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="w-full h-5 bg-gray-200 flex items-center justify-center text-[7px] font-mono">||||||||||||||||</div>
                      )}
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

                  <div className="py-2 flex items-center justify-center">
                    {labels[0]?.code && barcodeCache[labels[0].code] ? (
                      <img src={barcodeCache[labels[0].code]} alt="Barcode" className="max-h-16 max-w-full object-contain" />
                    ) : (
                      <div className="w-full h-12 bg-gray-200 flex items-center justify-center text-[9px] font-mono">||||||||||||||||||||||||</div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded p-1.5 text-[8px] space-y-1">
                    <div className="font-bold text-gray-900 truncate">{labels[0]?.title || 'Caixa Acrílico 15x15x15'}</div>
                    <div className="text-gray-500 font-mono">SKU: {labels[0]?.sku || 'CX-15'}</div>
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
