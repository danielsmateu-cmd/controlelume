import { supabase } from '../lib/supabase';

export const api = {
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
                paymentMethod: o.payment_method
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
                year: o.year
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
                paymentMethod: o.payment_method
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
    }
};
