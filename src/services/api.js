import { supabase } from '../lib/supabase';
import { localApi } from './localApi';

const isTestUser = () => {
    try {
        const user = sessionStorage.getItem('currentUser');
        if (user) {
            const parsed = JSON.parse(user);
            return parsed.login === 'teste';
        }
    } catch (e) {
        // Handle gracefully
    }
    return false;
};

const supabaseApi = {
    // ==================== MATERIAIS ====================
    async getMaterials() {
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .order('sort_index', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map(m => {
                let type = 'sheet';
                if (m.width === 0 && m.height === 0) type = 'unit';
                else if (m.width === 0 && m.height === 1) type = 'linear';

                return {
                    ...m,
                    type,
                    pricePerM2: m.price_per_m2,
                    sortIndex: m.sort_index
                };
            });
        } catch (err) {
            console.error('Supabase getMaterials:', err);
            const saved = localStorage.getItem('materials');
            return saved ? JSON.parse(saved) : [];
        }
    },

    async updateMaterialsOrder(materialsList) {
        try {
            for (let i = 0; i < materialsList.length; i++) {
                const { error } = await supabase
                    .from('materials')
                    .update({ sort_index: i })
                    .eq('id', materialsList[i].id);
                if (error) {
                    console.error('Error updating sort_index for material', materialsList[i].id, error);
                }
            }
            return true;
        } catch (err) {
            console.error('Supabase updateMaterialsOrder:', err);
            return false;
        }
    },

    async addMaterial(material) {
        try {
            const { data, error } = await supabase
                .from('materials')
                .insert([{
                    name: material.name,
                    width: material.type === 'unit' ? 0 : (material.type === 'linear' ? 0 : material.width || 0),
                    height: material.type === 'unit' ? 0 : (material.type === 'linear' ? 1 : material.height || 0),
                    price: material.price || 0,
                    price_per_m2: material.pricePerM2 || 0,
                    sort_index: material.sortIndex || 0
                }])
                .select();

            if (error) throw error;
            const saved = data[0];
            let type = 'sheet';
            if (saved.width === 0 && saved.height === 0) type = 'unit';
            else if (saved.width === 0 && saved.height === 1) type = 'linear';

            return {
                ...saved,
                type,
                pricePerM2: saved.price_per_m2,
                sortIndex: saved.sort_index
            };
        } catch (err) {
            console.error('Supabase addMaterial:', err);
            return null;
        }
    },

    async updateMaterial(id, updates) {
        try {
            const { data, error } = await supabase
                .from('materials')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            const saved = data[0];
            let type = 'sheet';
            if (saved.width === 0 && saved.height === 0) type = 'unit';
            else if (saved.width === 0 && saved.height === 1) type = 'linear';

            return {
                ...saved,
                type,
                pricePerM2: saved.price_per_m2,
                sortIndex: saved.sort_index
            };
        } catch (err) {
            console.error('Supabase updateMaterial:', err);
            return null;
        }
    },

    async deleteMaterial(id) {
        try {
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteMaterial:', err);
            return false;
        }
    },

    // ==================== SETTINGS ====================
    async getSettings(id) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('id', id)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data ? data.value : null;
        } catch (err) {
            console.error('Supabase getSettings:', err);
            return null;
        }
    },

    async saveSettings(id, value) {
        try {
            const { error } = await supabase
                .from('settings')
                .upsert({ id, value, updated_at: new Date().toISOString() });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase saveSettings:', err);
            return false;
        }
    },

    // ==================== ORÇAMENTOS ====================
    async getBudgets() {
        try {
            const { data, error } = await supabase
                .from('budgets')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            return data.map(b => ({
                ...b,
                clientData: b.client_data,
                items: b.items
            }));
        } catch (err) {
            console.error('Supabase getBudgets:', err);
            const saved = localStorage.getItem('savedBudgets');
            return saved ? JSON.parse(saved) : [];
        }
    },

    async addBudget(budget) {
        try {
            const { data, error } = await supabase
                .from('budgets')
                .insert([{
                    date: budget.date,
                    client_data: budget.clientData,
                    items: budget.items,
                    total: budget.total,
                    status: budget.status
                }])
                .select();

            if (error) throw error;
            return {
                ...data[0],
                clientData: data[0].client_data,
                items: data[0].items
            };
        } catch (err) {
            console.error('Supabase addBudget:', err);
            return null;
        }
    },

    async updateBudget(id, updates) {
        try {
            const dbUpdates = {};
            if (updates.status) dbUpdates.status = updates.status;
            if (updates.clientData) dbUpdates.client_data = updates.clientData;
            if (updates.items) dbUpdates.items = updates.items;
            if (updates.total) dbUpdates.total = updates.total;

            const { error } = await supabase
                .from('budgets')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase updateBudget:', err);
            return false;
        }
    },

    async deleteBudget(id) {
        try {
            const { error } = await supabase
                .from('budgets')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteBudget:', err);
            return false;
        }
    },

    // ==================== DESPESAS (EXPENSES) ====================
    async getExpenses() {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*');

            if (error) throw error;
            return data.map(e => ({
                ...e,
                dueDate: e.due_date,
                paymentDate: e.payment_date
            }));
        } catch (err) {
            console.error('Supabase getExpenses:', err);
            return [];
        }
    },

    async deleteExpense(id) {
        try {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteExpense:', err);
            return false;
        }
    },

    async updateExpense(id, updates) {
        try {
            const dbUpdates = {};
            if (updates.paid !== undefined) dbUpdates.paid = updates.paid;
            if (updates.paymentDate !== undefined) dbUpdates.payment_date = updates.paymentDate;
            if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
            if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;

            const { error } = await supabase
                .from('expenses')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase updateExpense:', err);
            return false;
        }
    },

    async saveExpenses(expensesList) {
        try {
            const { error } = await supabase
                .from('expenses')
                .upsert(
                    expensesList.map(e => ({
                        id: e.id, // Mantém o ID original (pode ser string 'fixed-...' ou number)
                        type: e.type,
                        year: e.year,
                        month: e.month,
                        category: e.category,
                        description: e.description,
                        amount: e.amount || 0,
                        date: e.date,
                        due_date: e.dueDate,
                        paid: e.paid,
                        payment_date: e.paymentDate,
                        people: e.people
                    }))
                );

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase saveExpenses:', err);
            return false;
        }
    },

    // ==================== VENDAS (ORDERS) ====================
    async getOrders() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map(o => ({
                ...o,
                clientName: o.client_name,
                orderDate: o.order_date,
                paymentDate: o.payment_date,
                isPaid: o.is_paid,
                paymentMethod: o.payment_method,
                boletoNumber: o.boleto_number,
                nfNumber: o.nf_number
            }));
        } catch (err) {
            console.error('Supabase getOrders:', err);
            return [];
        }
    },

    async deleteOrder(id) {
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteOrder:', err);
            return false;
        }
    },

    async addOrders(newOrdersArray) {
        try {
            const toMap = (o) => ({
                client_name: o.clientName,
                description: o.description,
                order_date: o.orderDate,
                value: o.value,
                payment_date: o.paymentDate,
                is_paid: Boolean(o.isPaid),
                payment_method: o.paymentMethod,
                year: o.year,
                boleto_number: o.boletoNumber,
                nf_number: o.nfNumber
            });

            const { data, error } = await supabase
                .from('orders')
                .insert(newOrdersArray.map(toMap))
                .select();

            if (error) throw error;
            return data.map(o => ({
                ...o,
                clientName: o.client_name,
                orderDate: o.order_date,
                paymentDate: o.payment_date,
                isPaid: o.is_paid,
                paymentMethod: o.payment_method,
                boletoNumber: o.boleto_number,
                nfNumber: o.nf_number
            }));
        } catch (err) {
            console.error('Supabase addOrders:', err);
            return null;
        }
    },

    async updateOrder(id, updates) {
        try {
            const dbUpdates = {};
            if (updates.isPaid !== undefined) dbUpdates.is_paid = updates.isPaid;
            if (updates.paymentDate !== undefined) dbUpdates.payment_date = updates.paymentDate;
            if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.value !== undefined) dbUpdates.value = updates.value;
            if (updates.orderDate !== undefined) dbUpdates.order_date = updates.orderDate;
            if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
            if (updates.year !== undefined) dbUpdates.year = updates.year;
            if (updates.boletoNumber !== undefined) dbUpdates.boleto_number = updates.boletoNumber;
            if (updates.nfNumber !== undefined) dbUpdates.nf_number = updates.nfNumber;

            const { error } = await supabase
                .from('orders')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase updateOrder:', err);
            return false;
        }
    },

    // ==================== ANOTAÇÕES (NOTES) ====================
    async getNotes() {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Supabase getNotes:', err);
            return [];
        }
    },

    async deleteNote(id) {
        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteNote:', err);
            return false;
        }
    },

    async saveNotes(notesList) {
        try {
            // Separa notas com ID real do banco das novas
            const toMap = (n) => ({
                description: n.description,
                value: n.value,
                date: n.date
            });

            const existentes = notesList
                .filter(n => typeof n.id === 'number' && Number.isInteger(n.id) && n.id > 0 && n.id < 1000000000)
                .map(n => ({ id: n.id, ...toMap(n) }));

            const novas = notesList
                .filter(n => !(typeof n.id === 'number' && Number.isInteger(n.id) && n.id > 0 && n.id < 1000000000))
                .map(n => toMap(n));

            if (existentes.length > 0) {
                for (const n of existentes) {
                    const { error } = await supabase
                        .from('notes')
                        .update(toMap(n))
                        .eq('id', n.id);
                    if (error) {
                        console.error(`Erro ao atualizar nota ${n.id}:`, error);
                        throw error;
                    }
                }
            }
            if (novas.length > 0) {
                const { error } = await supabase.from('notes').insert(novas);
                if (error) throw error;
            }
            return true;
        } catch (err) {
            console.error('Supabase saveNotes:', err);
            return false;
        }
    },

    // ==================== TAREFAS ====================
    async getTarefas() {
        try {
            const { data, error } = await supabase
                .from('tarefas')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map(t => ({
                id: t.id,
                pessoa_id: t.pessoa_id,
                cliente: t.cliente,
                descricao: t.descricao,
                dataFinal: t.data_final,
                concluida: t.concluida
            }));
        } catch (err) {
            console.error('Supabase getTarefas:', err);
            // Fallback para tarefas locais (migração)
            const saved = localStorage.getItem('tarefas_data');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    let flat = [];
                    for (const p in parsed) {
                        flat = flat.concat(parsed[p].map(t => ({ ...t, pessoa_id: p })));
                    }
                    return flat;
                } catch (e) { }
            }
            return [];
        }
    },

    async addTarefa(tarefa, pessoaId) {
        try {
            const { data, error } = await supabase
                .from('tarefas')
                .insert([{
                    pessoa_id: pessoaId,
                    cliente: tarefa.cliente,
                    descricao: tarefa.descricao,
                    data_final: tarefa.dataFinal || null,
                    concluida: tarefa.concluida || false
                }])
                .select();

            if (error) throw error;
            const t = data[0];
            return {
                id: t.id,
                pessoa_id: t.pessoa_id,
                cliente: t.cliente,
                descricao: t.descricao,
                dataFinal: t.data_final,
                concluida: t.concluida
            };
        } catch (err) {
            console.error('Supabase addTarefa:', err);
            return null;
        }
    },

    async updateTarefa(id, updates) {
        try {
            const dbUpdates = {};
            if (updates.concluida !== undefined) dbUpdates.concluida = updates.concluida;
            if (updates.cliente !== undefined) dbUpdates.cliente = updates.cliente;
            if (updates.descricao !== undefined) dbUpdates.descricao = updates.descricao;
            if (updates.dataFinal !== undefined) dbUpdates.data_final = updates.dataFinal || null;

            const { error } = await supabase
                .from('tarefas')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase updateTarefa:', err);
            return false;
        }
    },

    async deleteTarefa(id) {
        try {
            const { error } = await supabase
                .from('tarefas')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteTarefa:', err);
            return false;
        }
    },

    // ==================== FICHAS TÉCNICAS (FTs) ====================
    async getFts() {
        try {
            const { data, error } = await supabase
                .from('fts')
                .select(`
                    *,
                    ft_materials ( id, name, value ),
                    ft_direct_costs_rs ( id, name, value ),
                    ft_direct_costs_percent ( id, name, percentage )
                `)
                .order('ft_code', { ascending: true });

            if (error) throw error;
            return data.map(ft => ({
                id: ft.id,
                ftCode: ft.ft_code,
                name: ft.name,
                variation: ft.variation || '',
                productionTime: ft.production_time || '',
                salePrice: parseFloat(ft.sale_price) || 0,
                materials: ft.ft_materials || [],
                directCostsRS: ft.ft_direct_costs_rs || [],
                directCostsPercent: ft.ft_direct_costs_percent || []
            }));
        } catch (err) {
            console.error('Supabase getFts:', err);
            return [];
        }
    },

    async saveFt(ft) {
        try {
            let ftId = ft.id;

            // 1. Upsert na tabela principal `fts`
            const ftData = {
                ft_code: ft.ftCode,
                name: ft.name,
                variation: ft.variation || null,
                production_time: ft.productionTime || null,
                sale_price: parseFloat(ft.salePrice) || 0,
                updated_at: new Date().toISOString()
            };

            // Se for string antiga local (timestamp) ou nova com uuid, enviamos ID nulo se nao for UUID, mas upsert cuidará. 
            // Para garantir, vamos fazer insert/update separados se parecer que não tem ID UUID valido.
            const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(ftId);

            if (!ftId || !isUUID) {
                // Insert novo
                const { data, error } = await supabase.from('fts').insert([ftData]).select();
                if (error) throw error;
                ftId = data[0].id;
            } else {
                // Update existente
                const { data, error } = await supabase.from('fts').update(ftData).eq('id', ftId).select();
                if (error) throw error;
            }

            // 2. Apagar listar filhas antigas da FT
            await supabase.from('ft_materials').delete().eq('ft_id', ftId);
            await supabase.from('ft_direct_costs_rs').delete().eq('ft_id', ftId);
            await supabase.from('ft_direct_costs_percent').delete().eq('ft_id', ftId);

            // 3. Inserir novas listas se houverem itens validos
            if (ft.materials && ft.materials.length > 0) {
                const inserts = ft.materials.map(m => ({ ft_id: ftId, name: m.name, value: parseFloat(m.value) || 0 }));
                await supabase.from('ft_materials').insert(inserts);
            }
            if (ft.directCostsRS && ft.directCostsRS.length > 0) {
                const inserts = ft.directCostsRS.map(c => ({ ft_id: ftId, name: c.name, value: parseFloat(c.value) || 0 }));
                await supabase.from('ft_direct_costs_rs').insert(inserts);
            }
            if (ft.directCostsPercent && ft.directCostsPercent.length > 0) {
                const inserts = ft.directCostsPercent.map(c => ({ ft_id: ftId, name: c.name, percentage: parseFloat(c.percentage) || 0 }));
                await supabase.from('ft_direct_costs_percent').insert(inserts);
            }

            return { success: true, newId: ftId };
        } catch (err) {
            console.error('Supabase saveFt:', err);
            return { success: false, error: err };
        }
    },

    async deleteFt(id) {
        try {
            const { error } = await supabase.from('fts').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteFt:', err);
            return false;
        }
    },

    // ==================== COST MODELS (Fichas Técnicas) ====================
    async getFtCostModels() {
        try {
            const { data, error } = await supabase
                .from('ft_cost_models')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data.map(m => ({
                id: m.id,
                name: m.name,
                materials: m.materials || [],
                directCostsRS: m.direct_costs_rs || [],
                directCostsPercent: m.direct_costs_percent || []
            }));
        } catch (err) {
            console.error('Supabase getFtCostModels:', err);
            return [];
        }
    },

    async saveFtCostModel(model) {
        try {
            let modelId = model.id;
            const modelData = {
                name: model.name,
                materials: model.materials || [],
                direct_costs_rs: model.directCostsRS || [],
                direct_costs_percent: model.directCostsPercent || []
            };

            const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(modelId);

            if (!modelId || !isUUID) {
                const { data, error } = await supabase.from('ft_cost_models').insert([modelData]).select();
                if (error) throw error;
                return { success: true, data: { ...modelData, id: data[0].id } };
            } else {
                const { error } = await supabase.from('ft_cost_models').update(modelData).eq('id', modelId);
                if (error) throw error;
                return { success: true, data: { ...modelData, id: modelId } };
            }
        } catch (err) {
            console.error('Supabase saveFtCostModel:', err);
            return { success: false, error: err };
        }
    },

    // ==================== CUSTOS FINANCEIROS MENSAL (Empresas) ====================
    async getMonthlyCosts() {
        try {
            const { data, error } = await supabase.from('ecommerce_monthly_costs').select('*');
            if (error) throw error;

            const result = {};
            data.forEach(row => {
                result[row.month_id] = row.data;
            });
            return result;
        } catch (err) {
            console.error('Supabase getMonthlyCosts:', err);
            return {};
        }
    },

    async saveMonthlyCosts(monthId, costsData) {
        try {
            const { error } = await supabase.from('ecommerce_monthly_costs')
                .upsert({
                    month_id: monthId,
                    data: costsData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'month_id' });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase saveMonthlyCosts:', err);
            return false;
        }
    },

    // ==================== VENDAS MENSAL (E-commerce) ====================
    async getMonthlySales() {
        try {
            const { data, error } = await supabase.from('ecommerce_monthly_sales').select('*');
            if (error) throw error;

            const result = {};
            data.forEach(row => {
                result[row.month_id] = row.data;
            });
            return result;
        } catch (err) {
            console.error('Supabase getMonthlySales:', err);
            return {};
        }
    },

    async saveMonthlySales(monthId, salesData) {
        try {
            const { error } = await supabase.from('ecommerce_monthly_sales')
                .upsert({
                    month_id: monthId,
                    data: salesData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'month_id' });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase saveMonthlySales:', err);
            return false;
        }
    }
};

export const api = new Proxy(supabaseApi, {
    get: function (target, prop) {
        if (isTestUser() && localApi[prop]) {
            return localApi[prop];
        }
        return target[prop];
    }
});
