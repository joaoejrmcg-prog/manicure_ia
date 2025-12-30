"use client";

import ClientList from "../components/ClientList";
import ActionFeed from "../components/ActionFeed";
import { DashboardProvider, useDashboard } from "../context/DashboardContext";
import { BarChart3, TrendingUp, Users } from "lucide-react";

function DashboardContent() {
    const { metrics } = useDashboard();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-100">Visão Geral</h1>
                    <p className="text-neutral-500">Visão geral do seu negócio</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-neutral-500">Agendamentos Hoje</span>
                        <div className="p-2 bg-neutral-800 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-neutral-400" />
                        </div>
                    </div>
                    <span className="text-3xl font-bold text-neutral-200">{metrics.appointmentsToday}</span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-neutral-500">Faturamento Mês</span>
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <span className="text-emerald-500 font-bold text-xs">R$</span>
                        </div>
                    </div>
                    <span className="text-3xl font-bold text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.incomeMonth)}
                    </span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-neutral-500">Novos Clientes</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Users className="w-4 h-4 text-blue-500" />
                        </div>
                    </div>
                    <span className="text-3xl font-bold text-blue-400">{metrics.newClientsMonth}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
                {/* Feed de Ações */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <h2 className="text-lg font-semibold text-neutral-300 mb-4">Atividades Recentes</h2>
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-1 overflow-hidden">
                        <ActionFeed />
                    </div>
                </div>

                {/* Lista de Clientes */}
                <div className="lg:col-span-1 h-full flex flex-col">
                    <h2 className="text-lg font-semibold text-neutral-300 mb-4">Seus Clientes</h2>
                    <div className="flex-1 overflow-hidden">
                        <ClientList />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <DashboardProvider>
            <DashboardContent />
        </DashboardProvider>
    );
}
