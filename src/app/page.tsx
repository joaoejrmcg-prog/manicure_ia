"use client";

import CommandCenter from "./components/CommandCenter";
import ActionFeed from "./components/ActionFeed";
import { Sparkles } from "lucide-react";
import { DashboardProvider } from "./context/DashboardContext";

function HomeContent() {
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
      <div className="w-full flex-1 flex flex-col bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-5 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Header Minimalista */}
          <div className="text-center mb-4 flex-shrink-0">
            <h1 className="text-2xl font-light text-neutral-200 tracking-tight flex items-center justify-center gap-3">
              Olá, como posso ajudar?
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium">
                <Sparkles className="w-3 h-3" />
                <span>IA</span>
              </span>
            </h1>
          </div>

          {/* Action Feed (Card Superior) */}
          <div className="max-w-xl mx-auto w-full mb-4">
            <ActionFeed />
          </div>

          {/* Chat Area */}
          <div className="flex-1 min-h-0 w-full max-w-xl mx-auto flex flex-col">
            <CommandCenter />
          </div>
        </div>
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
