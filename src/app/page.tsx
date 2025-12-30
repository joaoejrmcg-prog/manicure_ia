"use client";

import CommandCenter from "./components/CommandCenter";
import ClientList from "./components/ClientList";
import ActionFeed from "./components/ActionFeed";
import { Sparkles } from "lucide-react";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";

function DashboardContent() {
  const { metrics } = useDashboard();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Main Area - Command Center */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ActionFeed />
        <div className="bg-gradient-to-br from-blue-900/20 to-neutral-900 border border-blue-500/10 rounded-3xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden flex-1">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10"></div>

          <div className="relative z-10 max-w-lg w-full space-y-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                <span>IA Ativa e Pronta</span>
              </div>
              <h2 className="text-3xl font-light text-neutral-200">
                Como posso ajudar hoje?
              </h2>
              <p className="text-neutral-500">
                Gerencie agendamentos, financeiro e clientes apenas conversando.
              </p>
            </div>

            <CommandCenter />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 h-32">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-neutral-500">Agendamentos Hoje</span>
            <span className="text-2xl font-bold text-neutral-200">{metrics.appointmentsToday}</span>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-neutral-500">Faturamento Mês</span>
            <span className="text-2xl font-bold text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.incomeMonth)}
            </span>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-neutral-500">Novos Clientes</span>
            <span className="text-2xl font-bold text-blue-400">{metrics.newClientsMonth}</span>
          </div>
        </div>
      </div>

      {/* Sidebar Area - Client List */}
      <div className="lg:col-span-1 h-full">
        <ClientList />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
