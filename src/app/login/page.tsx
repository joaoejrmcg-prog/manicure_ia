"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const router = useRouter();
    const searchParams = useSearchParams();
    const referralCode = searchParams.get('ref');

    useEffect(() => {
        if (referralCode) {
            setMode('signup');
        }
    }, [referralCode]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            referral_code: referralCode
                        }
                    }
                });
                if (error) throw error;
                alert("Cadastro realizado! Verifique seu email ou faça login.");
                setMode('login');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.refresh();
                router.push("/");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 relative overflow-hidden">
            {/* Background Effects (Blue Theme) */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 mb-4 shadow-lg shadow-blue-500/20">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-indigo-400 bg-clip-text text-transparent">
                            Meu Negócio
                        </h1>
                        <p className="text-sm text-neutral-400 mt-2">
                            {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                        </p>
                    </div>

                    {referralCode && mode === 'signup' && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs p-3 rounded-lg text-center mb-6 animate-pulse">
                            🎉 Código de indicação aplicado!
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400 ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-600"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400 ml-1">Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-600"
                                required
                            />
                        </div>
                        <div className="flex justify-end">
                            <a href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                Esqueci minha senha
                            </a>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mt-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                            className="text-sm text-neutral-500 hover:text-blue-400 transition-colors"
                        >
                            {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-neutral-600 mt-8">
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

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="text-blue-500 animate-spin" /></div>}>
            <LoginForm />
        </Suspense>
    );
}
