import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, Search, X, MapPin, Phone, User, Save } from 'lucide-react';

const ClientesOrcamento = ({ onClientSelect }) => {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentCliente, setCurrentCliente] = useState(null);

    const emptyCliente = {
        nome: '',
        documento: '',
        telefone: '',
        email: '',
        endereco: '',
        cidade: '',
        bairro: '',
        cep: '',
        numero: ''
    };

    useEffect(() => {
        loadClientes();
    }, []);

    const loadClientes = async () => {
        setLoading(true);
        const data = await api.getClientes();
        setClientes(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!currentCliente.nome) {
            alert("Nome é obrigatório");
            return;
        }
        await api.saveCliente(currentCliente);
        setIsEditing(false);
        setCurrentCliente(null);
        loadClientes();
    };

    const handleEdit = (cliente) => {
        setCurrentCliente(cliente);
        setIsEditing(true);
    };

    const handleDelete = async (id) => {
        if (confirm("Tem certeza que deseja excluir este cliente?")) {
            await api.deleteCliente(id);
            loadClientes();
        }
    };

    const handleNew = () => {
        setCurrentCliente({ ...emptyCliente });
        setIsEditing(true);
    };

    const filteredClientes = clientes.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.telefone && c.telefone.includes(searchTerm)) ||
        (c.documento && c.documento.includes(searchTerm))
    );

    if (isEditing && currentCliente) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <User size={24} className="text-indigo-600" />
                        {currentCliente.id ? 'Editar Cliente' : 'Novo Cliente'}
                    </h2>
                    <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">Nome / Razão Social *</label>
                            <input
                                type="text"
                                value={currentCliente.nome}
                                onChange={e => setCurrentCliente({...currentCliente, nome: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">CPF / CNPJ</label>
                            <input
                                type="text"
                                value={currentCliente.documento || ''}
                                onChange={e => setCurrentCliente({...currentCliente, documento: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">Telefone / WhatsApp</label>
                            <input
                                type="text"
                                value={currentCliente.telefone || ''}
                                onChange={e => setCurrentCliente({...currentCliente, telefone: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">E-mail</label>
                            <input
                                type="email"
                                value={currentCliente.email || ''}
                                onChange={e => setCurrentCliente({...currentCliente, email: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-800 mt-6 mb-2 border-b pb-2 flex items-center gap-2">
                        <MapPin size={16} /> Endereço
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-600 uppercase">Rua / Logradouro</label>
                            <input
                                type="text"
                                value={currentCliente.endereco || ''}
                                onChange={e => setCurrentCliente({...currentCliente, endereco: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">Número</label>
                            <input
                                type="text"
                                value={currentCliente.numero || ''}
                                onChange={e => setCurrentCliente({...currentCliente, numero: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">Bairro</label>
                            <input
                                type="text"
                                value={currentCliente.bairro || ''}
                                onChange={e => setCurrentCliente({...currentCliente, bairro: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">Cidade</label>
                            <input
                                type="text"
                                value={currentCliente.cidade || ''}
                                onChange={e => setCurrentCliente({...currentCliente, cidade: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600 uppercase">CEP</label>
                            <input
                                type="text"
                                value={currentCliente.cep || ''}
                                onChange={e => setCurrentCliente({...currentCliente, cep: e.target.value})}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
                            <Save size={18} /> Salvar Cliente
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar cliente por nome ou telefone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    />
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 active:scale-95"
                >
                    <Plus size={20} />
                    Novo Cliente
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Carregando clientes...</div>
            ) : filteredClientes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <User size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum cliente encontrado</h3>
                    <p className="text-gray-500">Tente buscar por outro termo ou cadastre um novo cliente.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contato</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cidade</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredClientes.map(cliente => (
                                <tr key={cliente.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-800">{cliente.nome}</div>
                                        {cliente.documento && <div className="text-xs text-gray-500 mt-1">Doc: {cliente.documento}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm text-gray-700">
                                            <Phone size={14} className="text-gray-400" />
                                            {cliente.telefone || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                            <MapPin size={12} />
                                            {cliente.cidade || 'Não informada'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {onClientSelect && (
                                            <button 
                                                onClick={() => onClientSelect(cliente)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                title="Usar neste orçamento"
                                            >
                                                Selecionar
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleEdit(cliente)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(cliente.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ClientesOrcamento;
