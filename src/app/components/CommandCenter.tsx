"use client";

import { useRef, useEffect } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { VoiceOrb } from "./VoiceOrb";
import { useCommandCenterLogic } from "../hooks/useCommandCenterLogic";
import { useTutorial } from "../context/TutorialContext";
import TutorialOverlay from "./TutorialOverlay";

export default function CommandCenter() {
    const {
        input,
        setInput,
        messages,
        isProcessing,
        usageCount,
        inputType,
        isSpeaking,
        userPlan,
        isListening,
        startListening,
        stopListening,
        handleSubmit,
        setInputType
    } = useCommandCenterLogic();

    const {
        tutorialState,
        shouldShowTutorialButton,
        startTutorial,
    } = useTutorial();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [input]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-neutral-900 rounded-2xl border-2 border-neutral-600 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b-2 border-neutral-600 bg-neutral-800 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 border-2 border-blue-400/50 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Assistente IA</h3>
                        <p className="text-xs text-neutral-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                            <span className="mx-1 text-neutral-700">•</span>
                            {['vip', 'pro'].includes(userPlan.toLowerCase()) ? (
                                <span className="text-blue-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Ilimitado
                                </span>
                            ) : (
                                <span className={usageCount >= 10 ? "text-red-400" : "text-neutral-200"}>
                                    {Math.max(0, 10 - usageCount)} respostas verdes restantes
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 transition-all duration-300",
                (isListening || (isProcessing && inputType === 'voice') || isSpeaking) && "pb-[350px]"
            )}>
                {/* Tutorial Overlay - Always show when active */}
                {tutorialState !== 'IDLE' && <TutorialOverlay />}

                {/* Welcome message - Only when no messages and no tutorial */}
                {messages.length === 0 && tutorialState === 'IDLE' && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-70">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400/40 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-blue-300" />
                        </div>
                        <h4 className="text-lg font-medium text-white mb-2">
                            Olá! Sou sua secretária.
                        </h4>
                        {shouldShowTutorialButton ? (
                            <p className="text-sm text-neutral-300 max-w-xs">
                                Vamos{' '}
                                <button
                                    onClick={startTutorial}
                                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium transition-colors"
                                >
                                    fazer um tutorial
                                </button>
                                ?
                            </p>
                        ) : (
                            <p className="text-sm text-neutral-300 max-w-xs">
                                Vamos começar? Diga algo como "Cadastra a Maria" ou "Agenda corte amanhã às 10h".
                            </p>
                        )}
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex w-full",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-full md:max-w-[80%] rounded-2xl px-4 py-3 text-lg",
                                msg.role === 'user'
                                    ? "bg-blue-600 text-white rounded-tr-none border-2 border-blue-400"
                                    : cn(
                                        "bg-neutral-800 text-white rounded-tl-none border-2 border-neutral-500",
                                        msg.type === 'error' && "border-red-400 bg-red-500/20 text-red-100",
                                        msg.type === 'success' && "border-green-400 bg-green-500/20 text-green-100"
                                    )
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-1 opacity-70 text-xs uppercase tracking-wider font-medium text-blue-300">
                                    <Bot className="w-3 h-3" />
                                    IA
                                </div>
                            )}
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-neutral-800 border-t-2 border-neutral-600">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setInputType('text');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={isListening ? "Ouvindo..." : "Digite..."}
                        className="flex-1 bg-neutral-700 border-2 border-neutral-500 text-white text-sm placeholder:text-neutral-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all outline-none resize-none min-h-[44px] max-h-[200px] overflow-y-hidden"
                        disabled={isProcessing}
                        rows={1}
                    />


                    {input.trim() ? (
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={isProcessing}
                            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors border-2 border-blue-400 disabled:opacity-50 shadow-lg shadow-blue-500/30"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    ) : (
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-2.5 rounded-xl transition-all duration-300",
                                isListening
                                    ? "bg-red-500/30 text-red-300 hover:bg-red-500/40 animate-pulse border-2 border-red-400"
                                    : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200 hover:text-white border-2 border-neutral-500"
                            )}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                    )}
                </div>
                <p className="hidden md:block text-[10px] text-center text-neutral-400 mt-2">
                    Enter para enviar • Shift + Enter para quebrar linha
                </p>
            </div>
            {(isListening || (isProcessing && inputType === 'voice') || isSpeaking) && (
                <VoiceOrb mode={isSpeaking ? 'SPEAKING' : (isProcessing ? 'PROCESSING' : 'LISTENING')} />
            )}
        </div>
    );
}
