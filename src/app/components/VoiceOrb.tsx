import React from 'react';
import { cn } from "@/app/lib/utils";

export const VoiceOrb = ({ mode = 'LISTENING' }: { mode?: 'LISTENING' | 'PROCESSING' | 'SPEAKING' }) => {
    return (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
            <style jsx>{`
                @keyframes colorCycle {
                    0% { filter: hue-rotate(0deg) brightness(1); }
                    50% { filter: hue-rotate(180deg) brightness(1.2); }
                    100% { filter: hue-rotate(360deg) brightness(1); }
                }
                .animate-color-cycle {
                    animation: colorCycle 3s linear infinite;
                }
            `}</style>
            {/* Gradient Background - Fades out upwards */}
            <div className="absolute bottom-0 left-0 right-0 h-[250px] bg-gradient-to-t from-black via-black/95 to-transparent" />

            {/* Content Container */}
            <div className="relative w-full flex flex-col items-center justify-end pb-8 z-10">

                {/* Text Label */}
                <div className="mb-4 text-white/90 font-medium tracking-widest text-sm uppercase animate-pulse transition-all duration-500">
                    {mode === 'LISTENING' && "Ouvindo..."}
                    {mode === 'PROCESSING' && "Processando..."}
                    {mode === 'SPEAKING' && "Falando..."}
                </div>

                {/* Flattened Glow Bar Container */}
                <div className={cn(
                    "relative w-full h-[60px] flex items-end justify-center overflow-hidden",
                    mode === 'SPEAKING' && "animate-color-cycle"
                )}>

                    {/* Main Horizontal Bar */}
                    <div className={cn(
                        "absolute bottom-0 h-1.5 bg-white rounded-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(255,255,255,0.8)]",
                        mode === 'SPEAKING' ? "w-[95%] opacity-100" : "w-[30%] opacity-60 animate-pulse"
                    )} />

                    {/* Wide Glow Layer 1 (Violet) */}
                    <div className={cn(
                        "absolute bottom-0 h-[100px] bg-violet-600/50 blur-[40px] rounded-t-full transition-all duration-500",
                        mode === 'SPEAKING' ? "w-full opacity-80" : "w-[60%] opacity-40"
                    )} />

                    {/* Wide Glow Layer 2 (Blue/Cyan) */}
                    <div className={cn(
                        "absolute bottom-0 h-[80px] bg-cyan-500/40 blur-[30px] rounded-t-full transition-all duration-500 delay-75",
                        mode === 'SPEAKING' ? "w-[90%] opacity-80" : "w-[40%] opacity-30"
                    )} />

                    {/* Wide Glow Layer 3 (Warm) */}
                    <div className={cn(
                        "absolute bottom-0 h-[60px] bg-rose-500/30 blur-[25px] rounded-t-full transition-all duration-500 delay-150",
                        mode === 'SPEAKING' ? "w-[80%] opacity-70" : "w-[20%] opacity-0"
                    )} />
                </div>
            </div>
        </div>
    );
};
