import React, { useState, useEffect, useCallback } from 'react';
import { mlAuth, mlApi, mlListings } from '../../services/mlApi';
import { api } from '../../services/api';
import { RefreshCw, Link2, Package, ShoppingBag, BarChart2, Pause, Play, Edit2, Check, X, AlertTriangle, Wifi, WifiOff, ChevronDown } from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-red-100 text-red-700',
};
const STATUS_LABELS = { active: 'Ativo', paused: 'Pausado', closed: 'Encerrado' };

export default function MercadoLivreIntegracao({ fts }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('estoque');
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [editingStock, setEditingStock] = useState(null);
  const [editingFt, setEditingFt] = useState(null);
  const [stockValue, setStockValue] = useState('');
  const [sellerInfo, setSellerInfo] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    checkConnection();
    handleCallbackIfNeeded();
  }, []);

  const handleCallbackIfNeeded = async () => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('ml_code');
    if (code) {
      setLoading(true);
      const res = await mlAuth.exchangeCode(code);
      if (res.success) {
        window.history.replaceState({}, '', window.location.pathname);
        await checkConnection();
      }
    }
  };

  const checkConnection = async () => {
    setLoading(true);
    const ok = await mlAuth.isConnected();
    setConnected(ok);
    if (ok) {
      const local = await mlListings.getListings();
      setListings(local);
      try { const me = await mlApi.getMe(); setSellerInfo(me); } catch (e) {}
    }
    setLoading(false);
  };

  const handleConnect = () => {
    window.location.href = mlAuth.getAuthUrl();
  };

  const handleDisconnect = async () => {
    if (confirm('Deseja desconectar o Mercado Livre?')) {
      await mlAuth.disconnect();
      setConnected(false); setListings([]); setSellerInfo(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      let allIds = [];
      let offset = 0;
      while (true) {
        const res = await mlApi.getMyItems(offset, 50);
        const ids = res.results || [];
        allIds = [...allIds, ...ids];
        if (ids.length < 50) break;
        offset += 50;
      }
      // Buscar detalhes em lotes de 20
      let allDetails = [];
      for (let i = 0; i < allIds.length; i += 20) {
        const batch = allIds.slice(i, i + 20);
        const details = await mlApi.getItemsDetails(batch);
        allDetails = [...allDetails, ...details];
      }
      await mlListings.saveListings(allDetails);
      const local = await mlListings.getListings();
      setListings(local);
    } catch (err) {
      alert('Erro ao sincronizar: ' + err.message);
    }
    setSyncing(false);
  };

  const handleLoadOrders = async () => {
    setLoading(true);
    try {
      const data = await mlApi.getPendingOrders();
      setOrders(data);
    } catch (err) { alert('Erro: ' + err.message); }
    setLoading(false);
  };

  const handleLoadHistory = async () => {
    setLoading(true);
    try {
      const data = await mlApi.getSalesHistory(
        new Date(dateFrom).toISOString(),
        new Date(dateTo + 'T23:59:59').toISOString()
      );
      setSalesHistory(data);
    } catch (err) { alert('Erro: ' + err.message); }
    setLoading(false);
  };

  const handlePauseItem = async (listing) => {
    try {
      await mlApi.pauseItem(listing.ml_item_id);
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: 'paused' } : l));
    } catch (err) { alert('Erro ao pausar: ' + err.message); }
  };

  const handleReactivateItem = async (listing) => {
    try {
      await mlApi.reactivateItem(listing.ml_item_id);
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: 'active' } : l));
    } catch (err) { alert('Erro ao reativar: ' + err.message); }
  };

  const handleUpdateMlStock = async (listing) => {
    const qty = parseInt(stockValue);
    if (isNaN(qty) || qty < 0) return;
    try {
      await mlApi.updateStock(listing.ml_item_id, qty);
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, stock_ml: qty } : l));
      setEditingStock(null);
    } catch (err) { alert('Erro ao atualizar estoque ML: ' + err.message); }
  };

  const handleUpdatePhysicalStock = async (listing) => {
    const qty = parseInt(stockValue);
    if (isNaN(qty) || qty < 0) return;
    await mlListings.updatePhysicalStock(listing.id, qty);
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, stock_physical: qty } : l));
    setEditingStock(null);
  };

  const handleLinkFt = async (listing, ftId) => {
    await mlListings.linkFt(listing.id, ftId);
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, ft_id: ftId } : l));
    setEditingFt(null);
  };

  const totalSales = salesHistory.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-yellow-500" size={32} />
    </div>
  );

  if (!connected) return (
    <div className="flex flex-col items-center justify-center h-64 gap-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
          <WifiOff size={40} className="text-yellow-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Mercado Livre não conectado</h2>
        <p className="text-gray-500 text-sm">Clique abaixo para autorizar o acesso à sua conta</p>
      </div>
      <button
        onClick={handleConnect}
        className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-2xl shadow-lg transition-all"
      >
        ?? Conectar Mercado Livre
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-white text-sm">ML</div>
          <div>
            <p className="font-bold text-gray-800">{sellerInfo?.nickname || 'Mercado Livre'}</p>
            <p className="text-xs text-green-600 flex items-center gap-1"><Wifi size={12} /> Conectado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl text-sm transition-all">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button onClick={handleDisconnect} className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all">Desconectar</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'estoque', icon: <Package size={16} />, label: 'Estoque' },
          { key: 'pedidos', icon: <ShoppingBag size={16} />, label: 'A Enviar Hoje' },
          { key: 'historico', icon: <BarChart2 size={16} />, label: 'Histórico' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key === 'pedidos') handleLoadOrders(); if (tab.key === 'historico') handleLoadHistory(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: ESTOQUE */}
      {activeTab === 'estoque' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {listings.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p>Nenhum anúncio importado.</p>
              <p className="text-sm mt-1">Clique em "Sincronizar" para importar seus anúncios do ML.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">FT</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Estoque ML</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Físico</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Preço</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {listings.map(listing => (
                    <tr key={listing.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {listing.thumbnail_url && <img src={listing.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                          <div>
                            <p className="font-medium text-gray-800 text-xs leading-tight line-clamp-2 max-w-[200px]">{listing.title}</p>
                            <p className="text-[10px] text-gray-400">{listing.ml_item_id}</p>
                            {listing.sku && <p className="text-[10px] text-gray-400">SKU: {listing.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingFt === listing.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              defaultValue={listing.ft_id || ''}
                              onChange={e => handleLinkFt(listing, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 max-w-[120px]"
                            >
                              <option value="">-- Sem FT --</option>
                              {(fts || []).map(ft => (
                                <option key={ft.ftCode} value={ft.ftCode}>{ft.ftCode} - {ft.name?.slice(0, 25)}</option>
                              ))}
                            </select>
                            <button onClick={() => setEditingFt(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingFt(listing.id)} className={`flex items-center gap-1 mx-auto text-xs px-2 py-0.5 rounded-full ${listing.ft_id ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-orange-100 text-orange-600'}`}>
                            {listing.ft_id || 'Vincular'} <Edit2 size={10} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[listing.status] || 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[listing.status] || listing.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingStock === listing.id + '_ml' ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)} className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" />
                            <button onClick={() => handleUpdateMlStock(listing)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                            <button onClick={() => setEditingStock(null)} className="text-red-400 hover:text-red-500"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingStock(listing.id + '_ml'); setStockValue(listing.available_quantity ?? ''); }} className="flex items-center gap-1 mx-auto font-bold text-yellow-700 hover:text-yellow-800">
                            {listing.available_quantity ?? '—'} <Edit2 size={10} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingStock === listing.id + '_phy' ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)} className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" />
                            <button onClick={() => handleUpdatePhysicalStock(listing)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                            <button onClick={() => setEditingStock(null)} className="text-red-400 hover:text-red-500"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingStock(listing.id + '_phy'); setStockValue(listing.stock_physical ?? 0); }} className="flex items-center gap-1 mx-auto font-bold text-blue-700 hover:text-blue-800">
                            {listing.stock_physical ?? 0} <Edit2 size={10} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                        R$ {Number(listing.price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {listing.status === 'active' ? (
                          <button onClick={() => handlePauseItem(listing)} title="Pausar anúncio" className="p-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors">
                            <Pause size={14} />
                          </button>
                        ) : listing.status === 'paused' ? (
                          <button onClick={() => handleReactivateItem(listing)} title="Reativar anúncio" className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                            <Play size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: PEDIDOS */}
      {activeTab === 'pedidos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ShoppingBag size={40} className="mx-auto mb-3 opacity-40" />
              <p>Nenhum pedido pendente de envio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Comprador</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Qtd</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">#{order.id}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800">{order.buyer?.nickname || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                        {order.order_items?.map(i => i.item?.title).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold">
                        {order.order_items?.reduce((s, i) => s + (i.quantity || 0), 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-green-700">
                        R$ {Number(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {new Date(order.date_created).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORICO */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">De</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Até</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
            </div>
            <button onClick={handleLoadHistory} className="mt-4 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl text-sm">Buscar</button>
            {salesHistory.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-500">{salesHistory.length} pedidos</p>
                <p className="text-lg font-black text-green-700">R$ {totalSales.toFixed(2)}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {salesHistory.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <BarChart2 size={40} className="mx-auto mb-3 opacity-40" />
                <p>Selecione um período e clique em Buscar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Comprador</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Qtd</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {salesHistory.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(order.date_created).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-800">{order.buyer?.nickname || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                          {order.order_items?.map(i => i.item?.title).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold">
                          {order.order_items?.reduce((s, i) => s + (i.quantity || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-green-700">
                          R$ {Number(order.total_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
