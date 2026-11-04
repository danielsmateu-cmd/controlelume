import React, { useState, useEffect } from 'react';
import { shopeeAuth, shopeeConfig } from '../../services/shopeeApi';
import { RefreshCw, Link2, Wifi, WifiOff, CheckCircle2, ShieldCheck, Key, Save, AlertCircle, ExternalLink } from 'lucide-react';

export default function ShopeeIntegracao({ readOnly = false }) {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tokens, setTokens] = useState(null);

    // Credenciais
    const [creds, setCreds] = useState({ partner_id: '', partner_key: '', redirect_uri: '' });
    const [savingCreds, setSavingCreds] = useState(false);
    const [credsSaved, setCredsSaved] = useState(false);

    // Troca manual de URL / Código
    const [pasteUrl, setPasteUrl] = useState('');
    const [exchanging, setExchanging] = useState(false);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        try {
            // 1. Carrega credenciais salvas
            const currentCreds = await shopeeConfig.getCredentials();
            setCreds(currentCreds);

            // 2. Verifica se houve callback de autorização na URL (?code=...&shop_id=...)
            await handleCallbackIfNeeded();

            // 3. Verifica status da conexão
            await checkConnection();
        } catch (err) {
            console.error('Erro ao inicializar ShopeeIntegracao:', err);
        } finally {
            setLoading(false);
        }
    };

    const checkConnection = async () => {
        try {
            const isConn = await shopeeAuth.isConnected();
            setConnected(isConn);
            if (isConn) {
                const tokenData = await shopeeAuth.getTokens();
                setTokens(tokenData);
            } else {
                setTokens(null);
            }
        } catch (err) {
            console.error('Erro ao verificar conexão Shopee:', err);
            setConnected(false);
        }
    };

    const handleCallbackIfNeeded = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const shopId = urlParams.get('shop_id');

        if (code && shopId) {
            setExchanging(true);
            const res = await shopeeAuth.exchangeCode(code, shopId);
            if (res.success) {
                // Limpa os parâmetros da URL
                window.history.replaceState({}, '', window.location.pathname);
                await checkConnection();
            } else {
                alert('Erro ao autorizar Shopee: ' + (res.error || 'Código inválido'));
            }
            setExchanging(false);
        }
    };

    const handleSaveCreds = async (e) => {
        e.preventDefault();
        if (!creds.partner_id || !creds.partner_key) {
            alert('Por favor, preencha o Partner ID e o Partner Key.');
            return;
        }

        setSavingCreds(true);
        try {
            await shopeeConfig.saveCredentials(creds);
            setCredsSaved(true);
            setTimeout(() => setCredsSaved(false), 3000);
        } catch (err) {
            alert('Erro ao salvar credenciais: ' + err.message);
        } finally {
            setSavingCreds(false);
        }
    };

    const handleConnect = async () => {
        try {
            const url = await shopeeAuth.getAuthUrl();
            window.location.href = url;
        } catch (err) {
            alert(err.message || 'Erro ao gerar URL de conexão da Shopee.');
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Deseja realmente desconectar a integração com a Shopee?')) return;
        setLoading(true);
        try {
            await shopeeAuth.disconnect();
            await checkConnection();
        } catch (err) {
            alert('Erro ao desconectar.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualExchange = async () => {
        if (!pasteUrl.trim()) {
            alert('Cole a URL de redirecionamento ou o código.');
            return;
        }

        setExchanging(true);
        try {
            let code = '';
            let shopId = '';

            if (pasteUrl.includes('code=') && pasteUrl.includes('shop_id=')) {
                const urlObj = new URL(pasteUrl);
                code = urlObj.searchParams.get('code');
                shopId = urlObj.searchParams.get('shop_id');
            } else {
                code = pasteUrl.trim();
            }

            if (!code) {
                alert('Código não encontrado na URL.');
                setExchanging(false);
                return;
            }

            const res = await shopeeAuth.exchangeCode(code, shopId);
            if (res.success) {
                setPasteUrl('');
                await checkConnection();
                alert('Shopee conectada com sucesso!');
            } else {
                alert('Erro ao vincular Shopee: ' + (res.error || 'Código inválido'));
            }
        } catch (err) {
            alert('URL inválida: ' + err.message);
        } finally {
            setExchanging(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header de Status */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                        {connected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-gray-900">Integração Oficial Shopee API</h2>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                {connected ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Conectado
                                    </>
                                ) : (
                                    'Desconectado'
                                )}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {connected 
                                ? `Loja Shopee ID: ${tokens?.ml_user_id || 'Ativo'} • Sincronização 1-clique liberada` 
                                : 'Conecte sua conta de desenvolvedor da Shopee para sincronizar pedidos em 1 clique.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {connected ? (
                        <button
                            onClick={handleDisconnect}
                            disabled={readOnly || loading}
                            className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Desconectar
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={readOnly || loading || !creds.partner_id || !creds.partner_key}
                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
                        >
                            <Link2 className="w-4 h-4" />
                            <span>Conectar Loja Shopee</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Configuração das Credenciais da Shopee Open Platform */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-orange-500" />
                        <h3 className="text-sm font-bold text-gray-800">Credenciais da Shopee Open Platform</h3>
                    </div>
                    {credsSaved && (
                        <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Credenciais salvas com sucesso!
                        </span>
                    )}
                </div>

                <p className="text-xs text-gray-500 mb-4">
                    Insira abaixo o <strong>Partner ID</strong> e o <strong>Partner Key</strong> que a Shopee gerou no seu painel de desenvolvedor (<a href="https://open.shopee.com/console" target="_blank" rel="noreferrer" className="text-orange-600 hover:underline font-bold inline-flex items-center gap-0.5">open.shopee.com/console <ExternalLink className="w-3 h-3" /></a>):
                </p>

                <form onSubmit={handleSaveCreds} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Partner ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: 1002345 (número gerado pela Shopee)"
                            value={creds.partner_id}
                            onChange={(e) => setCreds({ ...creds, partner_id: e.target.value })}
                            readOnly={readOnly}
                            className="w-full text-xs font-mono font-semibold px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none bg-gray-50/50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Partner Key <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            placeholder="Chave secreta gerada pela Shopee"
                            value={creds.partner_key}
                            onChange={(e) => setCreds({ ...creds, partner_key: e.target.value })}
                            readOnly={readOnly}
                            className="w-full text-xs font-mono font-semibold px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none bg-gray-50/50"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Redirect URI (URL de Redirecionamento configurada na Shopee)
                        </label>
                        <input
                            type="text"
                            value={creds.redirect_uri}
                            onChange={(e) => setCreds({ ...creds, redirect_uri: e.target.value })}
                            readOnly={readOnly}
                            className="w-full text-xs text-gray-600 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none bg-gray-50/50"
                        />
                    </div>

                    {!readOnly && (
                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingCreds}
                                className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {savingCreds ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Credenciais
                            </button>
                        </div>
                    )}
                </form>
            </div>

            {/* Alternativa Manual: Colar URL de Retorno */}
            {!connected && (
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200/80">
                    <h4 className="text-xs font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-orange-500" />
                        Ativação Manual / Colar URL de Retorno
                    </h4>
                    <p className="text-[11px] text-gray-500 mb-3">
                        Se após autorizar na Shopee você não for redirecionado automaticamente, copie a URL inteira da barra de endereços (ou os parâmetros <code>code</code> e <code>shop_id</code>) e cole abaixo:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="https://.../?code=...&shop_id=..."
                            value={pasteUrl}
                            onChange={(e) => setPasteUrl(e.target.value)}
                            className="flex-1 text-xs px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none"
                        />
                        <button
                            onClick={handleManualExchange}
                            disabled={exchanging || !pasteUrl.trim()}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {exchanging ? 'Ativando...' : 'Ativar Conexão'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
