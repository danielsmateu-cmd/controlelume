import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Receipt, ArrowLeft, Settings, DollarSign, Package, Percent, User, MapPin, Phone, FileText, Save, List, CheckCircle, XCircle, Clock, Eye, ChevronUp, ChevronDown, Pencil, Search, X, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';

const TrendingUp = ({ size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
);

const WhatsAppIcon = ({ size = 20, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.473 1.452 5.38 1.453 5.568 0 10.103-4.52 10.107-10.09.002-2.7-1.047-5.24-2.951-7.147C17.28 1.467 14.74 .419 12.008.419c-5.57 0-10.108 4.522-10.111 10.093-.001 1.897.498 3.754 1.446 5.372L2.35 21.755l6.096-1.601zm10.741-7.195c-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.569-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    </svg>
);

const Orcamentos = ({ materials, setMaterials, readOnly, setActiveTab }) => {
    const [view, setView] = useState('budget'); // 'budget' or 'register'
    const [markup, setMarkup] = useState('3');
    const [globalQty, setGlobalQty] = useState('1');
    const [nfPercentage, setNfPercentage] = useState('6');
    const [taxPercentage, setTaxPercentage] = useState('11');

    // Carregar materiais, configurações e orçamentos do servidor ao iniciar
    useEffect(() => {
        api.getSettings('lume_global_settings').then(settings => {
            if (settings) {
                if (settings.nfPercentage) setNfPercentage(settings.nfPercentage);
                if (settings.taxPercentage) setTaxPercentage(settings.taxPercentage);
            } else {
                // Fallback from old local storage
                const saved = localStorage.getItem('lume_global_settings');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setNfPercentage(parsed.nfPercentage || '6');
                    setTaxPercentage(parsed.taxPercentage || '11');
                }
            }
        });

        // As materiais e orçamentos já são iniciados em App.jsx,
        // mas as vezes as chamadas de refresh ficam espalhadas
        api.getMaterials().then(data => {
            if (data && data.length > 0) {
                // Ao carregar pela primeira vez, migrar ordem antiga se necessário
                const oldOrderStr = localStorage.getItem('materialsOrder');
                if (oldOrderStr) {
                    const oldOrder = JSON.parse(oldOrderStr);
                    // Se a maioria dos materiais estiver com sort_index = 0 ou nulo, aplica e limpa localStorage
                    const hasSortIndex = data.some(m => m.sortIndex > 0);
                    if (!hasSortIndex && oldOrder.length > 0) {
                        const migrated = data.map(m => {
                            const idx = oldOrder.indexOf(m.id);
                            return { ...m, sortIndex: idx !== -1 ? idx : 999999 };
                        });
                        api.updateMaterialsOrder(oldOrder.map(id => ({ id })));
                        setMaterials(migrated);
                        localStorage.removeItem('materialsOrder');
                        return;
                    }
                }
                setMaterials(data);
            }
        });
        api.getBudgets().then(data => {
            if (data) setSavedBudgets(data);
        });
    }, []);

    const saveGlobalSettings = async () => {
        await api.saveSettings('lume_global_settings', { nfPercentage, taxPercentage });
        alert('Configurações Globais salvas e sincronizadas com sucesso!');
    };

    const [discount, setDiscount] = useState('10');
    const [discountValue, setDiscountValue] = useState('0');
    const [itemName, setItemName] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [budgetItems, setBudgetItems] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);
    const [savedBudgets, setSavedBudgets] = useState([]);
    const [budgetSearch, setBudgetSearch] = useState('');
    const [deliveryModal, setDeliveryModal] = useState(null); // { id, newStatus }
    const [attachedImages, setAttachedImages] = useState([]); // { id, dataUrl, name }
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [includeNf, setIncludeNf] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const generateAndUploadPDF = async (budget) => {
        const printElement = document.getElementById('print-area-container');
        if (!printElement) {
            throw new Error("Elemento de impressão não encontrado no DOM.");
        }

        // Clone o elemento
        const clone = printElement.cloneNode(true);
        clone.id = 'print-area-clone';

        // Estilos para forçar renderização A4 exata na tela dentro do clone
        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            .print-page {
                width: 794px !important;
                height: 1123px !important;
                max-height: 1123px !important;
                overflow: hidden !important;
                padding: 45px 55px !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                background-color: white !important;
                color: black !important;
                position: relative !important;
            }
            .print-image-page {
                width: 794px !important;
                height: 1123px !important;
                max-height: 1123px !important;
                padding: 45px 55px !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                background-color: white !important;
                color: black !important;
                position: relative !important;
            }
            .print-table {
                width: 100% !important;
                border-collapse: collapse !important;
            }
            .print-table th, .print-table td {
                border-bottom: 0.5pt solid #e2e8f0 !important;
                padding: 7px 4px !important;
            }
            .print-table th {
                border-bottom: 1pt solid #0f172a !important;
                color: #475569 !important;
            }
            .section-title {
                font-size: 8px !important;
                font-weight: 800 !important;
                color: #475569 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                margin-bottom: 6px !important;
                border-bottom: 0.5pt solid #cbd5e1 !important;
                padding-bottom: 3px !important;
            }
            .page-number {
                margin-top: auto !important;
                text-align: right !important;
                font-size: 8px !important;
                color: #94a3b8 !important;
                font-weight: 700 !important;
            }
        `;
        clone.appendChild(styleEl);

        // Remove Tailwind "hidden", fixa fora de vista mas no fluxo de renderização
        clone.className = '';
        clone.style.position = 'fixed';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.width = '794px';
        clone.style.zIndex = '-9999';
        clone.style.pointerEvents = 'none';
        clone.style.visibility = 'visible';
        clone.style.display = 'block';

        document.body.appendChild(clone);

        try {
            // Aguarda renderização de imagens e fontes
            await new Promise(resolve => setTimeout(resolve, 500));

            // Determina a altura esperada com base nas páginas necessárias
            const imagesCount = budget && budget.attachedImages 
                ? budget.attachedImages.length 
                : attachedImages.length;
            const pageCount = 1 + imagesCount;
            const expectedHeight = 1123 * pageCount;

            // Captura com html2canvas
            const canvas = await html2canvas(clone, {
                scale: 2, // maior qualidade
                useCORS: true,
                logging: false,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 794,
                height: expectedHeight
            });

            // Remove o clone do DOM
            document.body.removeChild(clone);

            if (!canvas || canvas.width === 0 || canvas.height === 0) {
                throw new Error(`Dimensões do canvas inválidas: ${canvas ? canvas.width : 0}x${canvas ? canvas.height : 0}`);
            }

            // Calcula proporção A4
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const canvasPageHeight = Math.round(canvas.width * 1.4142);

            let remainingHeight = canvas.height;
            let position = 0;

            while (remainingHeight > 0) {
                const targetWidth = canvas.width;
                const targetHeight = Math.max(1, Math.min(canvasPageHeight, remainingHeight));

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;

                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(
                    canvas,
                    0, position, targetWidth, targetHeight,
                    0, 0, targetWidth, targetHeight
                );

                const pageImgData = tempCanvas.toDataURL('image/jpeg', 0.95);

                if (position > 0) {
                    pdf.addPage();
                }

                const rawDestHeight = targetWidth > 0 ? (targetHeight * imgWidth) / targetWidth : pageHeight;
                const safeDestHeight = (isNaN(rawDestHeight) || !isFinite(rawDestHeight) || rawDestHeight <= 0) 
                    ? pageHeight 
                    : rawDestHeight;

                pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, safeDestHeight);

                position += canvasPageHeight;
                remainingHeight -= canvasPageHeight;
            }

            const pdfBlob = pdf.output('blob');
            const fileId = budget.id || Date.now();
            const fileName = `orcamento_${fileId}.pdf`;

            // Apaga versão anterior do mesmo orçamento (se existir) para não acumular arquivos
            await supabase.storage
                .from('orcamentos')
                .remove([fileName]);

            // Envia para o Supabase Storage
            const { error } = await supabase.storage
                .from('orcamentos')
                .upload(fileName, pdfBlob, {
                    contentType: 'application/pdf'
                });

            if (error) throw error;

            // Pega a URL pública
            const { data } = supabase.storage
                .from('orcamentos')
                .getPublicUrl(fileName);

            return data.publicUrl;
        } catch (err) {
            if (document.body.contains(clone)) {
                document.body.removeChild(clone);
            }
            throw err;
        }
    };

    const handleSendWhatsApp = async (budget) => {
        if (isGeneratingPdf) return;

        const cData = budget ? budget.clientData : clientData;
        const items = budget ? budget.items : budgetItems;
        const total = budget ? budget.total : projectTotal;

        if (items.length === 0) {
            alert("O orçamento não possui itens.");
            return;
        }

        // ✅ Abre a janela IMEDIATAMENTE (antes de qualquer await) para evitar bloqueio de popup
        const waWindow = window.open('about:blank', '_blank');

        const originalClientData = { ...clientData };
        const originalBudgetItems = [...budgetItems];
        const originalAttachedImages = [...attachedImages];

        setIsGeneratingPdf(true);

        try {
            if (budget) {
                setClientData(budget.clientData || {});
                setBudgetItems(budget.items || []);
                setAttachedImages(budget.attachedImages || []);
                // Aguarda 800ms para garantir que o React re-renderizou o layout de impressão
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            const pdfUrl = await generateAndUploadPDF(budget || { id: 'atual' });

            if (budget) {
                setClientData(originalClientData);
                setBudgetItems(originalBudgetItems);
                setAttachedImages(originalAttachedImages);
            }

            const clientName = cData?.name || "Cliente";
            const itemsSummary = items
                .map(item => `• *${item.quantity}x ${item.name}* (R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un)`)
                .join('\n');

            const totalPix = total * 0.9;
            const signalPix = totalPix / 2;
            const cardInstallment = total / 6;

            const message = `Olá, *${clientName}*!
Segue o orçamento da *LUME Acrílicos & Design*:

*Itens do Orçamento:*
${itemsSummary}

*Valor Total:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

*Condições de Pagamento:*
💵 *À Vista (PIX com 10% de desconto):* R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   ↳ Sinal de 50% (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) + Saldo na Retirada (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})

💳 *Cartão de Crédito (Sem Juros):* 6x de R$ ${cardInstallment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

⏱️ *Prazo de Produção:* 10 dias úteis (a partir da aprovação do sinal).
📍 *Retirada:* Rua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba/SP.

📄 *Visualize ou baixe o PDF completo aqui:*
${pdfUrl}`;

            const encodedText = encodeURIComponent(message);
            const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

            // Redireciona a janela já aberta para o WhatsApp (evita bloqueio de popup)
            if (waWindow && !waWindow.closed) {
                waWindow.location.href = waUrl;
            } else {
                window.open(waUrl, '_blank');
            }
        } catch (err) {
            console.error("Erro ao gerar/enviar o PDF:", err);

            // Fecha a janela em branco se houve erro
            if (waWindow && !waWindow.closed) {
                waWindow.close();
            }

            if (budget) {
                setClientData(originalClientData);
                setBudgetItems(originalBudgetItems);
                setAttachedImages(originalAttachedImages);
            }

            const errMsg = err?.message || String(err) || "Erro desconhecido";
            if (confirm(`Não foi possível gerar ou hospedar o PDF na nuvem.\nDetalhes: ${errMsg}\n\nDeseja enviar apenas o resumo do orçamento por texto via WhatsApp e anexar o PDF manualmente?`)) {
                const clientName = cData?.name || "Cliente";
                const itemsSummary = items
                    .map(item => `• *${item.quantity}x ${item.name}* (R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un)`)
                    .join('\n');
                const totalPix = total * 0.9;
                const signalPix = totalPix / 2;
                const cardInstallment = total / 6;

                const fallbackMessage = `Olá, *${clientName}*!
Segue o resumo do orçamento da *LUME Acrílicos & Design*:

*Itens do Orçamento:*
${itemsSummary}

*Valor Total:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

*Condições de Pagamento:*
💵 *À Vista (PIX com 10% de desconto):* R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   ↳ Sinal de 50% (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) + Saldo na Retirada (R$ ${signalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})

💳 *Cartão de Crédito (Sem Juros):* 6x de R$ ${cardInstallment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

⏱️ *Prazo de Produção:* 10 dias úteis (a partir da aprovação do sinal).
📍 *Retirada:* Rua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba/SP.

_Por favor, faça o download do PDF completo e anexe-o nesta conversa._`;

                const encodedText = encodeURIComponent(fallbackMessage);
                const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
                window.open(waUrl, '_blank');
            }
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const renderPrintLayout = () => {
        return (
            <div id="print-area-container" className="hidden print:block">

                {/* ── PÁGINA 1: Orçamento principal ── */}
                {(() => {
                    const totalPages = 1 + attachedImages.length;
                    return (
                        <div className="print-page bg-white text-black font-sans leading-tight text-[10.5px]">

                            {/* Cabeçalho */}
                            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200">
                                <div className="flex-1">
                                    <img src="/Logo%20LUME.png" alt="Logo LUME" className="h-28 object-contain" />
                                </div>
                                <div className="flex-1 text-right">
                                    <h1 className="text-2xl font-light text-slate-800 tracking-tight mb-1">PROPOSTA COMERCIAL</h1>
                                    <div className="text-[9px] text-slate-600 space-y-0.5 leading-relaxed">
                                        <p className="font-bold text-slate-800 text-xs mb-0.5">{new Date().toLocaleDateString('pt-BR')}</p>
                                        <p className="font-bold text-slate-800 uppercase">MATEU ACRILICOS E MARCENARIA INDUSTRIA E COMERCIO LTDA.</p>
                                        <p>CNPJ: 66.022.922/0001-08</p>
                                        <p>Rua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba – SP</p>
                                        <p>CEP: 13.347-458 | WhatsApp: (19) 99916-2239</p>
                                    </div>
                                </div>
                            </div>

                            {/* Dados Cliente */}
                            <div className="mb-4">
                                <div className="section-title">Informações do Cliente</div>
                                <div className="grid grid-cols-4 gap-y-3">
                                    <div className="col-span-2">
                                        <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Nome / Razão Social</span>
                                        <span className="text-xs font-bold text-slate-800 uppercase">{clientData.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] uppercase text-slate-500 block mb-0.5">CPF / CNPJ</span>
                                        <span className="text-xs text-slate-800">{clientData.doc}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Telefone</span>
                                        <span className="text-xs text-slate-800">{clientData.phone}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Email</span>
                                        <span className="text-xs text-slate-800">{clientData.email || '-'}</span>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="text-[8px] uppercase text-slate-500 block mb-0.5">Endereço</span>
                                        <span className="text-xs text-slate-800">{clientData.address}{clientData.number ? `, ${clientData.number}` : ''} - {clientData.neighborhood}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Itens */}
                            <div className="mb-3">
                                <div className="section-title">Descrição dos Serviços</div>
                                <table className="print-table w-full">
                                    <thead>
                                        <tr>
                                            <th className="w-12 text-center text-[8px] uppercase tracking-widest">Qtd</th>
                                            <th className="text-left text-[8px] uppercase tracking-widest pl-4">Item / Descrição</th>
                                            <th className="w-28 text-right text-[8px] uppercase tracking-widest">Unitário</th>
                                            <th className="w-28 text-right text-[8px] uppercase tracking-widest">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        {budgetItems.map(item => (
                                            <tr key={item.id}>
                                                <td className="text-center font-bold align-top pt-1.5">{item.quantity}</td>
                                                <td className="px-2 text-slate-800 align-top pt-1.5">
                                                    <div className="font-bold uppercase">{item.name}</div>
                                                    {item.description && (
                                                        <div className="text-[9px] font-normal text-slate-600 mt-0.5 whitespace-pre-wrap leading-tight">{item.description}</div>
                                                    )}
                                                </td>
                                                <td className="text-right text-slate-800 align-top pt-1.5">R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="text-right font-black text-slate-900 align-top pt-1.5">R$ {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                        {Array.from({ length: Math.max(0, 4 - budgetItems.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`} className="h-5">
                                                <td className="border-b border-slate-200"></td>
                                                <td className="border-b border-slate-200"></td>
                                                <td className="border-b border-slate-200"></td>
                                                <td className="border-b border-slate-200"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan="2" className="border-none"></td>
                                            <td className="text-slate-600 font-bold text-right py-4 uppercase text-[8px] tracking-[0.2em] border-none">Total da Proposta</td>
                                            <td className="font-black text-xl text-right text-slate-900 py-4 border-none whitespace-nowrap">
                                                R$ {projectTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Pagamento + Prazo */}
                            <div className="grid grid-cols-12 gap-8 mt-2">
                                <div className="col-span-8">
                                    <div className="section-title">Condições de Pagamento</div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-800 block uppercase">À Vista (PIX ou Transferência)</span>
                                                <span className="text-[9px] text-green-700 font-bold uppercase tracking-wide">Benefício de 10% de desconto aplicado</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-base font-black text-slate-900">R$ {(projectTotal * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <div className="text-[9px] text-green-700 uppercase mt-0.5 leading-tight text-right font-bold">
                                                    Sinal 50% (R$ {((projectTotal * 0.9) / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) <br />
                                                    + Saldo na Retirada (R$ {((projectTotal * 0.9) / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-800 block uppercase">Cartão de Crédito</span>
                                                <span className="text-[9px] text-slate-600 font-bold uppercase">Parcelamento padrão sem descontos</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-base font-black text-slate-900">6x de R$ {(projectTotal / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <div className="text-[8px] text-slate-600 font-bold uppercase mt-0.5">Sem juros no cartão</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="section-title mt-3">Dados Bancários / Pagamento</div>
                                    <div className="flex gap-8">
                                        <div className="flex-1">
                                            <span className="text-[8px] uppercase text-slate-600 font-bold block mb-0.5">Banco Itaú</span>
                                            <div className="text-[10px] text-slate-800 space-y-0.5">
                                                <p><span className="font-black">Ag:</span> 5396</p>
                                                <p><span className="font-black">Cc:</span> 97680-4</p>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[8px] uppercase text-slate-600 font-bold block mb-0.5">Transferência PIX</span>
                                            <div className="text-[10px] text-slate-800">
                                                <p className="font-black text-slate-900">comercial@lumeacrilicos.com.br</p>
                                                <p className="text-[8px] opacity-90 mt-0.5 font-bold uppercase">MATEU ACRILICOS E MARCENARIA LTDA.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-4 flex flex-col pt-1">
                                    <div className="border-l border-slate-300 pl-5 h-full flex flex-col justify-start">
                                        <div className="section-title border-none mb-3 text-slate-600 font-bold">Prazo de Produção</div>
                                        <div className="text-3xl font-black text-slate-900 leading-none">10</div>
                                        <div className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-widest">Dias Úteis</div>
                                        <div className="text-[10px] italic text-slate-700 mt-2 leading-relaxed font-medium">
                                            Prazo estimado contado a partir da aprovação do orçamento e confirmação do sinal.
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Descrição</div>
                                            <div className="text-[9px] text-slate-700 leading-relaxed font-medium">
                                                Entrega e instalação não inclusas, os pedidos devem ser retirados no endereço:<br />
                                                Rua Hermínio Albieiro, nº 64 - DIMPE II - Indaiatuba – SP<br />
                                                CEP: 13.347-458<br />
                                                <strong>Não fazemos instalação.</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rodapé */}
                            <div className="mt-4 text-center text-[10px] text-slate-600 font-bold border-t border-slate-300 pt-2">
                                Orçamento válido por 7 dias.
                            </div>

                            {/* Paginação */}
                            {totalPages > 1 && (
                                <div className="page-number">Pág 1 de {totalPages}</div>
                            )}
                        </div>
                    );
                })()}

                {/* ── PÁGINAS DE IMAGENS ── */}
                {attachedImages.map((img, idx) => {
                    const totalPages = 1 + attachedImages.length;
                    const pageNum = idx + 2;
                    return (
                        <div key={img.id} className="print-image-page bg-white text-black font-sans">
                            {/* Cabeçalho igual */}
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                                <div className="flex-1">
                                    <img src="/Logo%20LUME.png" alt="Logo LUME" className="h-20 object-contain" />
                                </div>
                                <div className="flex-1 text-right">
                                    <h1 className="text-xl font-light text-slate-800 tracking-tight mb-1">PROPOSTA COMERCIAL</h1>
                                    <div className="text-[9px] text-slate-600 space-y-0.5">
                                        <p className="font-bold text-slate-800 text-[10px]">{new Date().toLocaleDateString('pt-BR')}</p>
                                        <p className="font-bold text-slate-800 uppercase">MATEU ACRILICOS E MARCENARIA INDUSTRIA E COMERCIO LTDA.</p>
                                        <p>CNPJ: 66.022.922/0001-08 | WhatsApp: (19) 99916-2239</p>
                                    </div>
                                </div>
                            </div>
                            {/* Cliente resumido */}
                            <div className="text-[9px] text-slate-600 mb-4 font-bold">
                                Cliente: <span className="text-slate-800 uppercase">{clientData.name}</span>
                                {img.name && <span className="ml-4 text-slate-500 font-normal">Referência: {img.name}</span>}
                            </div>
                            {/* Imagem ocupa o restante */}
                            <div className="flex-1 flex items-center justify-center">
                                <img
                                    src={img.dataUrl}
                                    alt={img.name || `Imagem ${idx + 1}`}
                                    style={{ maxWidth: '100%', maxHeight: '210mm', objectFit: 'contain' }}
                                />
                            </div>
                            {/* Paginação */}
                            <div className="page-number">Pág {pageNum} de {totalPages}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleSaveBudget = async () => {
        if (budgetItems.length === 0) {
            alert("Adicione itens ao orçamento antes de salvar.");
            return;
        }
        if (!clientData.name) {
            alert("Preencha o nome do cliente.");
            return;
        }

        const newBudget = {
            date: new Date().toISOString(),
            clientData: { ...clientData },
            items: [...budgetItems],
            total: projectSubtotal,
            status: 'Aguardando'
        };

        const saved = await api.addBudget(newBudget);
        if (saved) {
            setSavedBudgets([saved, ...savedBudgets]);
            if (confirm("Orçamento salvo com sucesso!\nDeseja enviar o resumo do orçamento pelo WhatsApp para o cliente?")) {
                handleSendWhatsApp(saved);
            }
        } else {
            // Fallback
            const fallback = { ...newBudget, id: Date.now() };
            const updated = [fallback, ...savedBudgets];
            setSavedBudgets(updated);
            if (confirm("Orçamento salvo localmente (Erro ao salvar no servidor).\nDeseja enviar o resumo do orçamento pelo WhatsApp para o cliente?")) {
                handleSendWhatsApp(fallback);
            }
        }
    };

    const handleDeleteBudget = async (id) => {
        if (confirm("Tem certeza que deseja excluir este orçamento?")) {
            await api.deleteBudget(id);
            setSavedBudgets(savedBudgets.filter(b => b.id !== id));
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        // Para Aprovado e Faturado, pede data de entrega antes de salvar
        if (newStatus === 'Aprovado' || newStatus === 'Faturado') {
            setDeliveryModal({ id, newStatus });
            return;
        }
        // Para demais status (Aguardando, Recusado) salva diretamente
        await api.updateBudget(id, { status: newStatus });
        setSavedBudgets(savedBudgets.map(b => b.id === id ? { ...b, status: newStatus } : b));
    };

    const handleConfirmDelivery = async (deliveryDate) => {
        if (!deliveryModal) return;
        const { id, newStatus } = deliveryModal;
        await api.updateBudget(id, { status: newStatus, deliveryDate });
        
        // Salva a data de entrega no cache de producao_data no localStorage para garantir resiliência
        try {
            const savedProducao = localStorage.getItem('producao_data');
            const producaoData = savedProducao ? JSON.parse(savedProducao) : {};
            producaoData[id] = {
                ...(producaoData[id] || {}),
                deliveryDate
            };
            localStorage.setItem('producao_data', JSON.stringify(producaoData));
        } catch (e) {
            console.error('Erro ao salvar data de entrega localmente:', e);
        }

        setSavedBudgets(savedBudgets.map(b =>
            b.id === id ? { ...b, status: newStatus, deliveryDate } : b
        ));
        setDeliveryModal(null);
        if ((newStatus === 'Aprovado' || newStatus === 'Faturado') && setActiveTab) {
            setActiveTab('contas');
        }
    };

    const handleLoadBudget = (budget) => {
        setClientData(budget.clientData);
        setBudgetItems(budget.items);
        setView('budget');
    };
    const [measurements, setMeasurements] = useState({});

    const [newMaterial, setNewMaterial] = useState({
        name: '', width: '', height: '', price: ''
    });

    const baseOrderedMaterials = [...materials].sort((a, b) => {
        const idxA = a.sortIndex ?? 999999;
        const idxB = b.sortIndex ?? 999999;
        // fallback por created_at se indices iguais
        if (idxA === idxB) {
            if (a.created_at && b.created_at) {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return 0;
        }
        return idxA - idxB;
    });

    const handleMoveMaterial = async (id, direction) => {
        const currentOrderMap = baseOrderedMaterials.map(m => m.id);
        const index = currentOrderMap.indexOf(id);
        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            const temp = currentOrderMap[index - 1];
            currentOrderMap[index - 1] = currentOrderMap[index];
            currentOrderMap[index] = temp;
        } else if (direction === 'down' && index < currentOrderMap.length - 1) {
            const temp = currentOrderMap[index + 1];
            currentOrderMap[index + 1] = currentOrderMap[index];
            currentOrderMap[index] = temp;
        }

        // Apply internally for immediate rendering
        const ordered = materials.map(m => {
            const idx = currentOrderMap.indexOf(m.id);
            return { ...m, sortIndex: idx !== -1 ? idx : 999999 };
        });

        setMaterials(ordered);

        // Async save
        await api.updateMaterialsOrder(currentOrderMap.map(mId => ({ id: mId })));
    };

    const sheetMaterials = baseOrderedMaterials.filter(m => !m.type || m.type === 'sheet');
    const linearMaterials = baseOrderedMaterials.filter(m => m.type === 'linear');
    const unitMaterials = baseOrderedMaterials.filter(m => m.type === 'unit');

    // Default global ordered array mapped to columns grouped essentially by category
    const orderedMaterials = [...sheetMaterials, ...linearMaterials, ...unitMaterials];

    const [newUnitMaterial, setNewUnitMaterial] = useState({ name: '', pricePerUnit: '' });
    const [newLinearMaterial, setNewLinearMaterial] = useState({ name: '', pricePerMeter: '' });

    // Quantities for unit and linear materials in the budget calculator
    const [unitQtys, setUnitQtys] = useState({});     // { [id]: qty }
    const [linearLengths, setLinearLengths] = useState({}); // { [id]: cm }

    // Editable Materials
    const [editingMaterialId, setEditingMaterialId] = useState(null);
    const [editMaterialData, setEditMaterialData] = useState({});

    // Bulk Percentage Update
    const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
    const [bulkPercent, setBulkPercent] = useState('');

    const toggleMaterialSelection = (id) => {
        if (selectedMaterialIds.includes(id)) {
            setSelectedMaterialIds(selectedMaterialIds.filter(i => i !== id));
        } else {
            setSelectedMaterialIds([...selectedMaterialIds, id]);
        }
    };

    const handleBulkPercentIncrease = async () => {
        const percent = parseFloat(bulkPercent);
        if (!percent || isNaN(percent)) {
            alert("Digite um valor percentual válido.");
            return;
        }
        if (selectedMaterialIds.length === 0) {
            alert("Selecione pelo menos um material.");
            return;
        }
        if (!window.confirm(`Aplicar ${percent > 0 ? '+' : ''}${percent}% de ajuste em ${selectedMaterialIds.length} materiais selecionados?`)) return;

        const updatedMaterials = [];
        const promises = [];

        materials.forEach(m => {
            if (selectedMaterialIds.includes(m.id)) {
                const newPrice = m.price * (1 + (percent / 100));
                
                const payload = {
                    name: m.name,
                    price: newPrice
                };
                if (m.type === 'unit') {
                    payload.width = 0;
                    payload.height = 0;
                    payload.price_per_m2 = 0;
                } else if (m.type === 'linear') {
                    payload.width = 0;
                    payload.height = 1;
                    payload.price_per_m2 = 0;
                } else {
                    payload.width = m.width || 0;
                    payload.height = m.height || 0;
                    payload.price_per_m2 = (payload.price / ((payload.width * payload.height) / 10000)) || 0;
                }

                updatedMaterials.push({ ...m, ...payload, pricePerM2: payload.price_per_m2 });
                promises.push(api.updateMaterial(m.id, payload));
            } else {
                updatedMaterials.push(m);
            }
        });

        setMaterials(updatedMaterials);
        setSelectedMaterialIds([]);
        setBulkPercent('');

        try {
            const results = await Promise.all(promises);
            setMaterials(prev => prev.map(item => {
                const updated = results.find(res => res && res.id === item.id);
                return updated ? updated : item;
            }));
            alert("Preços atualizados com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Ocorreu um erro ao atualizar no banco de dados.");
        }
    };

    const handleEditMaterial = (m) => {
        setEditingMaterialId(m.id);
        setEditMaterialData({
            name: m.name,
            width: m.width,
            height: m.height,
            price: m.price,
            pricePerM2: m.pricePerM2
        });
    };

    const handleCancelEdit = () => {
        setEditingMaterialId(null);
        setEditMaterialData({});
    };

    const handleSaveEdit = async (m) => {
        try {
            const payload = {
                name: editMaterialData.name,
                price: parseFloat(editMaterialData.price) || 0
            };
            if (m.type === 'unit') {
                payload.width = 0;
                payload.height = 0;
                payload.price_per_m2 = 0;
            } else if (m.type === 'linear') {
                payload.width = 0;
                payload.height = 1;
                payload.price_per_m2 = 0;
            } else {
                payload.width = parseFloat(editMaterialData.width) || 0;
                payload.height = parseFloat(editMaterialData.height) || 0;
                payload.price_per_m2 = (payload.price / ((payload.width * payload.height) / 10000)) || 0;
            }

            const updated = await api.updateMaterial(m.id, payload);
            if (updated) {
                setMaterials(prev => prev.map(item => item.id === m.id ? updated : item));
                setEditingMaterialId(null);
                setEditMaterialData({});
            } else {
                alert('Erro ao atualizar material no banco de dados.');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Erro ao atualizar material.');
        }
    };

    // Client Data
    const [clientData, setClientData] = useState({
        name: '',
        doc: '',
        address: '',
        number: '',
        neighborhood: '',
        city: '',
        zip: '',
        phone: '',
        email: ''
    });

    const LumeLogo = () => (
        <div className="flex flex-col items-center justify-center">
            <img src="/Logo%20LUME.png" alt="Logo LUME" className="h-60 object-contain" />
            <div className="text-center leading-none mt-1">
                <span className="block text-[10px] tracking-[0.2em] text-gray-700 font-bold">ACRÍLICOS | DESIGN DE PRODUTOS</span>
            </div>
        </div>
    );


    const handleAddMaterial = async (e) => {
        e.preventDefault();
        const w = parseFloat(newMaterial.width);
        const h = parseFloat(newMaterial.height);
        const p = parseFloat(newMaterial.price);

        if (!newMaterial.name || !w || !h || !p) return;

        const areaM2 = (w * h) / 10000;
        const pricePerM2 = p / areaM2;

        const materialToAdd = {
            name: newMaterial.name,
            width: w,
            height: h,
            price: p,
            pricePerM2: pricePerM2
        };

        const saved = await api.addMaterial(materialToAdd);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            // Fallback
            setMaterials([{ ...materialToAdd, id: Date.now() }, ...materials]);
        }
        setNewMaterial({ name: '', width: '', height: '', price: '' });
    };

    const handleDeleteMaterial = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
        }
    };

    const handleAddUnitMaterial = async (e) => {
        e.preventDefault();
        const p = parseFloat(newUnitMaterial.pricePerUnit);
        if (!newUnitMaterial.name || !p) return;
        const mat = { name: newUnitMaterial.name, price: p, type: 'unit' };

        const saved = await api.addMaterial(mat);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            setMaterials([{ ...mat, id: Date.now() }, ...materials]);
        }
        setNewUnitMaterial({ name: '', pricePerUnit: '' });
    };

    const handleDeleteUnitMaterial = async (id) => {
        if (window.confirm('Excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
            setUnitQtys(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const handleAddLinearMaterial = async (e) => {
        e.preventDefault();
        const p = parseFloat(newLinearMaterial.pricePerMeter);
        if (!newLinearMaterial.name || !p) return;
        const mat = { name: newLinearMaterial.name, price: p, type: 'linear' };

        const saved = await api.addMaterial(mat);
        if (saved) {
            setMaterials([saved, ...materials]);
        } else {
            setMaterials([{ ...mat, id: Date.now() }, ...materials]);
        }
        setNewLinearMaterial({ name: '', pricePerMeter: '' });
    };

    const handleDeleteLinearMaterial = async (id) => {
        if (window.confirm('Excluir este material?')) {
            await api.deleteMaterial(id);
            setMaterials(materials.filter(m => m.id !== id));
            setLinearLengths(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const handleMeasurementChange = (id, field, value) => {
        setMeasurements(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || { x: '', y: '' }),
                [field]: value
            }
        }));
    };

    const calculateRow = (material) => {
        const m = measurements[material.id] || { x: '', y: '' };
        const x = parseFloat(m.x) || 0;
        const y = parseFloat(m.y) || 0;

        const areaM2 = (x * y) / 10000;
        const cost = areaM2 * material.pricePerM2;

        return { areaM2, cost };
    };

    // Unit material cost: qty * price
    const unitMaterialCostPerPiece = unitMaterials.reduce((sum, mat) => {
        const qty = parseFloat(unitQtys[mat.id]) || 0;
        return sum + qty * mat.price;
    }, 0);

    // Linear material cost: length (cm) / 100 * price
    const linearMaterialCostPerPiece = linearMaterials.reduce((sum, mat) => {
        const lengthCm = parseFloat(linearLengths[mat.id]) || 0;
        return sum + (lengthCm / 100) * mat.price;
    }, 0);

    // 1. Custo total de materiais para 1 peça
    const costPerPiece = sheetMaterials.reduce((sum, material) => {
        const { cost } = calculateRow(material);
        return sum + cost;
    }, 0) + unitMaterialCostPerPiece + linearMaterialCostPerPiece;

    // 2. Preço de venda unitário (Custo * Markup)
    const unitPrice = costPerPiece * (parseFloat(markup) || 1);

    // 3. Subtotal (Preço Unitário * Qtd Global)
    const subtotal = unitPrice * (parseFloat(globalQty) || 1);

    // 4. Adicionais
    const nfValue = includeNf ? subtotal * (parseFloat(nfPercentage) / 100) : 0;
    const taxValue = subtotal * (parseFloat(taxPercentage) / 100);

    // 5. Valor Final do Item Atual
    const currentItemPrice = subtotal + nfValue + taxValue;
    const baseUnitFinal = currentItemPrice / (parseFloat(globalQty) || 1);

    // O desconto em R$ abate do unitário final (afeta o carrinho e a base do %)
    const discountVal = parseFloat(discountValue) || 0;
    const rawUnitValue = Math.max(0, baseUnitFinal - discountVal);
    // Arredonda para 2 casas para bater exatamente na multiplicação pela quantidade
    const finalUnitWithValueDiscount = Math.round(rawUnitValue * 100) / 100;
    const finalTotalWithDiscount = finalUnitWithValueDiscount * (parseFloat(globalQty) || 1);

    // Custos Variáveis Unitários e Margem de Contribuição do Item
    const unitNfValue = includeNf ? (nfValue / (parseFloat(globalQty) || 1)) : 0;
    const unitTaxValue = taxValue / (parseFloat(globalQty) || 1);
    const contribMarginUnit = finalUnitWithValueDiscount - costPerPiece - unitNfValue - unitTaxValue;
    const contribMarginPerc = finalUnitWithValueDiscount > 0 ? (contribMarginUnit / finalUnitWithValueDiscount) * 100 : 0;

    // O desconto em % é apenas simulação visual sobre o unitário já com desconto em R$
    const discountPerc = parseFloat(discount) || 0;
    const rawVisualUnit = Math.max(0, finalUnitWithValueDiscount * (1 - (discountPerc / 100)));
    const visualUnitWithPercDiscount = Math.round(rawVisualUnit * 100) / 100;
    const visualTotalWithPercDiscount = visualUnitWithPercDiscount * (parseFloat(globalQty) || 1);

    // 6. Cálculos do Projeto (Múltiplos Itens)
    const projectSubtotal = budgetItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const projectTotal = projectSubtotal;

    const totalMaterialCost = budgetItems.reduce((sum, item) => sum + (item.unitMaterialCost * item.quantity), 0);
    const totalTaxAndNfCost = budgetItems.reduce((sum, item) => {
        const itemTax = (item.unitTaxValue || 0) + (item.unitNfValue || 0);
        return sum + (itemTax * item.quantity);
    }, 0);
    const totalProjectProfit = projectTotal - totalMaterialCost - totalTaxAndNfCost;

    const handleAddItem = () => {
        if (!itemName) {
            alert('Por favor, dê um nome ao item (ex: Medalha).');
            return;
        }
        if (costPerPiece <= 0) {
            alert('Insira medidas para calcular o valor do item.');
            return;
        }

        const newItem = {
            id: editingItemId || Date.now(),
            name: itemName,
            description: itemDescription,
            unitPrice: finalUnitWithValueDiscount,
            unitNfValue: nfValue / (parseFloat(globalQty) || 1),
            unitTaxValue: taxValue / (parseFloat(globalQty) || 1),
            unitMaterialCost: costPerPiece,
            quantity: parseFloat(globalQty) || 1,
            originalSubtotal: subtotal + nfValue + taxValue,
            measurements: { ...measurements },
            unitQtys: { ...unitQtys },
            linearLengths: { ...linearLengths },
            discount: discount,
            discountValue: discountValue,
            includeNf: includeNf
        };

        if (editingItemId) {
            setBudgetItems(prev => prev.map(item => item.id === editingItemId ? newItem : item));
            setEditingItemId(null);
        } else {
            setBudgetItems([...budgetItems, newItem]);
        }

        // Reset builder fields
        setMeasurements({});
        setUnitQtys({});
        setLinearLengths({});
        setItemName('');
        setItemDescription('');
        setGlobalQty('1');
        setDiscount('10');
        setDiscountValue('0');
        setIncludeNf(true);
        setIsAddingItem(false);
    };

    const handleEditItem = (item) => {
        setItemName(item.name);
        setItemDescription(item.description || '');
        setGlobalQty(item.quantity.toString());
        setMeasurements(item.measurements || {});
        setUnitQtys(item.unitQtys || {});
        setLinearLengths(item.linearLengths || {});
        setDiscount(item.discount || '10');
        setDiscountValue(item.discountValue || '0');
        setIncludeNf(item.includeNf !== undefined ? item.includeNf : true);
        setEditingItemId(item.id);
        setIsAddingItem(true);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelBuilder = () => {
        setMeasurements({});
        setUnitQtys({});
        setLinearLengths({});
        setItemName('');
        setItemDescription('');
        setGlobalQty('1');
        setDiscount('10');
        setDiscountValue('0');
        setIncludeNf(true);
        setEditingItemId(null);
        setIsAddingItem(false);
    };

    const handleRemoveItem = (id) => {
        if (window.confirm('Tem certeza que deseja excluir este item do orçamento?')) {
            setBudgetItems(budgetItems.filter(item => item.id !== id));
        }
    };

    const handleUpdateItemQty = (id, qty) => {
        setBudgetItems(budgetItems.map(item =>
            item.id === id ? { ...item, quantity: parseFloat(qty) || 0 } : item
        ));
    };

    const totalArea = sheetMaterials.reduce((sum, mat) => sum + calculateRow(mat).areaM2, 0);

    if (view === 'saved_list') {
        const getStatusColor = (status) => {
            switch (status) {
                case 'Aprovado': return 'bg-green-100 text-green-700 border-green-200';
                case 'Recusado': return 'bg-red-100 text-red-700 border-red-200';
                case 'Faturado': return 'bg-blue-100 text-blue-700 border-blue-200';
                default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            }
        };

        const DeliveryModal = () => {
            const [date, setDate] = React.useState(() => {
                // Pré-preenche com 10 dias úteis a partir de hoje
                const d = new Date();
                d.setDate(d.getDate() + 14);
                return d.toISOString().split('T')[0];
            });
            if (!deliveryModal) return null;
            return (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-indigo-600 px-6 py-5 text-white">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Calendar size={20} />
                                {deliveryModal.newStatus === 'Aprovado' ? 'Orçamento Aprovado' : 'Orçamento Faturado'}
                            </h3>
                            <p className="text-indigo-200 text-sm mt-1">Defina a data prevista de entrega para este pedido</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Data de Entrega</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-400 mt-1">Prazo padrão: 10 dias úteis (~14 dias corridos)</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setDeliveryModal(null)}
                                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleConfirmDelivery(date)}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Confirmar →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <>
                {isGeneratingPdf && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-4 text-white">
                        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-bold">Gerando e Enviando PDF</h3>
                            <p className="text-sm text-gray-300">Enviando orçamento para a nuvem. Por favor, aguarde...</p>
                        </div>
                    </div>
                )}
                <DeliveryModal />
                {renderPrintLayout()}
                <div className="max-w-6xl mx-auto p-4 md:p-8">
                <button
                    onClick={() => setView('budget')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mb-6"
                >
                    <ArrowLeft size={20} /> Voltar para Orçamento
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <List className="text-indigo-600" /> Meus Orçamentos
                            </h2>
                            <span className="text-sm text-gray-500 font-bold">{savedBudgets.length} salvos</span>
                        </div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente, data ou valor..."
                                value={budgetSearch}
                                onChange={e => setBudgetSearch(e.target.value)}
                                className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none shadow-sm transition-all placeholder-gray-400"
                            />
                            {budgetSearch && (
                                <button
                                    onClick={() => setBudgetSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Limpar busca"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                        {budgetSearch && (
                            <p className="mt-2 text-xs text-gray-400 font-medium">
                                {savedBudgets.filter(b => {
                                    const q = budgetSearch.toLowerCase();
                                    return (
                                        (b.clientData?.name || '').toLowerCase().includes(q) ||
                                        new Date(b.date).toLocaleDateString('pt-BR').includes(q) ||
                                        b.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).includes(q)
                                    );
                                }).length} resultado(s) encontrado(s)
                            </p>
                        )}
                    </div>

                    {savedBudgets.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            <List size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhum orçamento salvo ainda.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Data</th>
                                        <th className="px-6 py-4 font-bold">Cliente</th>
                                        <th className="px-6 py-4 font-bold text-center">Itens</th>
                                        <th className="px-6 py-4 font-bold text-right">Total</th>
                                        <th className="px-6 py-4 font-bold text-center">Status</th>
                                        <th className="px-6 py-4 font-bold text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {savedBudgets.filter(b => {
                                        if (!budgetSearch.trim()) return true;
                                        const q = budgetSearch.toLowerCase();
                                        return (
                                            (b.clientData?.name || '').toLowerCase().includes(q) ||
                                            new Date(b.date).toLocaleDateString('pt-BR').includes(q) ||
                                            b.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).includes(q)
                                        );
                                    }).map(budget => {
                                        const budgetDate = new Date(budget.date);
                                        const isCurrentMonth = budgetDate.getMonth() === new Date().getMonth() && budgetDate.getFullYear() === new Date().getFullYear();

                                        return (
                                            <tr key={budget.id} className={clsx(
                                                "transition-colors",
                                                isCurrentMonth ? "bg-green-50 hover:bg-green-100" : "hover:bg-gray-50"
                                            )}>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <div className="flex items-center gap-2">
                                                        {new Date(budget.date).toLocaleDateString()}
                                                        {isCurrentMonth && (
                                                            <span className="text-[9px] font-bold bg-green-500 text-white px-1 py-0.5 rounded uppercase tracking-tighter">
                                                                Mês Atual
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">{new Date(budget.date).toLocaleTimeString().slice(0, 5)}</div>
                                                </td>
                                                <td className={clsx(
                                                    "px-6 py-4 font-bold",
                                                    isCurrentMonth ? "text-green-800" : "text-gray-800"
                                                )}>{budget.clientData.name}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={clsx(
                                                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                                        isCurrentMonth ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {budget.items.length}
                                                    </span>
                                                </td>
                                                <td className={clsx(
                                                    "px-6 py-4 text-right font-bold",
                                                    isCurrentMonth ? "text-green-700" : "text-gray-800"
                                                )}>
                                                    {budget.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-1">
                                                        {['Aguardando', 'Aprovado', 'Recusado', 'Faturado'].map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleUpdateStatus(budget.id, status)}
                                                                className={clsx(
                                                                    "p-1.5 rounded-md transition-all",
                                                                    budget.status === status
                                                                        ? getStatusColor(status) + " ring-1 ring-offset-1 ring-gray-200 scale-110 shadow-sm"
                                                                        : "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                                                                )}
                                                                title={status}
                                                            >
                                                                {status === 'Aprovado' && <CheckCircle size={16} />}
                                                                {status === 'Recusado' && <XCircle size={16} />}
                                                                {status === 'Aguardando' && <Clock size={16} />}
                                                                {status === 'Faturado' && <Receipt size={16} />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className={clsx("text-[10px] font-bold mt-1 uppercase",
                                                        budget.status === 'Aprovado' ? 'text-green-600' :
                                                            budget.status === 'Recusado' ? 'text-red-500' :
                                                                budget.status === 'Faturado' ? 'text-blue-600' : 'text-yellow-600'
                                                    )}>
                                                        {budget.status}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleSendWhatsApp(budget)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Enviar pelo WhatsApp"
                                                        >
                                                            <WhatsAppIcon size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleLoadBudget(budget)}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Ver / Editar"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBudget(budget.id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

    if (view === 'register') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('budget')}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-2xl font-bold text-gray-800">Cadastro de Configurações e Materiais</h2>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <Settings size={16} /> Configurações Globais
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 flex items-center gap-2 uppercase">Adicional NF (%)</label>
                            <input
                                type="number"
                                value={nfPercentage}
                                onChange={e => setNfPercentage(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 flex items-center gap-2 uppercase">Taxa Parcelamento (%)</label>
                            <input
                                type="number"
                                value={taxPercentage}
                                onChange={e => setTaxPercentage(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={saveGlobalSettings}
                                disabled={readOnly}
                                className={`w-full xl:w-1/2 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 font-bold py-2 px-4 rounded-xl border border-indigo-200 transition-colors ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100'}`}
                            >
                                <Save size={18} /> Salvar Taxas Globais
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-sm border border-indigo-100 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                            <Percent size={16} /> Ajuste em Massa (%)
                        </h3>
                        <span className="text-xs font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-full shadow-sm border border-indigo-100 shrink-0 text-center">
                            {selectedMaterialIds.length} selecionado(s)
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-indigo-800 flex items-center gap-2 uppercase">Aumento / Desconto (%)</label>
                            <input
                                type="number" step="0.01"
                                placeholder="Ex: 15 (aumento) ou -10 (desconto)"
                                value={bulkPercent}
                                onChange={e => setBulkPercent(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={handleBulkPercentIncrease}
                                disabled={readOnly || selectedMaterialIds.length === 0 || !bulkPercent}
                                className={`w-full md:w-3/4 flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-xl transition-colors ${readOnly || selectedMaterialIds.length === 0 || !bulkPercent ? 'bg-indigo-100 text-indigo-300 border border-indigo-200 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'}`}
                            >
                                <CheckCircle size={18} /> Aplicar aos Selecionados
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── CHAPAS ──────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Chapas — por m²
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome do Material</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Acrílico 2mm"
                                    value={newMaterial.name}
                                    onChange={e => setNewMaterial({ ...newMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Largura (cm)</label>
                                    <input type="number" placeholder="200" value={newMaterial.width}
                                        onChange={e => setNewMaterial({ ...newMaterial, width: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Altura (cm)</label>
                                    <input type="number" placeholder="100" value={newMaterial.height}
                                        onChange={e => setNewMaterial({ ...newMaterial, height: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Preço da Chapa (R$)</label>
                                <input type="number" step="0.01" placeholder="0,00" value={newMaterial.price}
                                    onChange={e => setNewMaterial({ ...newMaterial, price: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                            </div>
                            {newMaterial.width && newMaterial.height && newMaterial.price && (
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Custo por m²</p>
                                    <p className="text-xl font-black text-indigo-700">
                                        {(parseFloat(newMaterial.price) / ((parseFloat(newMaterial.width) * parseFloat(newMaterial.height)) / 10000)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            )}
                            <button type="submit" disabled={readOnly} className={`w-full py-3 bg-indigo-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}>
                                <Plus size={20} /> Cadastrar Chapa
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 w-10 text-center">
                                            <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded cursor-pointer" 
                                                checked={sheetMaterials.length > 0 && sheetMaterials.every(m => selectedMaterialIds.includes(m.id))}
                                                onChange={e => {
                                                    const allIds = sheetMaterials.map(m => m.id);
                                                    if (e.target.checked) {
                                                        setSelectedMaterialIds(prev => [...new Set([...prev, ...allIds])]);
                                                    } else {
                                                        setSelectedMaterialIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-center">Chapa (cm)</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço/m²</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sheetMaterials.map(m => (
                                        <tr key={m.id} className={`hover:bg-gray-50/50 group ${selectedMaterialIds.includes(m.id) ? 'bg-indigo-50/40' : ''}`}>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded cursor-pointer" checked={selectedMaterialIds.includes(m.id)} onChange={() => toggleMaterialSelection(m.id)} />
                                            </td>
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex gap-1 justify-center items-center">
                                                            <input type="number" value={editMaterialData.width} onChange={e => setEditMaterialData({ ...editMaterialData, width: e.target.value })} className="w-12 px-1 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-center" />
                                                            <span className="text-gray-400">x</span>
                                                            <input type="number" value={editMaterialData.height} onChange={e => setEditMaterialData({ ...editMaterialData, height: e.target.value })} className="w-12 px-1 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-center" />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-24 px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm font-bold text-indigo-600 text-right" />
                                                            <div className="flex items-center gap-1" title="Digite o % e tecle Enter">
                                                                <span className="text-[9px] font-bold text-indigo-400 uppercase">+ %</span>
                                                                <input type="number" placeholder="ex: 15" className="w-14 px-1 py-0.5 border border-indigo-100 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            const percent = parseFloat(e.target.value);
                                                                            if(percent && !isNaN(percent)) {
                                                                                const newPrice = parseFloat(editMaterialData.price || 0) * (1 + (percent/100));
                                                                                setEditMaterialData({...editMaterialData, price: newPrice.toFixed(2)});
                                                                                e.target.value = '';
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-gray-500">{m.width}x{m.height}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
                                                        {m.pricePerM2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} disabled={readOnly} className={`p-1 ${readOnly ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600'}`} title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} disabled={readOnly} className={`p-1 ${readOnly ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600'}`} title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} disabled={readOnly} className={`p-1 ${readOnly ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600'}`} title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteMaterial(m.id)} disabled={readOnly} className={`p-2 ${readOnly ? 'opacity-30 cursor-not-allowed' : 'text-gray-300 hover:text-red-500'} transition-colors`} title="Excluir"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {sheetMaterials.length === 0 && (
                                        <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400 italic">Nenhuma chapa cadastrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── POR UNIDADE ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddUnitMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
                            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Material — por Unidade
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Pino metálico"
                                    value={newUnitMaterial.name}
                                    onChange={e => setNewUnitMaterial({ ...newUnitMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Valor por Unidade (R$)</label>
                                <input
                                    type="number" step="0.01" placeholder="0,00"
                                    value={newUnitMaterial.pricePerUnit}
                                    onChange={e => setNewUnitMaterial({ ...newUnitMaterial, pricePerUnit: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                                <Plus size={20} /> Cadastrar
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 w-10 text-center">
                                            <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded cursor-pointer" 
                                                checked={unitMaterials.length > 0 && unitMaterials.every(m => selectedMaterialIds.includes(m.id))}
                                                onChange={e => {
                                                    const allIds = unitMaterials.map(m => m.id);
                                                    if (e.target.checked) {
                                                        setSelectedMaterialIds(prev => [...new Set([...prev, ...allIds])]);
                                                    } else {
                                                        setSelectedMaterialIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço / Unidade</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {unitMaterials.map(m => (
                                        <tr key={m.id} className={`hover:bg-gray-50/50 group ${selectedMaterialIds.includes(m.id) ? 'bg-emerald-50/40' : ''}`}>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded cursor-pointer" checked={selectedMaterialIds.includes(m.id)} onChange={() => toggleMaterialSelection(m.id)} />
                                            </td>
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-24 px-2 py-1 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm font-bold text-emerald-600 text-right" />
                                                            <div className="flex items-center gap-1" title="Digite o % e tecle Enter">
                                                                <span className="text-[9px] font-bold text-emerald-400 uppercase">+ %</span>
                                                                <input type="number" placeholder="ex: 15" className="w-14 px-1 py-0.5 border border-emerald-100 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-300" 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            const percent = parseFloat(e.target.value);
                                                                            if(percent && !isNaN(percent)) {
                                                                                const newPrice = parseFloat(editMaterialData.price || 0) * (1 + (percent/100));
                                                                                setEditMaterialData({...editMaterialData, price: newPrice.toFixed(2)});
                                                                                e.target.value = '';
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                        {m.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} className="p-1 text-gray-400 hover:text-emerald-600" title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} className="p-1 text-gray-400 hover:text-emerald-600" title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-emerald-600" title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteUnitMaterial(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {unitMaterials.length === 0 && (
                                        <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400 italic">Nenhum material por unidade cadastrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── POR METRO LINEAR ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddLinearMaterial} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 space-y-4">
                            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} /> Material — por Metro Linear
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Perfil de alumínio"
                                    value={newLinearMaterial.name}
                                    onChange={e => setNewLinearMaterial({ ...newLinearMaterial, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Valor por Metro Linear (R$)</label>
                                <input
                                    type="number" step="0.01" placeholder="0,00"
                                    value={newLinearMaterial.pricePerMeter}
                                    onChange={e => setNewLinearMaterial({ ...newLinearMaterial, pricePerMeter: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-100 flex items-center justify-center gap-2">
                                <Plus size={20} /> Cadastrar
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 w-10 text-center">
                                            <input type="checkbox" className="w-4 h-4 text-amber-600 rounded cursor-pointer" 
                                                checked={linearMaterials.length > 0 && linearMaterials.every(m => selectedMaterialIds.includes(m.id))}
                                                onChange={e => {
                                                    const allIds = linearMaterials.map(m => m.id);
                                                    if (e.target.checked) {
                                                        setSelectedMaterialIds(prev => [...new Set([...prev, ...allIds])]);
                                                    } else {
                                                        setSelectedMaterialIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Preço / Metro Linear</th>
                                        <th className="px-6 py-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {linearMaterials.map(m => (
                                        <tr key={m.id} className={`hover:bg-gray-50/50 group ${selectedMaterialIds.includes(m.id) ? 'bg-amber-50/40' : ''}`}>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" className="w-4 h-4 text-amber-600 rounded cursor-pointer" checked={selectedMaterialIds.includes(m.id)} onChange={() => toggleMaterialSelection(m.id)} />
                                            </td>
                                            {editingMaterialId === m.id ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <input type="text" value={editMaterialData.name} onChange={e => setEditMaterialData({ ...editMaterialData, name: e.target.value })} className="w-full px-2 py-1 border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm font-bold text-gray-700" />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <input type="number" step="0.01" value={editMaterialData.price} onChange={e => setEditMaterialData({ ...editMaterialData, price: e.target.value })} className="w-24 px-2 py-1 border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm font-bold text-amber-600 text-right" />
                                                            <div className="flex items-center gap-1" title="Digite o % e tecle Enter">
                                                                <span className="text-[9px] font-bold text-amber-400 uppercase">+ %</span>
                                                                <input type="number" placeholder="ex: 15" className="w-14 px-1 py-0.5 border border-amber-100 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-amber-300" 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            const percent = parseFloat(e.target.value);
                                                                            if(percent && !isNaN(percent)) {
                                                                                const newPrice = parseFloat(editMaterialData.price || 0) * (1 + (percent/100));
                                                                                setEditMaterialData({...editMaterialData, price: newPrice.toFixed(2)});
                                                                                e.target.value = '';
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleSaveEdit(m)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Salvar"><CheckCircle size={18} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 font-bold text-gray-700">{m.name}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-amber-600">
                                                        {m.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'up')} className="p-1 text-gray-400 hover:text-amber-600" title="Subir"><ChevronUp size={18} /></button>
                                                            <button type="button" onClick={() => handleMoveMaterial(m.id, 'down')} className="p-1 text-gray-400 hover:text-amber-600" title="Descer"><ChevronDown size={18} /></button>
                                                            <button type="button" onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-amber-600" title="Editar"><Pencil size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteLinearMaterial(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {linearMaterials.length === 0 && (
                                        <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400 italic">Nenhum material por metro linear cadastrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {isGeneratingPdf && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-4 text-white">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-bold">Gerando e Enviando PDF</h3>
                        <p className="text-sm text-gray-300">Enviando orçamento para a nuvem. Por favor, aguarde...</p>
                    </div>
                </div>
            )}
            {/* Print Layout - A4 Optimized */}
            <style>
                {`
                    @media print {
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            margin: 0;
                            background-color: white !important;
                            color: #334155;
                        }
                        #root {
                            background-color: transparent !important;
                        }
                        .print-page {
                            width: 210mm;
                            min-height: 297mm;
                            max-height: 297mm;
                            overflow: hidden;
                            padding: 12mm 15mm;
                            box-sizing: border-box;
                            page-break-after: always;
                            break-after: page;
                            display: flex;
                            flex-direction: column;
                        }
                        .print-page:last-child {
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                        .print-image-page {
                            width: 210mm;
                            min-height: 297mm;
                            max-height: 297mm;
                            padding: 12mm 15mm;
                            box-sizing: border-box;
                            page-break-after: always;
                            break-after: page;
                            display: flex;
                            flex-direction: column;
                        }
                        .print-image-page:last-child {
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                    }
                    .print-table th, .print-table td {
                        border-bottom: 0.5pt solid #e2e8f0;
                        padding: 7px 4px;
                        border-left: none;
                        border-right: none;
                        border-top: none;
                    }
                    .print-table th {
                        border-bottom: 1pt solid #0f172a;
                        color: #475569;
                    }
                    .print-table {
                        border-collapse: collapse;
                        width: 100%;
                    }
                    .section-title {
                        font-size: 8px;
                        font-weight: 800;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        margin-bottom: 6px;
                        border-bottom: 0.5pt solid #cbd5e1;
                        padding-bottom: 3px;
                    }
                    .page-number {
                        margin-top: auto;
                        text-align: right;
                        font-size: 8px;
                        color: #94a3b8;
                        font-weight: 700;
                    }
                `}
            </style>
            {renderPrintLayout()}

            {/* Application UI */}
            <div className="space-y-6 pb-20 print:hidden">
                {!isAddingItem ? (
                    <>
                        {/* Client Data Form */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-300">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <User size={16} /> Dados do Cliente (Para Impressão)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    placeholder="Nome Completo"
                                    value={clientData.name}
                                    onChange={e => setClientData({ ...clientData, name: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="CPF / CNPJ"
                                    value={clientData.doc}
                                    onChange={e => setClientData({ ...clientData, doc: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Telefone"
                                    value={clientData.phone}
                                    onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Endereço"
                                    value={clientData.address}
                                    onChange={e => setClientData({ ...clientData, address: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Cidade"
                                    value={clientData.city}
                                    onChange={e => setClientData({ ...clientData, city: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="CEP"
                                    value={clientData.zip}
                                    onChange={e => setClientData({ ...clientData, zip: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Número"
                                    value={clientData.number}
                                    onChange={e => setClientData({ ...clientData, number: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Bairro"
                                    value={clientData.neighborhood}
                                    onChange={e => setClientData({ ...clientData, neighborhood: e.target.value })}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                <input
                                    type="email"
                                    placeholder="E-mail"
                                    value={clientData.email}
                                    onChange={e => setClientData({ ...clientData, email: e.target.value })}
                                    className="lg:col-span-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Top action bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                    <Receipt size={24} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">Orçamento Atual</h2>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setView('saved_list')}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                                >
                                    <List size={18} /> Orçamentos Prontos
                                </button>
                                <button
                                    onClick={() => setView('register')}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    <Settings size={18} /> Cadastro de Materiais
                                </button>
                            </div>
                        </div>

                        {/* Budget items or Empty state */}
                        {budgetItems.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-gray-200 rounded-3xl text-center bg-gray-50/30 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                                <Package size={48} className="text-gray-300" />
                                <p className="text-gray-500 font-medium">Nenhum item adicionado a este orçamento ainda.</p>
                                <button
                                    onClick={() => setIsAddingItem(true)}
                                    className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-base font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 transform hover:scale-[1.02]"
                                >
                                    <Plus size={20} /> ADICIONAR PRIMEIRO ITEM
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-end animate-in fade-in duration-300">
                                    <button
                                        onClick={() => setIsAddingItem(true)}
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
                                    >
                                        <Plus size={18} /> ADICIONAR MAIS ITENS
                                    </button>
                                </div>

                                {/* Final Budget Items Table */}
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <Receipt size={20} className="text-indigo-600" /> Itens do Orçamento
                                        </h3>
                                        <div className="bg-indigo-50 px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100">
                                            {budgetItems.length} {budgetItems.length === 1 ? 'Item' : 'Itens'}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Item</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-center">Quantidade</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Unitário (c/ encargos)</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total Item</th>
                                                    <th className="px-6 py-4 text-center w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {budgetItems.map(item => (
                                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => handleEditItem(item)}>
                                                        <td className="px-6 py-4 text-gray-700">
                                                            <div className="font-bold">{item.name}</div>
                                                            {item.description && (
                                                                <div className="text-xs text-gray-400 font-normal mt-0.5 line-clamp-2 whitespace-pre-line">
                                                                    {item.description}
                                                                </div>
                                                            )}
                                                            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded-md border border-indigo-100/30 shadow-sm">
                                                                <TrendingUp size={10} className="text-indigo-500" />
                                                                Margem: {(() => {
                                                                    const itemNf = item.includeNf !== false ? (item.unitNfValue || 0) : 0;
                                                                    const itemMarginUnit = item.unitPrice - item.unitMaterialCost - itemNf - (item.unitTaxValue || 0);
                                                                    const itemMarginPerc = item.unitPrice > 0 ? (itemMarginUnit / item.unitPrice) * 100 : 0;
                                                                    return itemMarginPerc.toFixed(1);
                                                                })()}%
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={e => handleUpdateItemQty(item.id, e.target.value)}
                                                                className="w-20 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                            {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-indigo-600 text-lg">
                                                            {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </td>
                                                        <td className="px-6 py-4 text-center flex justify-center items-center gap-2" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleEditItem(item)}
                                                                className="p-2 text-gray-300 hover:text-indigo-500 transition-colors"
                                                                title="Editar item"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                                title="Remover item"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-white">
                                                <tr>
                                                    <td colSpan="5" className="p-0 border-t border-gray-100">
                                                        <div className="bg-indigo-600 p-8 text-white w-full rounded-b-2xl shadow-inner flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                            <div className="text-center md:text-left">
                                                                <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Valor Total do Pedido</p>
                                                                <h2 className="text-5xl md:text-6xl font-black mt-2">
                                                                    {projectTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </h2>
                                                                <div className="flex flex-wrap gap-4 mt-6">
                                                                    <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                        <p className="text-[10px] text-indigo-200 uppercase font-black">Total Mat. Gasto</p>
                                                                        <p className="text-lg font-bold text-white">
                                                                            {totalMaterialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-black/20 px-4 py-2 rounded-xl">
                                                                        <p className="text-[10px] text-indigo-200 uppercase font-black">Impostos / NF</p>
                                                                        <p className="text-lg font-bold text-white">
                                                                            {totalTaxAndNfCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-white/20 px-4 py-2 rounded-xl border border-indigo-400/30">
                                                                        <p className="text-[10px] text-indigo-100 uppercase font-black">Margem Total (R$)</p>
                                                                        <p className="text-lg font-bold text-green-300">
                                                                            {totalProjectProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-white/20 px-4 py-2 rounded-xl border border-indigo-400/30">
                                                                        <p className="text-[10px] text-indigo-100 uppercase font-black">Margem Total (%)</p>
                                                                        <p className="text-lg font-bold text-green-300">
                                                                            {(projectTotal > 0 ? (totalProjectProfit / projectTotal) * 100 : 0).toFixed(1)}%
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-3">
                                                                <button
                                                                    onClick={handleSaveBudget}
                                                                    className="w-full px-8 py-4 bg-green-500 text-white rounded-2xl text-lg font-bold shadow-[0_10px_20px_rgba(34,197,94,0.3)] hover:bg-green-600 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                                                                >
                                                                    <Save size={24} /> SALVAR ORÇAMENTO
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSendWhatsApp()}
                                                                    className="w-full px-8 py-3 bg-[#25D366] text-white rounded-xl text-sm font-bold shadow hover:bg-[#20ba56] transition-all flex items-center justify-center gap-2 border border-[#20ba56] hover:shadow-md"
                                                                >
                                                                    <WhatsAppIcon size={20} /> ENVIAR P/ WHATSAPP
                                                                </button>
                                                                <button
                                                                    onClick={() => window.print()}
                                                                    className="w-full px-8 py-3 bg-white text-indigo-900 rounded-xl text-sm font-bold shadow hover:bg-gray-100 transition-all flex items-center justify-center gap-2 border border-gray-200 hover:shadow-md"
                                                                >
                                                                    <DollarSign size={20} /> IMPRIMIR PDF / RECIBO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                {/* IMAGE ATTACHMENTS UI */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-300">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Anexos (Para Impressão)</h3>
                                    <div className="flex flex-col gap-4">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            multiple 
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                files.forEach(file => {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        setAttachedImages(prev => [
                                                            ...prev, 
                                                            { id: Math.random().toString(36).substr(2, 9), dataUrl: event.target.result, name: file.name }
                                                        ]);
                                                    };
                                                    reader.readAsDataURL(file);
                                                });
                                            }}
                                            className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-indigo-50 file:text-indigo-700
                                            hover:file:bg-indigo-100 transition-colors cursor-pointer"
                                        />
                                        
                                        {attachedImages.length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                {attachedImages.map((img, idx) => (
                                                    <div key={img.id} className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                                        <img src={img.dataUrl} alt="Anexo" className="w-full h-32 object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button 
                                                                onClick={() => setAttachedImages(prev => prev.filter(i => i.id !== img.id))}
                                                                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        <div className="p-2 text-[10px] text-center text-gray-500 truncate font-medium">
                                                            {img.name || `Imagem ${idx + 1}`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Builder Header Bar */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCancelBuilder}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                                    title="Voltar"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {editingItemId ? 'Editar Item do Orçamento' : 'Novo Item do Orçamento'}
                                </h2>
                            </div>
                            <button
                                onClick={handleCancelBuilder}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Voltar / Cancelar
                            </button>
                        </div>

                        {/* Item settings grid */}
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 animate-in fade-in duration-300">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2 md:col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Package size={14} className="text-indigo-500" /> Nome e Descrição do Item
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Medalha"
                                    value={itemName}
                                    onChange={e => setItemName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700 mb-2"
                                />
                                <textarea
                                    placeholder="Descrição:&#10;- Em acrílico 2mm&#10;- Medida de 10x10cm"
                                    value={itemDescription}
                                    onChange={e => setItemDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-600 resize-y"
                                />
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Plus size={14} className="text-indigo-500" /> Qtd Item
                                </label>
                                <input
                                    type="number"
                                    value={globalQty}
                                    onChange={e => setGlobalQty(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                                />
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp size={14} className="text-orange-500" /> Multiplicador
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={markup}
                                    onChange={e => setMarkup(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                                />
                            </div>
                            {/* Checkbox NF toggle */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <FileText size={14} className="text-indigo-500" /> Adicional de NF
                                </label>
                                <div className="flex items-center gap-3 mt-2">
                                    <input
                                        type="checkbox"
                                        id="includeNf"
                                        checked={includeNf}
                                        onChange={e => setIncludeNf(e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <label htmlFor="includeNf" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                                        Cobrar NF (+{nfPercentage}%)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Budget Spreadsheet Table */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300">
                            {[
                                [...orderedMaterials].slice(0, Math.ceil(orderedMaterials.length / 2)),
                                [...orderedMaterials].slice(Math.ceil(orderedMaterials.length / 2))
                            ].map((colMaterials, colIdx) => (
                                <div key={`col-${colIdx}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden self-start">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-indigo-600 text-white">
                                                <th className="px-3 py-1.5 text-[11px] font-bold uppercase" rowSpan="2">Serviços / Materiais</th>
                                                <th className="px-2 py-1.5 text-[10px] font-bold uppercase text-center border-l border-indigo-500" colSpan="2">Centímetros</th>
                                                <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-right border-l border-indigo-500 pr-4" rowSpan="2">Custo (1 pç)</th>
                                            </tr>
                                            <tr className="bg-indigo-50 text-indigo-900 border-b border-indigo-100">
                                                <th className="px-1 py-1 text-[9px] font-bold uppercase text-center border-l border-gray-200 w-1/5">x</th>
                                                <th className="px-1 py-1 text-[9px] font-bold uppercase text-center border-l border-gray-200 w-1/5">y</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {colMaterials.map(mat => {
                                                if (!mat.type || mat.type === 'sheet') {
                                                    const { areaM2, cost } = calculateRow(mat);
                                                    const m = measurements[mat.id] || { x: '', y: '' };
                                                    return (
                                                        <tr key={mat.id} className="hover:bg-indigo-50/30 transition-colors">
                                                            <td className="px-3 py-1 text-[11px] font-bold text-gray-700 bg-gray-50/50">{mat.name}</td>
                                                            <td className="px-1 py-1 border-l border-gray-100">
                                                                <input type="number" value={m.x} onChange={e => handleMeasurementChange(mat.id, 'x', e.target.value)}
                                                                    placeholder="0" className="w-full px-1 py-0.5 text-center text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none" />
                                                            </td>
                                                            <td className="px-1 py-1 border-l border-gray-100">
                                                                <input type="number" value={m.y} onChange={e => handleMeasurementChange(mat.id, 'y', e.target.value)}
                                                                    placeholder="0" className="w-full px-1 py-0.5 text-center text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none" />
                                                            </td>
                                                            <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-gray-800 text-[11px] pr-4">
                                                                {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </td>
                                                        </tr>
                                                    );
                                                } else if (mat.type === 'unit') {
                                                    const qty = parseFloat(unitQtys[mat.id]) || 0;
                                                    const cost = qty * mat.price;
                                                    return (
                                                        <tr key={mat.id} className="hover:bg-emerald-50/30 transition-colors">
                                                            <td className="px-3 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50/30">
                                                                {mat.name} <span className="text-[9px] font-normal text-emerald-500 ml-1">(unid)</span>
                                                            </td>
                                                            <td className="px-1 py-1 border-l border-gray-100" colSpan="2">
                                                                <input type="number" value={unitQtys[mat.id] || ''}
                                                                    onChange={e => setUnitQtys(prev => ({ ...prev, [mat.id]: e.target.value }))}
                                                                    placeholder="Qtd" className="w-full px-1 py-0.5 text-center text-[11px] border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-400 outline-none" />
                                                            </td>
                                                            <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-emerald-700 text-[11px] pr-4">
                                                                {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </td>
                                                        </tr>
                                                    );
                                                } else {
                                                    const lengthCm = parseFloat(linearLengths[mat.id]) || 0;
                                                    const cost = (lengthCm / 100) * mat.price;
                                                    return (
                                                        <tr key={mat.id} className="hover:bg-amber-50/30 transition-colors">
                                                            <td className="px-3 py-1 text-[11px] font-bold text-amber-700 bg-amber-50/30">
                                                                {mat.name} <span className="text-[9px] font-normal text-amber-500 ml-1">(m linear)</span>
                                                            </td>
                                                            <td className="px-1 py-1 border-l border-gray-100" colSpan="2">
                                                                <input type="number" value={linearLengths[mat.id] || ''}
                                                                    onChange={e => setLinearLengths(prev => ({ ...prev, [mat.id]: e.target.value }))}
                                                                    placeholder="Comp(cm)" className="w-full px-1 py-0.5 text-center text-[11px] border border-amber-200 rounded focus:ring-1 focus:ring-amber-400 outline-none" />
                                                            </td>
                                                            <td className="px-3 py-1 border-l border-gray-100 text-right font-bold text-amber-700 text-[11px] pr-4">
                                                                {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            })}
                                            {colMaterials.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="px-3 py-6 text-[11px] text-center text-gray-400 italic">
                                                        Nenhum material localizado.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 flex justify-between items-center shadow-sm animate-in fade-in duration-300">
                            <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Total Custos Por Item (1 Unid.)</span>
                            <span className="text-xl font-black text-indigo-700">
                                {costPerPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>

                        {!costPerPiece && materials.length > 0 && (
                            <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center bg-gray-50/30 mt-4 animate-in fade-in duration-300">
                                <p className="text-gray-400 font-medium">Insira as medidas/quantidades nos materiais acima para calcular o valor do item.</p>
                            </div>
                        )}

                        {/* Finance Card and Action Buttons */}
                        {costPerPiece > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4 animate-in fade-in duration-300">
                                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Resumo do Item Atual</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase border-b pb-2 mb-2">
                                            <span className="w-1/3">Descrição</span>
                                            <span className="w-1/3 text-center">Unitário</span>
                                            <span className="w-1/3 text-right">Total</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Custo Material:</span>
                                            <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{costPerPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="w-1/3 text-right font-bold text-gray-700">{(costPerPiece * (parseFloat(globalQty) || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                        {includeNf && (
                                            <div className="flex justify-between items-center text-[13px]">
                                                <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Adicional NF ({nfPercentage}%):</span>
                                                <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice * (parseFloat(nfPercentage) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                <span className="w-1/3 text-right font-bold text-red-500">+{nfValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Parcelam. ({taxPercentage}%):</span>
                                            <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice * (parseFloat(taxPercentage) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="w-1/3 text-right font-bold text-red-500">+{taxValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="w-1/3 text-gray-500 uppercase text-[10px] font-bold truncate pr-1">Lucro Estimado:</span>
                                            <span className="w-1/3 text-center font-medium text-gray-500 text-xs">{(unitPrice - costPerPiece).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="w-1/3 text-right font-bold text-green-600">
                                                {(subtotal - (costPerPiece * (parseFloat(globalQty) || 1))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>

                                        {/* EXIBIÇÃO DA MARGEM DE CONTRIBUIÇÃO (%) */}
                                        <div className="flex justify-between items-center text-[13px] bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                                            <span className="w-1/2 text-indigo-700 uppercase text-[10px] font-black truncate pr-1 flex items-center gap-1">
                                                <TrendingUp size={12} className="text-indigo-500" /> MARGEM CONTRIBUIÇÃO:
                                            </span>
                                            <span className="w-1/2 text-right font-black text-indigo-700 text-sm">
                                                {contribMarginPerc.toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-[13px] bg-gray-50 p-2 rounded-lg mt-1 border border-gray-100">
                                            <span className="w-1/3 text-indigo-700 uppercase text-[10px] font-black truncate pr-1">UNITÁRIO FINAL:</span>
                                            <span className="w-1/3 text-center font-bold text-indigo-600">{finalUnitWithValueDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="w-1/3 text-right font-black text-indigo-700 text-[15px]">
                                                {finalTotalWithDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>

                                        {parseFloat(discount) > 0 && (
                                            <div className="flex justify-between items-center text-[13px] bg-green-50 p-2 rounded-lg mt-1 border border-green-100">
                                                <span className="w-1/3 text-green-700 uppercase text-[10px] font-black truncate pr-1">SIMULAÇÃO ({discount}%):</span>
                                                <span className="w-1/3 text-center font-bold text-green-600">
                                                    {visualUnitWithPercDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                                <span className="w-1/3 text-right font-black text-green-700 text-[15px]">
                                                    {visualTotalWithPercDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="h-px bg-gray-100 mt-2"></div>
                                        <div className="flex justify-between items-center py-1 mt-2">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Quantidade do Item:</span>
                                            <input
                                                type="number"
                                                value={globalQty}
                                                onChange={e => setGlobalQty(e.target.value)}
                                                className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                                min="1"
                                            />
                                        </div>
                                        <div className="h-px bg-gray-100 italic font-medium text-[9px] text-gray-400 text-center py-2 mt-2">Aplicação de Desconto</div>
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Percent size={12} className="text-red-500" /> Desconto (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={discount}
                                                    onChange={e => setDiscount(e.target.value)}
                                                    className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-right text-xs font-bold text-gray-700 focus:ring-2 focus:ring-red-400 outline-none shadow-sm"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <DollarSign size={12} className="text-red-500" /> Desconto (R$)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={discountValue}
                                                    step="0.01"
                                                    onChange={e => setDiscountValue(e.target.value)}
                                                    className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-right text-xs font-bold text-gray-700 focus:ring-2 focus:ring-red-400 outline-none shadow-sm"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 flex flex-col justify-center items-center gap-4 p-4 md:p-8">
                                    <button
                                        onClick={handleAddItem}
                                        className="w-full md:w-2/3 lg:w-1/2 py-5 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 transform hover:scale-[1.02] border-2 border-indigo-500/20"
                                    >
                                        {editingItemId ? <Save size={24} /> : <Plus size={24} />}
                                        {editingItemId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR AO ORÇAMENTO'}
                                    </button>
                                    <button
                                        onClick={handleCancelBuilder}
                                        className="w-full md:w-2/3 lg:w-1/2 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-bold transition-colors text-center shadow-sm hover:shadow-md"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div >
        </>
    );
};

export default Orcamentos;
