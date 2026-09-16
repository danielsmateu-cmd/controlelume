import React, { useState, useEffect } from "react";
import { adsAuditService } from "../../services/adsAuditService";
import { Activity, RefreshCw, AlertCircle, History, TrendingUp, DollarSign } from "lucide-react";

export default function AuditoriaAds() {
  const [history, setHistory] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [histData, snapData] = await Promise.all([
        adsAuditService.getHistory(),
        adsAuditService.getSnapshots()
      ]);
      setHistory(histData || []);
      setCampaigns(snapData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await adsAuditService.syncCampaigns();
      if (res.success) {
        if (res.changesCount > 0) {
          alert(`Sincronização concluída! ${res.changesCount} alterações detectadas.`);
        } else {
          alert("Sincronização concluída! Nenhuma alteração detectada nas campanhas.");
        }
        await loadData();
      } else {
        throw new Error(res.error || "Erro desconhecido ao sincronizar");
      }
    } catch (err) {
      setError(err.message);
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const totalBudget = campaigns.reduce((acc, c) => acc + (Number(c.budget) || 0), 0);
  const lastChange = history.length > 0 ? new Date(history[0].data_detectada) : null;

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const translateField = (field) => {
    const map = {
      "budget": "Orçamento Diário",
      "status": "Status",
      "target_acos": "Meta ACOS",
      "campanha_criada": "Criação"
    };
    return map[field] || field;
  };

  const formatValue = (field, val) => {
    if (val === "N/A" || val === "Nova Campanha") return val;
    if (field === "budget") return formatCurrency(val);
    if (field === "target_acos") return `${val}%`;
    if (field === "status") {
      return val === "active" ? "Ativa" : val === "paused" ? "Pausada" : val;
    }
    return val;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Auditoria Mercado Ads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhe alterações feitas nas campanhas de publicidade do Mercado Livre.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Dados Agora"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-gray-700">Campanhas Ativas</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeCampaigns} <span className="text-sm font-normal text-gray-500">de {campaigns.length}</span></p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-gray-700">Orçamento Diário</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-gray-700">Última Alteração</h3>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">
            {lastChange ? formatDate(lastChange) : "Nenhuma registrada"}
          </p>
        </div>
      </div>

      {/* Grid: Histórico e Campanhas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline de Histórico (Ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
            <h2 className="font-semibold text-gray-900">Histórico de Alterações Detectadas</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Carregando histórico...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Nenhuma alteração registrada ainda.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs uppercase text-gray-500">
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Data/Hora</th>
                    <th className="px-5 py-3 font-medium">Campanha</th>
                    <th className="px-5 py-3 font-medium">Alteração</th>
                    <th className="px-5 py-3 font-medium text-right">De (Antes)</th>
                    <th className="px-5 py-3 font-medium text-center"></th>
                    <th className="px-5 py-3 font-medium">Para (Depois)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.data_detectada)}</td>
                      <td className="px-5 py-3 font-medium text-gray-700">{log.campaign_name}</td>
                      <td className="px-5 py-3 text-gray-600">{translateField(log.campo_alterado)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 line-through decoration-red-300">
                        {formatValue(log.campo_alterado, log.valor_anterior)}
                      </td>
                      <td className="px-2 py-3 text-center text-gray-300">?</td>
                      <td className="px-5 py-3 font-medium text-emerald-600">
                        {formatValue(log.campo_alterado, log.valor_novo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Lista Atual de Campanhas (Ocupa 1 coluna) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
            <h2 className="font-semibold text-gray-900">Estado Atual (Snapshot)</h2>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Carregando campanhas...</div>
            ) : campaigns.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Nenhuma campanha mapeada. Sincronize para puxar.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {campaigns.map(c => (
                  <li key={c.id} className="p-4 hover:bg-gray-50/50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-gray-900">{c.name}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'active' ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex justify-between mt-2">
                      <span>Orçamento: {formatCurrency(c.budget)}</span>
                      <span>ACOS: {c.target_acos}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
