"use client";

import { useEffect, useState } from "react";
import { DataManager } from "../lib/data-manager";
import { Client } from "../types";
import { Search, UserPlus, MoreHorizontal } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

export default function ClientList() {
    const { clients, loading } = useDashboard();
    const [searchTerm, setSearchTerm] = useState("");

    // Removed local fetch logic in favor of context

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between gap-4">
                <h3 className="font-medium text-neutral-200">Meus Clientes</h3>
                <div className="relative">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm text-neutral-200 focus:border-blue-500/50 outline-none w-48 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading ? (
                    <div className="p-8 text-center text-neutral-500 text-sm">Carregando...</div>
                ) : filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 text-sm">
                        {searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                    </div>
                ) : (
                    filteredClients.map((client) => (
                        <div key={client.id} className="group flex items-center justify-between p-3 hover:bg-neutral-800/50 rounded-xl transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                    {client.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-neutral-200">{client.name}</p>
                                    {client.phone && <p className="text-xs text-neutral-500">{client.phone}</p>}
                                </div>
                            </div>
                            <button className="p-2 text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
