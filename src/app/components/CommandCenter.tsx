"use client";

import { useRef, useEffect } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { VoiceOrb } from "./VoiceOrb";
import { useCommandCenterLogic } from "../hooks/useCommandCenterLogic";

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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [input]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-neutral-200">Assistente IA</h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                            <span className="mx-1 text-neutral-700">•</span>
                            {['vip', 'pro'].includes(userPlan.toLowerCase()) ? (
                                <span className="text-blue-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Ilimitado
                                </span>
                            ) : (
                                <span className={usageCount >= 10 ? "text-red-400" : "text-neutral-400"}>
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
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-blue-400" />
                        </div>
                        <h4 className="text-lg font-medium text-neutral-300 mb-2">Como posso ajudar?</h4>
                        <p className="text-sm text-neutral-500 max-w-xs">
                            Tente dizer: "Agendar reunião com João amanhã às 14h" ou "Recebi 150 reais da consultoria".
                        </p>
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
                                    ? "bg-blue-600 text-white rounded-tr-none"
                                    : cn(
                                        "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700",
                                        msg.type === 'error' && "border-red-500/50 bg-red-500/10 text-red-200",
                                        msg.type === 'success' && "border-green-500/50 bg-green-500/10 text-green-200"
                                    )
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-1 opacity-50 text-xs uppercase tracking-wider font-medium">
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
            <div className="p-4 bg-neutral-900 border-t border-neutral-800">
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
                        placeholder={isListening ? "Ouvindo..." : "Digite ou fale um comando..."}
                        className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none resize-none min-h-[48px] max-h-[120px] scrollbar-thin scrollbar-thumb-neutral-600"
                        disabled={isProcessing}
                        rows={1}
                    />

                    <div className="flex items-center gap-2 pb-1">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-3 rounded-xl transition-all duration-300",
                                isListening
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
                            )}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={!input.trim() || isProcessing}
                            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 shadow-lg shadow-blue-500/20 disabled:shadow-none"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-center text-neutral-600 mt-2">
                    Enter para enviar • Shift + Enter para quebrar linha
                </p>
            </div>
            {(isListening || (isProcessing && inputType === 'voice') || isSpeaking) && (
                <VoiceOrb mode={isSpeaking ? 'SPEAKING' : (isProcessing ? 'PROCESSING' : 'LISTENING')} />
            )}
        </div>
    );
}
