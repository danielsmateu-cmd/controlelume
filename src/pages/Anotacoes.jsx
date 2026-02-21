import React, { useState } from 'react';
import { Plus, Trash2, Calendar, DollarSign, FileText } from 'lucide-react';
import clsx from 'clsx';

const Anotacoes = ({ notes, setNotes, readOnly = false }) => {
    const [newNote, setNewNote] = useState({
        description: '',
        value: '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleAddNote = (e) => {
        e.preventDefault();
        if (!newNote.description || !newNote.value || !newNote.date) return;

        const noteToAdd = {
            id: Date.now(),
            description: newNote.description,
            value: parseFloat(newNote.value),
            date: newNote.date,
            isPaid: false
        };

        setNotes([noteToAdd, ...notes]);
        setNewNote({
            description: '',
            value: '',
            date: new Date().toISOString().split('T')[0]
        });
    };

    const toggleNoteStatus = (id) => {
        setNotes(notes.map(note =>
            note.id === id ? { ...note, isPaid: !note.isPaid } : note
        ));
    };

    const handleDeleteNote = (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta anotação?')) {
            setNotes(notes.filter(note => note.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Anotações</h2>
                {readOnly && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                        👁️ Somente Visualização
                    </span>
                )}
            </div>

            {/* Form - hidden when readOnly */}
            {!readOnly && (
                <form onSubmit={handleAddNote} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <FileText size={16} className="text-indigo-500" /> Descritivo
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Compra de materiais"
                            value={newNote.description}
                            onChange={(e) => setNewNote({ ...newNote, description: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>

                    <div className="w-full md:w-48 space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <DollarSign size={16} className="text-green-500" /> Valor
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={newNote.value}
                            onChange={(e) => setNewNote({ ...newNote, value: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>

                    <div className="w-full md:w-48 space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Calendar size={16} className="text-blue-500" /> Data
                        </label>
                        <input
                            type="date"
                            value={newNote.date}
                            onChange={(e) => setNewNote({ ...newNote, date: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            type="submit"
                            className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={20} /> Adicionar
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="space-y-4">
                {notes.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-500">Nenhuma anotação encontrada.</p>
                    </div>
                ) : (
                    notes.map((note) => (
                        <div key={note.id} className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{note.description}</h4>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} /> {new Date(note.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className="font-bold text-indigo-600">
                                        {note.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {note.value > 0 && (
                                    <button
                                        onClick={() => !readOnly && toggleNoteStatus(note.id)}
                                        disabled={readOnly}
                                        className={clsx("w-24 text-[11px] py-1 rounded-full font-bold border transition-all",
                                            readOnly ? "cursor-default" : "cursor-pointer shadow-sm",
                                            note.isPaid
                                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                        )}>
                                        {note.isPaid ? 'PAGO' : 'PENDENTE'}
                                    </button>
                                )}
                                {!readOnly && (
                                    <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Anotacoes;
