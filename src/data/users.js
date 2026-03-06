// Usuários do sistema com seus perfis de acesso
// Roles:
//   admin          -> acesso total a tudo
//   editor         -> edita Orçamentos, Produção e Tarefas; restante só visualização
//   budget_only    -> somente Orçamentos e Produção (edição completa)
//   producao_only  -> somente tela de Produção

export const USERS = [
    {
        id: 1,
        login: 'dsmateu',
        password: 'master64',
        name: 'D. Mateu',
        role: 'admin'
    },
    {
        id: 2,
        login: 'jsmateu',
        password: 'adm164',
        name: 'J. Mateu',
        role: 'editor'
    },
    {
        id: 3,
        login: 'bsmateu',
        password: 'adm264',
        name: 'B. Mateu',
        role: 'editor'
    },
    {
        id: 4,
        login: 'user4',
        password: 'user4',
        name: 'Usuário 4',
        role: 'budget_only'
    },
    {
        id: 5,
        login: 'user5',
        password: 'user5',
        name: 'Usuário 5',
        role: 'budget_only'
    },
    {
        id: 6,
        login: 'producao',
        password: 'producao',
        name: 'Produção',
        role: 'producao_only'
    },
    {
        id: 99,
        login: 'teste',
        password: 'teste',
        name: 'Usuário de Teste',
        role: 'admin'
    }
];

// Permissões por role
export const ROLE_PERMISSIONS = {
    admin: {
        visibleTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas', 'ecommerce', 'tarefas'],
        editableTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas', 'ecommerce', 'tarefas'],
        canExportImport: true
    },
    editor: {
        visibleTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas', 'ecommerce', 'tarefas'],
        editableTabs: ['orcamentos', 'contas', 'tarefas'],
        canExportImport: false
    },
    budget_only: {
        visibleTabs: ['orcamentos', 'contas'],
        editableTabs: ['orcamentos', 'contas'],
        canExportImport: false
    },
    producao_only: {
        visibleTabs: ['contas'],
        editableTabs: ['contas'],
        canExportImport: false
    }
};

export function authenticate(login, password) {
    return USERS.find(u => u.login === login && u.password === password) || null;
}
