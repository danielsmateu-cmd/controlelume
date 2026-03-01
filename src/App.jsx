import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Resumo from './pages/Resumo';
import Saida from './pages/Saida';
import Entradas from './pages/Entradas';
import Anotacoes from './pages/Anotacoes';
import Orcamentos from './pages/Orcamentos';
import Tarefas from './pages/Tarefas';
import Login from './pages/Login';
import { api } from './services/api';

function AppContent() {
    const { currentUser, canEdit, canView } = useAuth();
    const [activeTab, setActiveTab] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // SHARED STATE
    const fixedCategories = ['ENERGIA', 'AGUA', 'INTERNET', 'DAS', 'CONTADOR', 'IPTU', 'FAXINA', 'DARE', 'FUNCIONARIO'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentYear = new Date().getFullYear();

    const initialFixedExpenses = months.flatMap((monthName, monthIndex) =>
        fixedCategories.map((cat, catIndex) => ({
            id: `fixed-${currentYear}-${monthIndex}-${catIndex}`,
            type: 'fixos',
            year: currentYear,
            month: monthIndex,
            category: cat,
            description: `${cat} - ${monthName}`,
            amount: 0,
            date: `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`,
            dueDate: `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-10`,
            paid: false
        }))
    );

    const [expenses, setExpenses] = useState(initialFixedExpenses);

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

    // Load from Supabase on mount
    useEffect(() => {
        const loadData = async () => {
            const [dbExpenses, dbOrders, dbNotes, dbMaterials] = await Promise.all([
                api.getExpenses(),
                api.getOrders(),
                api.getNotes(),
                api.getMaterials()
            ]);
            if (dbExpenses && dbExpenses.length > 0) setExpenses(dbExpenses);
            if (dbOrders && dbOrders.length > 0) setOrders(dbOrders);
            if (dbNotes && dbNotes.length > 0) setNotes(dbNotes);
            if (dbMaterials && dbMaterials.length > 0) setMaterials(dbMaterials);
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Persist to localStorage + Supabase on change
    useEffect(() => {
        if (isLoading) return;
        localStorage.setItem('expenses', JSON.stringify(expenses));
        api.saveExpenses(expenses);
    }, [expenses, isLoading]);

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
                return <Anotacoes />;
            case 'orcamentos':
                return <Orcamentos materials={materials} setMaterials={setMaterials} />;
            case 'tarefas':
                return <Tarefas />;
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
        <div className="flex h-screen bg-gray-100 print:bg-white">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onExportExcel={handleExportExcel}
            />
            <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
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
