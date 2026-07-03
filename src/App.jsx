import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Resumo from './pages/Resumo';
import Saida from './pages/Saida';
import Entradas from './pages/Entradas';
import Anotacoes from './pages/Anotacoes';
import Orcamentos from './pages/Orcamentos';
import Compras from './pages/Compras';
import Tarefas from './pages/Tarefas';
import ECommerce from './pages/ECommerce';
import SimulacaoDescontos from './pages/ecommerce/SimulacaoDescontos';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import EstudoProdutos from './pages/EstudoProdutos';
import { api } from './services/api';

function AppContent() {
    const { currentUser, canEdit, canView } = useAuth();
    const [activeTab, setActiveTab] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // SHARED STATE
    const currentYear = new Date().getFullYear();

    const [expenses, setExpenses] = useState([]);

    const [orders, setOrders] = useState([]);

    const [notes, setNotes] = useState([]);

    const [materials, setMaterials] = useState(() => {
        const saved = localStorage.getItem('materials');
        return saved ? JSON.parse(saved) : [
            { id: 1, name: 'Acrílico 2mm - CRISTAL', pricePerM2: 250.00, width: 200, height: 100, price: 500.00 },
            { id: 2, name: 'Acrílico 3mm - CRISTAL', pricePerM2: 350.00, width: 200, height: 100, price: 700.00 },
        ];
    });

    // Set default active tab when user first logs in
    useEffect(() => {
        if (currentUser) {
            setActiveTab('home');
        }
    }, [currentUser?.id]);

    // Load from database/localStorage on mount or user change
    useEffect(() => {
        const loadData = async () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // Auto-reset for Test User: clear localStorage on session start
            if (currentUser.login === 'teste') {
                const hasClearedThisSession = sessionStorage.getItem('teste_auto_cleared');
                if (!hasClearedThisSession) {
                    console.log('Auto-resetting data for test user...');
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key?.startsWith('teste_')) {
                            localStorage.removeItem(key);
                            i--;
                        }
                    }
                    sessionStorage.setItem('teste_auto_cleared', 'true');

                    // Reset standard keys as well just in case they were used
                    ['expenses', 'orders', 'notes', 'materials', 'budgets'].forEach(k => localStorage.removeItem(k));
                }
            }

            try {
                const [dbExpenses, dbOrders, dbNotes, dbMaterials] = await Promise.all([
                    api.getExpenses(),
                    api.getOrders(),
                    api.getNotes(),
                    api.getMaterials()
                ]);

                // Set state (if test user and we just cleared, these will be empty/defaults)
                if (dbExpenses && dbExpenses.length > 0) {
                    setExpenses(dbExpenses);
                } else {
                    setExpenses([]);
                }

                if (dbOrders && dbOrders.length > 0) {
                    setOrders(dbOrders);
                } else {
                    setOrders([]);
                }

                if (dbNotes && dbNotes.length > 0) {
                    setNotes(dbNotes);
                } else {
                    setNotes([]);
                }

                if (dbMaterials && dbMaterials.length > 0) {
                    setMaterials(dbMaterials);
                }
                
                setIsOffline(false);
            } catch (err) {
                console.warn('Erro ao carregar dados do banco. Usando dados locais...', err);
                setIsOffline(true);

                // Carregar dados salvos no localStorage
                try {
                    const savedExpenses = localStorage.getItem('expenses');
                    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));

                    const savedOrders = localStorage.getItem('orders');
                    if (savedOrders) setOrders(JSON.parse(savedOrders));

                    const savedNotes = localStorage.getItem('notes');
                    if (savedNotes) setNotes(JSON.parse(savedNotes));

                    const savedMaterials = localStorage.getItem('materials');
                    if (savedMaterials) setMaterials(JSON.parse(savedMaterials));
                } catch (e) {
                    console.error('Erro ao ler do localStorage:', e);
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [currentUser?.id]);

    // Persist to localStorage + Supabase on change
    useEffect(() => {
        if (isLoading) return;
        localStorage.setItem('expenses', JSON.stringify(expenses));

        if (isOffline) return;

        const handler = setTimeout(() => {
            api.saveExpenses(expenses);
        }, 1500);

        return () => {
            clearTimeout(handler);
        };
    }, [expenses, isLoading, isOffline]);

    useEffect(() => {
        if (isLoading) return;
        localStorage.setItem('orders', JSON.stringify(orders));
    }, [orders, isLoading]);

    useEffect(() => {
        if (isLoading) return;
        localStorage.setItem('notes', JSON.stringify(notes));
    }, [notes, isLoading]);

    useEffect(() => {
        if (isLoading) return;
        localStorage.setItem('materials', JSON.stringify(materials));
    }, [materials, isLoading]);

    const handleExportBackup = async () => {
        try {
            const budgets = await api.getBudgets();
            const data = { expenses, orders, notes, materials, budgets };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_controle_web_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Erro ao exportar backup:', err);
            alert('Falha ao exportar backup. Tente novamente.');
        }
    };

    const handleExportExcel = async () => {
        try {
            const budgets = await api.getBudgets();
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

            // Aba Despesas
            const despesasData = expenses.map(e => ({
                'Tipo': e.type === 'fixos' ? 'Fixo' : 'Variável',
                'Categoria': e.category,
                'Descrição': e.description,
                'Mês': months[e.month] || '',
                'Ano': e.year,
                'Valor (R$)': e.amount || 0,
                'Data': e.date || '',
                'Vencimento': e.dueDate || '',
                'Pago': e.paid ? 'Sim' : 'Não',
                'Pessoas': e.people || ''
            }));

            // Aba Vendas
            const vendasData = orders.map(o => ({
                'Cliente': o.clientName,
                'Descrição': o.description,
                'Data Pedido': o.orderDate || '',
                'Ano': o.year,
                'Valor (R$)': o.value || 0,
                'Forma Pagamento': o.paymentMethod || '',
                'Data Pagamento': o.paymentDate || '',
                'Pago': o.isPaid ? 'Sim' : 'Não'
            }));

            // Aba Anotações
            const anotacoesData = notes.map(n => ({
                'Descrição': n.description,
                'Valor (R$)': n.value || 0,
                'Data': n.date || ''
            }));

            // Aba Materiais
            const materiaisData = materials.map(m => ({
                'Nome': m.name,
                'Tipo': m.type === 'unit' ? 'Unidade' : m.type === 'linear' ? 'Linear' : 'Chapa',
                'Largura (cm)': m.width || '',
                'Altura (cm)': m.height || '',
                'Preço Unitário (R$)': m.price || 0,
                'Preço/m² (R$)': m.pricePerM2 || 0
            }));

            // Aba Orçamentos
            const orcamentosData = budgets.map(b => ({
                'Data': b.date ? new Date(b.date).toLocaleDateString('pt-BR') : '',
                'Cliente': b.clientData?.name || '',
                'Telefone': b.clientData?.phone || '',
                'Qtd Itens': b.items ? b.items.length : 0,
                'Valor Total (R$)': b.total || 0,
                'Status': b.status === 'aprovado' ? 'Aprovado' : b.status === 'reprovado' ? 'Reprovado' : 'Pendente'
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasData.length ? despesasData : [{}]), 'Despesas');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendasData.length ? vendasData : [{}]), 'Vendas');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anotacoesData.length ? anotacoesData : [{}]), 'Anotações');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materiaisData.length ? materiaisData : [{}]), 'Materiais');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orcamentosData.length ? orcamentosData : [{}]), 'Orçamentos');

            const date = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `controle_antigravity_${date}.xlsx`);
        } catch (err) {
            console.error('Erro ao exportar planilha:', err);
            alert('Falha ao exportar planilha. Tente novamente.');
        }
    };

    const handleImportBackup = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.expenses && data.orders && data.notes) {
                    setExpenses(data.expenses);
                    setOrders(data.orders);
                    setNotes(data.notes);
                    if (data.materials) setMaterials(data.materials);
                    alert('Backup restaurado com sucesso!');
                } else {
                    alert('Arquivo de backup inválido.');
                }
            } catch (err) {
                alert('Erro ao ler o arquivo de backup.');
            }
        };
        reader.readAsText(file);
    };

    const renderContent = () => {
        if (activeTab === 'home') {
            return (
                <div className="flex h-full w-full items-center justify-center">
                    <img src="/Logo LUME.png" alt="Controle Lume Logo" className="w-[400px] h-auto" />
                </div>
            );
        }

        switch (activeTab) {
            case 'resumo':
                return <Resumo expenses={expenses} orders={orders} />;
            case 'saida':
                return <Saida expenses={expenses} setExpenses={setExpenses} readOnly={!canEdit('saida')} />;
            case 'vendas':
                return <Entradas orders={orders} setOrders={setOrders} readOnly={!canEdit('vendas')} />;
            case 'contas':
                return <Anotacoes readOnly={!canEdit('contas')} />;
            case 'orcamentos':
                return <Orcamentos materials={materials} setMaterials={setMaterials} readOnly={!canEdit('orcamentos')} setActiveTab={setActiveTab} />;
            case 'compras':
                return <Compras materials={materials} readOnly={!canEdit('compras')} />;
            case 'estudo_produtos':
                return <EstudoProdutos readOnly={!canEdit('estudo_produtos')} />;
            case 'ecommerce':
                return <ECommerce readOnly={!canEdit('ecommerce')} />;
            case 'simulacao':
                return <SimulacaoDescontos readOnly={!canEdit('simulacao')} />;
            case 'tarefas':
                return <Tarefas />;
            case 'usuarios':
                return <Usuarios />;
            default:
                return (
                    <div className="flex h-full w-full items-center justify-center">
                        <img src="/Logo LUME.png" alt="Controle Lume Logo" className="w-[400px] h-auto" />
                    </div>
                );
        }
    };

    if (!currentUser) {
        return <Login />;
    }

    return (
        <div className="flex h-screen bg-gray-100 print:bg-white print:block print:h-auto">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onExportExcel={handleExportExcel}
            />
            <main className="flex-1 ml-0 md:ml-16 overflow-y-auto p-8 print:p-0 print:overflow-visible print:block print:h-auto print:ml-0">
                {isOffline && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-sm text-amber-800 shadow-sm print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                            <div>
                                <strong className="font-semibold">Modo Offline Ativo:</strong> O banco de dados (Supabase) está temporariamente inacessível. Você está usando e salvando dados localmente no navegador.
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 active:scale-95 transition-all shadow-sm shadow-amber-600/20"
                        >
                            Reconectar
                        </button>
                    </div>
                )}
                {renderContent()}
            </main>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
