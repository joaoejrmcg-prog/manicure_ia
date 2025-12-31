import React from 'react';
import { cn } from "@/app/lib/utils";

export const VoiceOrb = ({ mode = 'LISTENING' }: { mode?: 'LISTENING' | 'PROCESSING' | 'SPEAKING' }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-[300px] h-[300px] md:w-[500px] md:h-[500px]">
                {/* Core Glow */}
                <div className={cn(
                    "absolute inset-0 bg-white/20 rounded-full blur-[100px] transition-all duration-1000",
                    mode === 'SPEAKING' ? "animate-pulse scale-110" : "animate-pulse"
                )} />

                {/* Orb Layers */}
                <div className="absolute inset-0 mix-blend-screen opacity-80 animate-orb-1">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 blur-[80px]" />
                </div>

                <div className="absolute inset-0 mix-blend-screen opacity-80 animate-orb-2">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 blur-[80px]" />
                </div>

                <div className="absolute inset-0 mix-blend-screen opacity-80 animate-orb-3">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-orange-400 to-rose-400 blur-[80px]" />
                </div>
            </div>

            <div className="absolute bottom-20 text-white/80 font-medium tracking-widest text-sm uppercase animate-pulse transition-all duration-500">
                {mode === 'LISTENING' && "Ouvindo..."}
                {mode === 'PROCESSING' && "Processando..."}
                {mode === 'SPEAKING' && "Falando..."}
            </div>
        </div>
    );
};
