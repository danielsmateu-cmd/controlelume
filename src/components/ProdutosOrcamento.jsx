import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Trash2, Search, Package } from 'lucide-react';

const ProdutosOrcamento = ({ onProductSelect }) => {
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadProdutos();
    }, []);

    const loadProdutos = async () => {
        setLoading(true);
        const data = await api.getOrcamentoProdutos();
        setProdutos(data);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (confirm("Tem certeza que deseja excluir este produto?")) {
            await api.deleteOrcamentoProduto(id);
            loadProdutos();
        }
    };

    const filteredProdutos = produtos.filter(p => 
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.descricao && p.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar produto cadastrado..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Carregando produtos...</div>
            ) : filteredProdutos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <Package size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum produto encontrado</h3>
                    <p className="text-gray-500">Crie itens no seu Orçamento e clique em 'Salvar como Produto' para eles aparecerem aqui.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimensões Base (L x A x P)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProdutos.map(produto => (
                                <tr key={produto.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-800">{produto.nome}</div>
                                        {produto.descricao && <div className="text-xs text-gray-500 mt-1">{produto.descricao}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            {produto.largura} x {produto.altura} x {produto.profundidade} mm
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {onProductSelect && (
                                            <button 
                                                onClick={() => onProductSelect(produto)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                title="Importar para o orçamento"
                                            >
                                                Importar
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(produto.id)}
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

export default ProdutosOrcamento;
