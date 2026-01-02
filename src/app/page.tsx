"use client";

import CommandCenter from "./components/CommandCenter";
import ActionFeed from "./components/ActionFeed";
import { Sparkles } from "lucide-react";
import { DashboardProvider } from "./context/DashboardContext";
import SubscriptionStatus from "./components/SubscriptionStatus";

function HomeContent() {
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center max-w-4xl mx-auto w-full md:p-4">
      <div className="w-full flex-1 flex flex-col relative overflow-hidden">

        <div className="relative z-10 flex flex-col h-full">
          {/* Header Minimalista */}
          <div className="text-center mb-4 flex-shrink-0">
            <h1 className="text-lg font-light text-neutral-200 tracking-tight flex items-center justify-center gap-3">
              Olá, como posso ajudar?
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium">
                <Sparkles className="w-3 h-3" />
                <span>IA</span>
              </span>
            </h1>
          </div>

          <SubscriptionStatus />



          {/* Chat Area */}
          <div className="flex-1 min-h-0 w-full max-w-xl mx-auto flex flex-col">
            <CommandCenter />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center p-2">
        <p className="text-xs text-neutral-600">
          &copy; 2025 Meu Negócio. Gestão Inteligente.
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}
            className="ml-2 underline hover:text-blue-400 transition-colors"
          >
            Termos de Uso
          </button>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardProvider>
      <HomeContent />
    </DashboardProvider>
  );
}
