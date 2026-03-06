// src/services/localApi.js

const PREFIX = 'teste_';

const getLocal = (key, defaultVal = []) => {
    try {
        const item = localStorage.getItem(PREFIX + key);
        return item ? JSON.parse(item) : defaultVal;
    } catch (e) {
        console.error('Error reading from localStorage', e);
        return defaultVal;
    }
};

const setLocal = (key, val) => {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(val));
    } catch (e) {
        console.error('Error writing to localStorage', e);
    }
};

const generateId = () => Date.now() + Math.floor(Math.random() * 1000);

export const localApi = {
    // ==================== MATERIAIS ====================
    async getMaterials() {
        return getLocal('materials', []);
    },

    async updateMaterialsOrder(materialsList) {
        const current = getLocal('materials', []);

        // Update sort_index
        materialsList.forEach((m, idx) => {
            const existing = current.find(x => x.id === m.id);
            if (existing) {
                existing.sort_index = idx;
                existing.sortIndex = idx; // for UI
            }
        });

        // Sort the array by sort_index to preserve order
        current.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));

        setLocal('materials', current);
        return true;
    },

    async addMaterial(material) {
        const current = getLocal('materials', []);
        const newMaterial = {
            id: generateId(),
            name: material.name,
            width: material.type === 'unit' ? 0 : (material.type === 'linear' ? 0 : material.width || 0),
            height: material.type === 'unit' ? 0 : (material.type === 'linear' ? 1 : material.height || 0),
            price: material.price || 0,
            price_per_m2: material.pricePerM2 || 0,
            sort_index: material.sortIndex || 0,
            type: material.type,
            pricePerM2: material.pricePerM2 || 0,
            sortIndex: material.sortIndex || 0,
            created_at: new Date().toISOString()
        };
        current.push(newMaterial);
        setLocal('materials', current);
        return newMaterial;
    },

    async updateMaterial(id, updates) {
        const current = getLocal('materials', []);
        const index = current.findIndex(m => m.id === id);
        if (index === -1) return null;

        current[index] = { ...current[index], ...updates };

        // Ensure type/pricePerM2/sortIndex are synced if width/height changed
        const saved = current[index];
        let type = 'sheet';
        if (saved.width === 0 && saved.height === 0) type = 'unit';
        else if (saved.width === 0 && saved.height === 1) type = 'linear';

        current[index] = {
            ...saved,
            type,
            pricePerM2: saved.price_per_m2 !== undefined ? saved.price_per_m2 : saved.pricePerM2,
            sortIndex: saved.sort_index !== undefined ? saved.sort_index : saved.sortIndex
        };

        setLocal('materials', current);
        return current[index];
    },

    async deleteMaterial(id) {
        const current = getLocal('materials', []);
        const next = current.filter(m => m.id !== id);
        setLocal('materials', next);
        return true;
    },

    // ==================== SETTINGS ====================
    async getSettings(id) {
        const settings = getLocal('settings', {});
        return settings[id] ?? null;
    },

    async saveSettings(id, value) {
        const settings = getLocal('settings', {});
        settings[id] = value;
        setLocal('settings', settings);
        return true;
    },

    // ==================== ORÇAMENTOS ====================
    async getBudgets() {
        return getLocal('budgets', []);
    },

    async addBudget(budget) {
        const current = getLocal('budgets', []);
        const newBudget = {
            id: generateId(),
            date: budget.date,
            client_data: budget.clientData,
            clientData: budget.clientData,
            items: budget.items,
            total: budget.total,
            status: budget.status,
            created_at: new Date().toISOString()
        };
        current.unshift(newBudget); // Add to beginning (order desc)
        setLocal('budgets', current);
        return newBudget;
    },

    async updateBudget(id, updates) {
        const current = getLocal('budgets', []);
        const index = current.findIndex(b => b.id === id);
        if (index === -1) return false;

        const budget = current[index];
        if (updates.status) budget.status = updates.status;
        if (updates.clientData) {
            budget.client_data = updates.clientData;
            budget.clientData = updates.clientData;
        }
        if (updates.items) budget.items = updates.items;
        if (updates.total) budget.total = updates.total;

        setLocal('budgets', current);
        return true;
    },

    async deleteBudget(id) {
        const current = getLocal('budgets', []);
        const next = current.filter(b => b.id !== id);
        setLocal('budgets', next);
        return true;
    },

    // ==================== DESPESAS (EXPENSES) ====================
    async getExpenses() {
        return getLocal('expenses', []);
    },

    async deleteExpense(id) {
        const current = getLocal('expenses', []);
        const next = current.filter(e => e.id !== id);
        setLocal('expenses', next);
        return true;
    },

    async updateExpense(id, updates) {
        const current = getLocal('expenses', []);
        const index = current.findIndex(e => e.id === id);
        if (index === -1) return false;

        const expense = current[index];
        if (updates.paid !== undefined) expense.paid = updates.paid;
        if (updates.paymentDate !== undefined) {
            expense.payment_date = updates.paymentDate;
            expense.paymentDate = updates.paymentDate;
        }
        if (updates.amount !== undefined) expense.amount = updates.amount;
        if (updates.dueDate !== undefined) {
            expense.due_date = updates.dueDate;
            expense.dueDate = updates.dueDate;
        }
        if (updates.barcode !== undefined) expense.barcode = updates.barcode;

        setLocal('expenses', current);
        return true;
    },

    async saveExpenses(expensesList) {
        let current = getLocal('expenses', []);

        expensesList.forEach(e => {
            const index = current.findIndex(existing => existing.id === e.id);
            const expenseData = {
                id: e.id || generateId(),
                type: e.type,
                year: e.year,
                month: e.month,
                category: e.category,
                description: e.description,
                amount: e.amount || 0,
                date: e.date,
                due_date: e.dueDate,
                dueDate: e.dueDate,
                paid: e.paid,
                payment_date: e.paymentDate,
                paymentDate: e.paymentDate,
                people: e.people,
                barcode: e.barcode
            };

            if (index > -1) {
                current[index] = { ...current[index], ...expenseData };
            } else {
                current.push(expenseData);
            }
        });

        setLocal('expenses', current);
        return true;
    },

    // ==================== VENDAS (ORDERS) ====================
    async getOrders() {
        return getLocal('orders', []);
    },

    async deleteOrder(id) {
        const current = getLocal('orders', []);
        const next = current.filter(o => o.id !== id);
        setLocal('orders', next);
        return true;
    },

    async addOrders(newOrdersArray) {
        const current = getLocal('orders', []);

        const added = newOrdersArray.map(o => ({
            id: generateId() + Math.floor(Math.random() * 1000), // Ensure unique IDs if adding multiple quickly
            client_name: o.clientName,
            clientName: o.clientName,
            description: o.description,
            order_date: o.orderDate,
            orderDate: o.orderDate,
            value: o.value,
            payment_date: o.paymentDate,
            paymentDate: o.paymentDate,
            is_paid: Boolean(o.isPaid),
            isPaid: Boolean(o.isPaid),
            payment_method: o.paymentMethod,
            paymentMethod: o.paymentMethod,
            year: o.year,
            boleto_number: o.boletoNumber,
            boletoNumber: o.boletoNumber,
            nf_number: o.nfNumber,
            nfNumber: o.nfNumber,
            created_at: new Date().toISOString()
        }));

        const updated = [...added, ...current];
        setLocal('orders', updated);
        return added;
    },

    async updateOrder(id, updates) {
        const current = getLocal('orders', []);
        const index = current.findIndex(o => o.id === id);
        if (index === -1) return false;

        const order = current[index];
        if (updates.isPaid !== undefined) {
            order.is_paid = updates.isPaid;
            order.isPaid = updates.isPaid;
        }
        if (updates.paymentDate !== undefined) {
            order.payment_date = updates.paymentDate;
            order.paymentDate = updates.paymentDate;
        }
        if (updates.clientName !== undefined) {
            order.client_name = updates.clientName;
            order.clientName = updates.clientName;
        }
        if (updates.description !== undefined) order.description = updates.description;
        if (updates.value !== undefined) order.value = updates.value;
        if (updates.orderDate !== undefined) {
            order.order_date = updates.orderDate;
            order.orderDate = updates.orderDate;
        }
        if (updates.paymentMethod !== undefined) {
            order.payment_method = updates.paymentMethod;
            order.paymentMethod = updates.paymentMethod;
        }
        if (updates.year !== undefined) order.year = updates.year;
        if (updates.boletoNumber !== undefined) {
            order.boleto_number = updates.boletoNumber;
            order.boletoNumber = updates.boletoNumber;
        }
        if (updates.nfNumber !== undefined) {
            order.nf_number = updates.nfNumber;
            order.nfNumber = updates.nfNumber;
        }

        setLocal('orders', current);
        return true;
    },

    // ==================== ANOTAÇÕES (NOTES) ====================
    async getNotes() {
        return getLocal('notes', []);
    },

    async deleteNote(id) {
        const current = getLocal('notes', []);
        const next = current.filter(n => n.id !== id);
        setLocal('notes', next);
        return true;
    },

    async saveNotes(notesList) {
        let current = getLocal('notes', []);

        notesList.forEach(n => {
            const index = current.findIndex(existing => existing.id === n.id);
            const noteData = {
                id: n.id || generateId() + Math.floor(Math.random() * 1000),
                description: n.description,
                value: n.value,
                date: n.date,
                created_at: new Date().toISOString()
            };

            if (index > -1) {
                current[index] = { ...current[index], ...noteData };
            } else {
                current.push(noteData);
            }
        });

        setLocal('notes', current);
        return true;
    },

    // ==================== TAREFAS ====================
    async getTarefas() {
        return getLocal('tarefas', []);
    },

    async addTarefa(tarefa, pessoaId) {
        const current = getLocal('tarefas', []);
        const nova = {
            id: generateId(),
            pessoa_id: pessoaId,
            cliente: tarefa.cliente,
            descricao: tarefa.descricao,
            data_final: tarefa.dataFinal || null,
            dataFinal: tarefa.dataFinal || null,
            concluida: tarefa.concluida || false,
            created_at: new Date().toISOString()
        };
        current.unshift(nova);
        setLocal('tarefas', current);
        return nova;
    },

    async updateTarefa(id, updates) {
        const current = getLocal('tarefas', []);
        const index = current.findIndex(t => t.id === id);
        if (index === -1) return false;

        const tarefa = current[index];
        if (updates.concluida !== undefined) tarefa.concluida = updates.concluida;
        if (updates.cliente !== undefined) tarefa.cliente = updates.cliente;
        if (updates.descricao !== undefined) tarefa.descricao = updates.descricao;
        if (updates.dataFinal !== undefined) {
            tarefa.data_final = updates.dataFinal || null;
            tarefa.dataFinal = updates.dataFinal || null;
        }

        setLocal('tarefas', current);
        return true;
    },

    async deleteTarefa(id) {
        const current = getLocal('tarefas', []);
        const next = current.filter(t => t.id !== id);
        setLocal('tarefas', next);
        return true;
    },

    // ==================== FICHAS TÉCNICAS (FTs) ====================
    async getFts() {
        return getLocal('fts', []);
    },

    async saveFt(ft) {
        let current = getLocal('fts', []);
        const index = current.findIndex(existing => existing.id === ft.id);

        const ftId = ft.id || crypto.randomUUID();

        const ftData = {
            id: ftId,
            ftCode: ft.ftCode,
            ft_code: ft.ftCode,
            name: ft.name,
            variation: ft.variation || '',
            productionTime: ft.productionTime || '',
            production_time: ft.productionTime || '',
            salePrice: parseFloat(ft.salePrice) || 0,
            sale_price: parseFloat(ft.salePrice) || 0,
            materials: (ft.materials || []).map(m => ({ ...m, value: parseFloat(m.value) || 0 })),
            directCostsRS: (ft.directCostsRS || []).map(c => ({ ...c, value: parseFloat(c.value) || 0 })),
            directCostsPercent: (ft.directCostsPercent || []).map(c => ({ ...c, percentage: parseFloat(c.percentage) || 0 })),
            updated_at: new Date().toISOString()
        };

        if (index > -1) {
            current[index] = ftData;
        } else {
            current.push(ftData);
        }

        setLocal('fts', current);
        return { success: true, newId: ftId };
    },

    async deleteFt(id) {
        const current = getLocal('fts', []);
        const next = current.filter(f => f.id !== id);
        setLocal('fts', next);
        return true;
    },

    // ==================== COST MODELS (Fichas Técnicas) ====================
    async getFtCostModels() {
        return getLocal('ft_cost_models', []);
    },

    async saveFtCostModel(model) {
        let current = getLocal('ft_cost_models', []);
        const index = current.findIndex(existing => existing.id === model.id);

        const modelId = model.id || crypto.randomUUID();

        const modelData = {
            id: modelId,
            name: model.name,
            materials: model.materials || [],
            directCostsRS: model.directCostsRS || [],
            directCostsPercent: model.directCostsPercent || [],
            direct_costs_rs: model.directCostsRS || [],
            direct_costs_percent: model.directCostsPercent || [],
        };

        if (index > -1) {
            current[index] = modelData;
        } else {
            current.push(modelData);
        }

        setLocal('ft_cost_models', current);
        return { success: true, data: modelData };
    },

    // ==================== CUSTOS FINANCEIROS MENSAL (Empresas) ====================
    async getMonthlyCosts() {
        return getLocal('ecommerce_monthly_costs', {});
    },

    async saveMonthlyCosts(monthId, costsData) {
        const current = getLocal('ecommerce_monthly_costs', {});
        current[monthId] = costsData;
        setLocal('ecommerce_monthly_costs', current);
        return true;
    },

    // ==================== VENDAS MENSAL (E-commerce) ====================
    async getMonthlySales() {
        return getLocal('ecommerce_monthly_sales', {});
    },

    async saveMonthlySales(monthId, salesData) {
        const current = getLocal('ecommerce_monthly_sales', {});
        current[monthId] = salesData;
        setLocal('ecommerce_monthly_sales', current);
        return true;
    }
};
