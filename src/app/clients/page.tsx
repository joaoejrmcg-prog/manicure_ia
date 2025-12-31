"use client";

import { useState, useEffect } from "react";
import { DataManager } from "../lib/data-manager";
import { Client } from "../types";
import { Plus, Search, Edit2, Trash2, X, Save, User, Phone, Mail } from "lucide-react";

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        full_name: "",
        phone: "",
        email: "",
        notes: ""
    });

    const loadClients = async () => {
        setIsLoading(true);
        try {
            const data = await DataManager.getClients();
            setClients(data);
        } catch (error) {
            console.error("Erro ao carregar clientes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    const handleOpenForm = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                full_name: client.full_name || "",
                phone: client.phone || "",
                email: client.email || "",
                notes: client.notes || ""
            });
        } else {
            setEditingClient(null);
            setFormData({
                name: "",
                full_name: "",
                phone: "",
                email: "",
                notes: ""
            });
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingClient(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingClient) {
                await DataManager.updateClient(editingClient.id, formData);
            } else {
                await DataManager.addClient(formData);
            }
            await loadClients();
            handleCloseForm();
        } catch (error: any) {
            console.error("Erro ao salvar cliente:", error);
            alert(error.message || "Erro ao salvar cliente.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cliente?")) {
            try {
                await DataManager.removeClient(id);
                await loadClients();
            } catch (error) {
                console.error("Erro ao excluir cliente:", error);
                alert("Erro ao excluir cliente.");
            }
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-100">Clientes</h1>
                    <p className="text-neutral-400 text-sm">Gerencie seus contatos</p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cliente
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="text-center py-12 text-neutral-500">Carregando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredClients.map(client => (
                        <div key={client.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-neutral-700 transition-colors group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 font-bold">
                                        {client.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-neutral-200">{client.name}</h3>
                                        {client.full_name && <p className="text-xs text-neutral-500">{client.full_name}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenForm(client)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-blue-400">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-400">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-neutral-400">
                                {client.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3 h-3" />
                                        {client.phone}
                                    </div>
                                )}
                                {client.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3 h-3" />
                                        {client.email}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-12 text-neutral-500 bg-neutral-900/50 rounded-2xl border border-neutral-800 border-dashed">
                            Nenhum cliente encontrado.
                        </div>
                    )}
                </div>
            )}

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                            <h2 className="text-lg font-semibold text-neutral-200">
                                {editingClient ? "Editar Cliente" : "Novo Cliente"}
                            </h2>
                            <button onClick={handleCloseForm} className="text-neutral-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Nome na IA (Obrigatório)</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: Maria"
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-neutral-500">Este é o nome que você falará para a IA identificar o cliente.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Ex: Maria da Silva"
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase">Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@exemplo.com"
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Observações</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Preferências, alergias, etc..."
                                    rows={3}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Cliente
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
