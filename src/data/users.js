// Usuários do sistema com seus perfis de acesso
// Roles:
//   admin       -> acesso total a tudo
//   editor      -> edita Orçamentos, visualização no restante
//   budget_only -> somente tela de Orçamentos (edição completa)

export const USERS = [
    {
        id: 1,
        login: 'admmaster',
        password: 'master64',
        name: 'Administrador',
        role: 'admin'
    },
    {
        id: 2,
        login: 'adm1',
        password: 'adm164',
        name: 'ADM 1',
        role: 'editor'
    },
    {
        id: 3,
        login: 'adm2',
        password: 'adm264',
        name: 'ADM 2',
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
    }
];

// Permissões por role
export const ROLE_PERMISSIONS = {
    admin: {
        visibleTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas'],
        editableTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas'],
        canExportImport: true
    },
    editor: {
        visibleTabs: ['resumo', 'saida', 'vendas', 'orcamentos', 'contas'],
        editableTabs: ['orcamentos'],
        canExportImport: false
    },
    budget_only: {
        visibleTabs: ['orcamentos'],
        editableTabs: ['orcamentos'],
        canExportImport: false
    }
};

export function authenticate(login, password) {
    return USERS.find(u => u.login === login && u.password === password) || null;
}
