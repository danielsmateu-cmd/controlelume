import { supabase } from "../lib/supabase";
import { mlApi } from "./mlApi";

export const adsAuditService = {
  async syncCampaigns() {
    try {
      // 1. Fetch current campaigns from Mercado Ads
      const liveCampaignsRaw = await mlApi.getAdsCampaigns();
      const liveCampaigns = Array.isArray(liveCampaignsRaw) ? liveCampaignsRaw : (liveCampaignsRaw.results || []);

      if (liveCampaigns.length === 0) {
        return { success: true, message: "Nenhuma campanha encontrada no ML (ou sem permissão de Ads)." };
      }

      // 2. Fetch current snapshots from DB
      const { data: snapshots, error: snapError } = await supabase
        .from("ml_campaigns_snapshot")
        .select("*");

      if (snapError) throw snapError;

      const snapshotMap = {};
      (snapshots || []).forEach(snap => {
        snapshotMap[snap.campaign_id] = snap;
      });

      let changesCount = 0;
      const historyLogs = [];
      const snapshotsToUpsert = [];

      // 3. Compare and build logs
      for (const campaign of liveCampaigns) {
        const cId = String(campaign.id);
        const cName = campaign.name || "Sem Nome";
        const cStatus = campaign.status;
        const cBudget = campaign.budget;
        const cAcos = campaign.target_acos || 0;
        const lastUpdated = campaign.last_updated || new Date().toISOString();

        const oldSnap = snapshotMap[cId];

        // Ensure we record this in the upsert array to update the DB
        snapshotsToUpsert.push({
          campaign_id: cId,
          name: cName,
          status: cStatus,
          budget: cBudget,
          target_acos: cAcos,
          last_updated_ml: lastUpdated,
          last_checked_at: new Date().toISOString()
        });

        if (oldSnap) {
          // Compare fields
          if (oldSnap.status !== cStatus) {
            historyLogs.push({
              campaign_id: cId,
              campaign_name: cName,
              campo_alterado: "status",
              valor_anterior: oldSnap.status,
              valor_novo: cStatus
            });
          }
          if (Number(oldSnap.budget) !== Number(cBudget)) {
            historyLogs.push({
              campaign_id: cId,
              campaign_name: cName,
              campo_alterado: "budget",
              valor_anterior: String(oldSnap.budget),
              valor_novo: String(cBudget)
            });
          }
          if (Number(oldSnap.target_acos) !== Number(cAcos)) {
            historyLogs.push({
              campaign_id: cId,
              campaign_name: cName,
              campo_alterado: "target_acos",
              valor_anterior: String(oldSnap.target_acos),
              valor_novo: String(cAcos)
            });
          }
        } else {
          // New campaign detected (optional log, but let's record it)
          historyLogs.push({
            campaign_id: cId,
            campaign_name: cName,
            campo_alterado: "campanha_criada",
            valor_anterior: "N/A",
            valor_novo: "Nova Campanha"
          });
        }
      }

      // 4. Update DB
      if (historyLogs.length > 0) {
        const { error: histError } = await supabase
          .from("ml_campaigns_history")
          .insert(historyLogs);
        if (histError) console.error("Error inserting history:", histError);
        changesCount = historyLogs.length;
      }

      if (snapshotsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("ml_campaigns_snapshot")
          .upsert(snapshotsToUpsert, { onConflict: "campaign_id" });
        if (upsertError) console.error("Error upserting snapshot:", upsertError);
      }

      return { success: true, changesCount };

    } catch (error) {
      console.error("Erro no syncCampaigns:", error);
      
      // Checar se o erro é de permissão do Mercado Ads
      if (error.message && error.message.includes('403')) {
         return { success: false, error: "Acesso Negado (403): Seu App no Mercado Livre não tem permissão para a API de Advertising (Ads)." };
      }
      
      return { success: false, error: error.message };
    }
  },

  async getHistory() {
    const { data, error } = await supabase
      .from("ml_campaigns_history")
      .select("*")
      .order("data_detectada", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },

  async getSnapshots() {
    const { data, error } = await supabase
      .from("ml_campaigns_snapshot")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  }
};
