"use client";

import CommandCenter from "./components/CommandCenter";
import ActionFeed from "./components/ActionFeed";
import { Sparkles } from "lucide-react";
import { DashboardProvider } from "./context/DashboardContext";
import SubscriptionStatus from "./components/SubscriptionStatus";

function HomeContent() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-end max-w-4xl mx-auto w-full md:p-4">
      <div className="w-full flex-1 flex flex-col relative overflow-hidden">

        <div className="relative z-10 flex flex-col h-full">
          <SubscriptionStatus />



          {/* Chat Area */}
          <div className="flex-1 min-h-0 w-full max-w-xl mx-auto flex flex-col">
            <CommandCenter />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-1">
        <p className="text-xs text-neutral-600">
          &copy; 2026 Meu Negócio.
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}
            className="ml-1 underline hover:text-blue-400 transition-colors"
          >
            Termo
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
