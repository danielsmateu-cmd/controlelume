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

    const [expenses, setExpenses] = useState(() => {
        const saved = localStorage.getItem('expenses');
        return saved ? JSON.parse(saved) : initialFixedExpenses;
    });

    const [orders, setOrders] = useState(() => {
        const saved = localStorage.getItem('orders');
        return saved ? JSON.parse(saved) : [
            {
                id: 1,
                clientName: 'João Silva',
                description: 'Camiseta personalizada G',
                orderDate: `${currentYear}-02-10`,
                value: 85.00,
                paymentDate: `${currentYear}-02-12`,
                isPaid: true,
                paymentMethod: 'Pix/Transferência',
                year: currentYear
            }
        ];
    });

    const [notes, setNotes] = useState(() => {
        const saved = localStorage.getItem('notes');
        return saved ? JSON.parse(saved) : [
            { id: 1, description: 'Exemplo de anotação', value: 150.00, date: '2024-02-11' }
        ];
    });

    const [materials, setMaterials] = useState(() => {
        const saved = localStorage.getItem('materials');
        return saved ? JSON.parse(saved) : [
            { id: 1, name: 'Acrílico 2mm - CRISTAL', pricePerM2: 250.00, width: 200, height: 100, price: 500.00 },
            { id: 2, name: 'Acrílico 3mm - CRISTAL', pricePerM2: 350.00, width: 200, height: 100, price: 700.00 },
        ];
    });

    // Set default active tab based on role when user first logs in
    useEffect(() => {
        if (currentUser) {
            if (canView('resumo')) setActiveTab('resumo');
            else setActiveTab('orcamentos');
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
        };
        loadData();
    }, []);

    // Persist to localStorage + Supabase on change
    useEffect(() => {
        localStorage.setItem('expenses', JSON.stringify(expenses));
        api.saveExpenses(expenses);
    }, [expenses]);

    useEffect(() => {
        localStorage.setItem('orders', JSON.stringify(orders));
        api.saveOrders(orders);
    }, [orders]);

    useEffect(() => {
        localStorage.setItem('notes', JSON.stringify(notes));
        api.saveNotes(notes);
    }, [notes]);

    useEffect(() => {
        localStorage.setItem('materials', JSON.stringify(materials));
    }, [materials]);

    const handleExportBackup = () => {
        const data = { expenses, orders, notes, materials };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_controle_web_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = () => {
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

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasData.length ? despesasData : [{}]), 'Despesas');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendasData.length ? vendasData : [{}]), 'Vendas');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anotacoesData.length ? anotacoesData : [{}]), 'Anotações');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materiaisData.length ? materiaisData : [{}]), 'Materiais');

        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `controle_antigravity_${date}.xlsx`);
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
                return canView('resumo')
                    ? <Resumo expenses={expenses} orders={orders} />
                    : <Orcamentos materials={materials} setMaterials={setMaterials} />;
        }
    };

    if (!currentUser) {
        return <Login />;
    }

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onExportExcel={handleExportExcel}
            />
            <main className="flex-1 overflow-y-auto p-8">
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
