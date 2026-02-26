import { supabase } from '../lib/supabase';

export const api = {
    // ==================== MATERIAIS ====================
    async getMaterials() {
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map(m => {
                let type = 'sheet';
                if (m.width === 0 && m.height === 0) type = 'unit';
                else if (m.width === 0 && m.height === 1) type = 'linear';

                return {
                    ...m,
                    type,
                    pricePerM2: m.price_per_m2
                };
            });
        } catch (err) {
            console.error('Supabase getMaterials:', err);
            const saved = localStorage.getItem('materials');
            return saved ? JSON.parse(saved) : [];
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
                    price_per_m2: material.pricePerM2 || 0
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
                pricePerM2: saved.price_per_m2
            };
        } catch (err) {
            console.error('Supabase addMaterial:', err);
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
                dueDate: e.due_date
            }));
        } catch (err) {
            console.error('Supabase getExpenses:', err);
            const saved = localStorage.getItem('expenses');
            return saved ? JSON.parse(saved) : null;
        }
    },

    async saveExpenses(expensesList) {
        try {
            // Upsert works best for the batch syncing from the app
            const { error } = await supabase
                .from('expenses')
                .upsert(
                    expensesList.map(e => ({
                        id: String(e.id),
                        type: e.type,
                        year: e.year,
                        month: e.month,
                        category: e.category,
                        description: e.description,
                        amount: e.amount || 0,
                        date: e.date,
                        due_date: e.dueDate,
                        paid: e.paid,
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
            const saved = localStorage.getItem('orders');
            return saved ? JSON.parse(saved) : null;
        }
    },

    async saveOrders(ordersList) {
        try {
            // Separa registros com ID real (number, do banco) dos novos (string/timestamp/null)
            const toMap = (o) => ({
                client_name: o.clientName,
                description: o.description,
                order_date: o.orderDate,
                value: o.value,
                payment_date: o.paymentDate,
                is_paid: o.isPaid,
                payment_method: o.paymentMethod,
                year: o.year
            });

            const existentes = ordersList
                .filter(o => typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 && o.id < 1000000000)
                .map(o => ({ id: o.id, ...toMap(o) }));

            const novos = ordersList
                .filter(o => !(typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 && o.id < 1000000000))
                .map(o => toMap(o));

            if (existentes.length > 0) {
                const { error } = await supabase.from('orders').upsert(existentes);
                if (error) throw error;
            }
            if (novos.length > 0) {
                const { error } = await supabase.from('orders').insert(novos);
                if (error) throw error;
            }
            return true;
        } catch (err) {
            console.error('Supabase saveOrders:', err);
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
            const saved = localStorage.getItem('notes');
            return saved ? JSON.parse(saved) : null;
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
                const { error } = await supabase.from('notes').upsert(existentes);
                if (error) throw error;
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
    }
};
