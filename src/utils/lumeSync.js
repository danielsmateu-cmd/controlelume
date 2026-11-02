/**
 * Utilitários para sincronização de Gastos Fixos com a empresa LUME no E-commerce
 */

export const normalize = (str) => (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Verifica se a categoria/descrição de uma despesa é uma conta fixa operacional padrão da LUME.
 */
export const isDefaultLumeCategory = (name) => {
    const n = normalize(name);
    if (!n) return false;
    return (
        n.includes('energia') ||
        n.includes('agua') ||
        n.includes('internet') ||
        n.includes('contador') ||
        n.includes('iptu') ||
        n.includes('faxina') ||
        n.includes('limpeza') ||
        n.includes('aluguel') ||
        n.includes('funcionario') ||
        n.includes('folha')
    );
};

/**
 * Dado o ano e mês da aba Saída (mês de 0 a 11, ex: 9 = Outubro/2026),
 * retorna a string de referência do E-commerce (ex: '2026-11').
 */
export const getTargetEcommerceMonth = (year, monthIndex) => {
    const targetDate = new Date(year, monthIndex + 1, 1);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long' });
    return {
        monthStr: `${y}-${m}`,
        year: y,
        monthIndex: targetDate.getMonth(),
        monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1)
    };
};

/**
 * Dada a string de referência do E-commerce (ex: '2026-11'),
 * retorna o mês de origem dos gastos fixos em Saídas (ex: month: 9 = Outubro, year: 2026).
 */
export const getSourceExpensesMonth = (monthStr) => {
    if (!monthStr) return { year: new Date().getFullYear(), month: new Date().getMonth(), monthName: '' };
    const [year, month] = monthStr.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const monthName = prevDate.toLocaleDateString('pt-BR', { month: 'long' });
    return {
        year: prevDate.getFullYear(),
        month: prevDate.getMonth(),
        monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1)
    };
};

/**
 * Constrói ou atualiza o array de despesas da LUME a partir das despesas fixas selecionadas,
 * preservando todas as despesas separadas (ex: múltiplos funcionários ficam separados).
 */
export const buildLumeExpensesFromFixed = (selectedFixedExpenses, existingExpenses = []) => {
    const baseStandard = [
        { id: '1-e', name: 'Energia', key: 'energia' },
        { id: '1-a', name: 'Agua', key: 'agua' },
        { id: '1-i', name: 'Internet', key: 'internet' },
        { id: '1-c', name: 'Contador', key: 'contador' },
        { id: '1-ip', name: 'IPTU', key: 'iptu' },
        { id: '1-l', name: 'Limpeza', key: 'limpeza' },
        { id: '1-f', name: 'Folha', key: 'folha' },
        { id: '1-al', name: 'Aluguel', key: 'aluguel' },
    ];

    const expensesMap = {};
    (existingExpenses || []).forEach(exp => {
        const norm = normalize(exp.name);
        expensesMap[norm] = { ...exp };
    });

    baseStandard.forEach(b => {
        if (!expensesMap[b.key]) {
            const existingById = (existingExpenses || []).find(e => e.id === b.id);
            if (existingById) {
                expensesMap[b.key] = { ...existingById };
            } else {
                expensesMap[b.key] = { id: b.id, name: b.name, value: 0 };
            }
        }
    });

    const employees = [];
    const otherExpenses = [];

    (selectedFixedExpenses || []).forEach(exp => {
        const cat = normalize(exp.category || exp.description || '');
        const amount = Number(exp.amount) || 0;
        if (cat.includes('funcionario') || cat.includes('folha')) {
            employees.push({ ...exp, amount, normName: cat });
        } else {
            otherExpenses.push({ ...exp, amount, normName: cat });
        }
    });

    const categoryMappings = [
        { key: 'energia', match: (n) => n.includes('energia') },
        { key: 'agua', match: (n) => n.includes('agua') },
        { key: 'internet', match: (n) => n.includes('internet') },
        { key: 'contador', match: (n) => n.includes('contador') },
        { key: 'iptu', match: (n) => n.includes('iptu') },
        { key: 'limpeza', match: (n) => n.includes('limpeza') || n.includes('faxina') },
        { key: 'aluguel', match: (n) => n.includes('aluguel') },
    ];

    const handledExpenseIds = new Set();

    categoryMappings.forEach(mapping => {
        const matched = otherExpenses.filter(e => mapping.match(e.normName));
        if (matched.length > 0) {
            const totalVal = matched.reduce((sum, item) => sum + item.amount, 0);
            matched.forEach(m => handledExpenseIds.add(m.id));
            if (expensesMap[mapping.key]) {
                expensesMap[mapping.key].value = totalVal;
            }
        }
    });

    // Funcionários: Todos separados
    if (employees.length > 0) {
        const emp1 = employees[0];
        handledExpenseIds.add(emp1.id);
        if (expensesMap['folha']) {
            expensesMap['folha'].value = emp1.amount;
        }
    }

    const additionalExpenses = [];
    if (employees.length > 1) {
        const emp2 = employees[1];
        handledExpenseIds.add(emp2.id);
        if (expensesMap['extra folha']) {
            expensesMap['extra folha'].value = emp2.amount;
        } else {
            const extraFolhaExisting = (existingExpenses || []).find(e => normalize(e.name) === 'extra folha');
            if (extraFolhaExisting) {
                expensesMap['extra folha'] = { ...extraFolhaExisting, value: emp2.amount };
            } else {
                additionalExpenses.push({
                    id: `emp-1-extra-folha-${Date.now()}`,
                    name: 'extra folha',
                    value: emp2.amount
                });
            }
        }
    }

    // Se houver mais de 2 funcionários, adiciona linhas separadas com o nome de cada um
    for (let i = 2; i < employees.length; i++) {
        const empN = employees[i];
        handledExpenseIds.add(empN.id);
        const name = empN.category || empN.description || `Funcionário ${i + 1}`;
        additionalExpenses.push({
            id: `emp-1-func-${Date.now()}-${i}`,
            name: name,
            value: empN.amount
        });
    }

    // Demais despesas marcadas avulsas (ex: GPT, ADONAI, etc.)
    otherExpenses.forEach(exp => {
        if (!handledExpenseIds.has(exp.id)) {
            const existing = (existingExpenses || []).find(e => normalize(e.name) === exp.normName);
            if (existing) {
                if (expensesMap[exp.normName]) {
                    expensesMap[exp.normName].value = exp.amount;
                } else {
                    expensesMap[exp.normName] = { ...existing, value: exp.amount };
                }
            } else {
                additionalExpenses.push({
                    id: `emp-1-custom-${Date.now()}-${exp.id}`,
                    name: exp.category || exp.description || 'Outro',
                    value: exp.amount
                });
            }
        }
    });

    const result = baseStandard.map(b => expensesMap[b.key] || { id: b.id, name: b.name, value: 0 });

    if (expensesMap['extra folha']) {
        result.push(expensesMap['extra folha']);
    }

    (existingExpenses || []).forEach(e => {
        const norm = normalize(e.name);
        const isStandard = baseStandard.some(b => b.key === norm) || norm === 'extra folha';
        if (!isStandard && !result.some(r => r.id === e.id)) {
            result.push(expensesMap[norm] || e);
        }
    });

    additionalExpenses.forEach(add => {
        if (!result.some(r => r.name.toLowerCase() === add.name.toLowerCase())) {
            result.push(add);
        }
    });

    return result;
};
