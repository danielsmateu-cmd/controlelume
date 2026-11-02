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
 * puxando nome e valor reais diretamente da Saída para funcionários e outras despesas.
 */
export const buildLumeExpensesFromFixed = (selectedFixedExpenses, existingExpenses = []) => {
    // Contas de consumo e utilidades padrão da empresa
    const baseStandard = [
        { id: '1-e', name: 'Energia', match: (n) => n.includes('energia') },
        { id: '1-a', name: 'Agua', match: (n) => n.includes('agua') },
        { id: '1-i', name: 'Internet', match: (n) => n.includes('internet') },
        { id: '1-c', name: 'Contador', match: (n) => n.includes('contador') },
        { id: '1-ip', name: 'IPTU', match: (n) => n.includes('iptu') },
        { id: '1-l', name: 'Limpeza', match: (n) => n.includes('limpeza') || n.includes('faxina') },
        { id: '1-al', name: 'Aluguel', match: (n) => n.includes('aluguel') },
    ];

    const handledExpenseIds = new Set();
    const result = [];

    // 1. Preenche as contas de consumo padrão
    baseStandard.forEach(std => {
        const existing = (existingExpenses || []).find(e => 
            e.id === std.id || std.match(normalize(e.name))
        );
        const matchedFixed = (selectedFixedExpenses || []).filter(e => {
            const norm = normalize(e.category || e.description || '');
            return std.match(norm);
        });

        let val = existing ? existing.value : 0;
        if (matchedFixed.length > 0) {
            val = matchedFixed.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            matchedFixed.forEach(m => handledExpenseIds.add(m.id));
        }

        result.push({
            id: existing ? existing.id : std.id,
            name: existing ? existing.name : std.name,
            value: val
        });
    });

    // 2. Todos os demais gastos selecionados (Funcionários e despesas extras):
    // Puxa o NOME e o VALOR exatos vindos da aba Saída!
    const remainingFixed = (selectedFixedExpenses || []).filter(e => !handledExpenseIds.has(e.id));

    remainingFixed.forEach(exp => {
        const exactName = (exp.category || exp.description || 'Despesa').trim();
        const normName = normalize(exactName);
        const amount = Number(exp.amount) || 0;

        const existing = (existingExpenses || []).find(e => normalize(e.name) === normName);

        if (existing) {
            result.push({
                ...existing,
                name: exactName,
                value: amount
            });
        } else {
            result.push({
                id: `emp-1-${exp.id || Date.now()}`,
                name: exactName,
                value: amount
            });
        }
        handledExpenseIds.add(exp.id);
    });

    // 3. Mantém despesas manuais extras pré-existentes na LUME que não sejam folha genérica
    const hasEmployeeFromSaida = remainingFixed.some(e => {
        const n = normalize(e.category || e.description || '');
        return n.includes('funcionario') || n.includes('folha');
    });

    (existingExpenses || []).forEach(e => {
        const norm = normalize(e.name);
        const isStandard = baseStandard.some(std => std.id === e.id || std.match(norm));
        const isGenericFolha = norm === 'folha' || norm === 'extra folha';
        const alreadyInResult = result.some(r => r.id === e.id || normalize(r.name) === norm);

        if (!isStandard && !alreadyInResult) {
            // Se já puxamos funcionários reais com seus nomes (ex: Bordim, Brenno),
            // descarta as antigas linhas genéricas "Folha" e "extra folha"
            if (isGenericFolha && hasEmployeeFromSaida) {
                return;
            }
            result.push(e);
        }
    });

    return result;
};
