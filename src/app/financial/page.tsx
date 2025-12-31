"use client";

import { useState, useEffect } from "react";
import { DataManager } from "../lib/data-manager";
import { FinancialRecord, Client } from "../types";
import { Plus, Search, Edit2, Trash2, X, Save, DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard, User, Share2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function FinancialPage() {
    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

    // Form State
    const [formData, setFormData] = useState<{
        type: 'income' | 'expense';
        amount: string;
        description: string;
        payment_method: string;
        client_id: string;
    }>({
        type: 'income',
        amount: "",
        description: "",
        payment_method: "",
        client_id: ""
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [recordsData, clientsData] = await Promise.all([
                DataManager.getFinancialSummary(),
                DataManager.getClients()
            ]);
            setRecords(recordsData);
            setClients(clientsData);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenForm = (record?: FinancialRecord) => {
        if (record) {
            setEditingRecord(record);
            setFormData({
                type: record.type,
                amount: record.amount.toString(),
                description: record.description,
                payment_method: record.payment_method || "",
                client_id: record.client_id || ""
            });
        } else {
            setEditingRecord(null);
            setFormData({
                type: 'income',
                amount: "",
                description: "",
                payment_method: "",
                client_id: ""
            });
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingRecord(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSave = {
                type: formData.type,
                amount: parseFloat(formData.amount.replace(',', '.')), // Handle comma decimal
                description: formData.description,
                payment_method: formData.payment_method || undefined,
                client_id: formData.client_id || undefined
            };

            if (editingRecord) {
                await DataManager.updateTransaction(editingRecord.id, dataToSave);
            } else {
                await DataManager.addTransaction(dataToSave);
            }
            await loadData();
            handleCloseForm();
        } catch (error) {
            console.error("Erro ao salvar transação:", error);
            alert("Erro ao salvar transação.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta transação?")) {
            try {
                await DataManager.deleteTransaction(id);
                await loadData();
            } catch (error) {
                console.error("Erro ao excluir transação:", error);
                alert("Erro ao excluir transação.");
            }
        }
    };

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.client?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || r.type === filterType;
        return matchesSearch && matchesType;
    });

    const totalBalance = records.reduce((acc, r) => {
        return r.type === 'income' ? acc + r.amount : acc - r.amount;
    }, 0);

    const handleGenerateReport = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyRecords = records.filter(r => {
            const date = new Date(r.created_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const income = monthlyRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
        const expense = monthlyRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
        const balance = income - expense;

        const monthName = now.toLocaleString('pt-BR', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const message = `📊 *Relatório Financeiro - ${capitalizedMonth}/${currentYear}*

✅ *Receitas:* R$ ${income.toFixed(2)}
🔻 *Despesas:* R$ ${expense.toFixed(2)}
💰 *Saldo:* R$ ${balance.toFixed(2)}

_Gerado por Meu Negócio IA_`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-100">Financeiro</h1>
                    <p className="text-neutral-400 text-sm">Controle suas receitas e despesas</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerateReport}
                        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-xl transition-colors font-medium border border-neutral-700"
                    >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden md:inline">Relatório</span>
                    </button>
                    <button
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">Nova Transação</span>
                        <span className="md:hidden">Novo</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-neutral-400">Saldo Total</span>
                    </div>
                    <p className={cn("text-2xl font-bold", totalBalance >= 0 ? "text-green-400" : "text-red-400")}>
                        R$ {totalBalance.toFixed(2)}
                    </p>
                </div>
                {/* Add more summary cards if needed (Income/Expense totals) */}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                        type="text"
                        placeholder="Buscar por descrição ou cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    />
                </div>
                <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                    {(['all', 'income', 'expense'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                filterType === type
                                    ? "bg-neutral-800 text-white shadow-sm"
                                    : "text-neutral-400 hover:text-neutral-200"
                            )}
                        >
                            {type === 'all' ? 'Todos' : type === 'income' ? 'Receitas' : 'Despesas'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="text-center py-12 text-neutral-500">Carregando...</div>
            ) : (
                <div className="space-y-3">
                    {filteredRecords.map(record => (
                        <div key={record.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-neutral-700 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                    record.type === 'income' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                )}>
                                    {record.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-neutral-200">{record.description}</h3>
                                    <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(record.created_at).toLocaleDateString()}
                                        </span>
                                        {record.client && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {record.client.name}
                                            </span>
                                        )}
                                        {record.payment_method && (
                                            <span className="flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" />
                                                {record.payment_method}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 border-neutral-800 pt-3 sm:pt-0">
                                <span className={cn(
                                    "font-bold text-lg sm:text-base",
                                    record.type === 'income' ? "text-green-400" : "text-red-400"
                                )}>
                                    {record.type === 'income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
                                </span>

                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenForm(record)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-blue-400">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(record.id)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-400">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredRecords.length === 0 && (
                        <div className="text-center py-12 text-neutral-500 bg-neutral-900/50 rounded-2xl border border-neutral-800 border-dashed">
                            Nenhuma transação encontrada.
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
                                {editingRecord ? "Editar Transação" : "Nova Transação"}
                            </h2>
                            <button onClick={handleCloseForm} className="text-neutral-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Type Selection */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-800 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={cn(
                                        "py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                        formData.type === 'income'
                                            ? "bg-green-500/20 text-green-400 shadow-sm"
                                            : "text-neutral-400 hover:text-neutral-200"
                                    )}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    Receita
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={cn(
                                        "py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                        formData.type === 'expense'
                                            ? "bg-red-500/20 text-red-400 shadow-sm"
                                            : "text-neutral-400 hover:text-neutral-200"
                                    )}
                                >
                                    <TrendingDown className="w-4 h-4" />
                                    Despesa
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Valor (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">R$</span>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0,00"
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Descrição</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={formData.type === 'income' ? "Ex: Pé e Mão" : "Ex: Conta de Luz"}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>

                            <div className={cn("grid gap-4", formData.type === 'income' ? "grid-cols-2" : "grid-cols-1")}>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase">Pagamento</label>
                                    <input
                                        type="text"
                                        value={formData.payment_method}
                                        onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                                        placeholder="Ex: Pix"
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                {formData.type === 'income' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-500 uppercase">Cliente (Opcional)</label>
                                        <select
                                            value={formData.client_id}
                                            onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                                            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none"
                                        >
                                            <option value="">Selecione...</option>
                                            {clients.map(client => (
                                                <option key={client.id} value={client.id}>
                                                    {client.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Transação
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
