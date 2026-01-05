"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { getURL } from "../lib/utils";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import BiometricSetupPrompt from "../components/BiometricSetupPrompt";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const referralCode = searchParams.get('ref');
    const [mode, setMode] = useState<'login' | 'signup'>(referralCode ? 'signup' : 'login');
    const router = useRouter();

    // Biometric states
    const { isSupported, isEnrolled, isLoading: biometricLoading, registerBiometric, authenticateBiometric } = useBiometricAuth();
    const [showBiometricSetup, setShowBiometricSetup] = useState(false);
    const biometricAutoTriggered = useRef(false);

    // Auto-trigger biometric authentication when enrolled
    useEffect(() => {
        const tryBiometricLogin = async () => {
            if (isEnrolled && mode === 'login' && !biometricAutoTriggered.current) {
                biometricAutoTriggered.current = true;

                console.log('[BIOMETRIC] Starting...');
                const authData = await authenticateBiometric();
                console.log('[BIOMETRIC] Data:', { has: !!authData, email: authData?.email, hasToken: !!authData?.refreshToken });

                if (authData) {
                    const { email, refreshToken } = authData;

                    // Try automatic login with refresh token
                    if (refreshToken) {
                        try {
                            console.log('[BIOMETRIC] Attempting automatic login with refresh token...');

                            // Use refreshSession() to get new access token from refresh token
                            const { data, error } = await supabase.auth.refreshSession({
                                refresh_token: refreshToken
                            });

                            if (error) throw error;

                            if (data.session) {
                                console.log('[BIOMETRIC] ✅ Automatic login successful!');
                                // Navigate immediately without waiting
                                window.location.href = '/';
                                return;
                            }
                        } catch (error: any) {
                            console.error('[BIOMETRIC] Refresh token invalid or expired:', error);
                            // Token inválido - limpar dados biométricos
                            localStorage.removeItem('biometric_refresh_token');
                        }
                    }

                    // Fallback: apenas preencher email se não houver token ou se falhou
                    console.log('[BIOMETRIC] Fallback: filling email only');
                    setEmail(email);
                }
            }
        };

        tryBiometricLogin();
    }, [isEnrolled, mode, authenticateBiometric]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    throw new Error("As senhas não coincidem.");
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${getURL()}`,
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

                // After successful login, offer biometric setup if supported and not enrolled
                if (isSupported && !isEnrolled) {
                    setShowBiometricSetup(true);
                    // Don't redirect yet, wait for user decision
                } else {
                    router.refresh();
                    router.push("/");
                }
            }
        } catch (err: any) {
            console.error(err);
            if (err.message === "User already registered") {
                setError("Este email já está cadastrado. Tente fazer login.");
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSetupBiometric = async () => {
        // Obter refresh token da sessão atual do Supabase
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[BIOMETRIC] Setup - Session:', !!session, 'Has Token:', !!session?.refresh_token);

        const refreshToken = session?.refresh_token;

        if (!refreshToken) {
            console.error('[BIOMETRIC] Cannot setup: No refresh token available');
            alert('Erro ao configurar biometria: Sessão inválida. Tente fazer login novamente.');
            return;
        }

        const success = await registerBiometric(email, refreshToken);

        if (success) {
            setShowBiometricSetup(false);
            alert('✅ Biometria ativada com sucesso! Na próxima vez, só use seu dedo!');
            router.refresh();
            router.push("/");
        } else {
            alert('Não foi possível ativar a biometria');
            setShowBiometricSetup(false);
            router.refresh();
            router.push("/");
        }
    };

    const handleSkipBiometric = () => {
        setShowBiometricSetup(false);
        router.refresh();
        router.push("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 relative overflow-hidden">
            {/* Background Effects (Blue Theme) */}
            {/* Background Effects (Blue Theme for Login, Purple for Signup) */}
            <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[128px] transition-colors duration-1000 ${mode === 'login' ? 'bg-blue-600/20' : 'bg-purple-600/20'}`} />
            <div className={`absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[128px] transition-colors duration-1000 ${mode === 'login' ? 'bg-indigo-600/20' : 'bg-green-600/20'}`} />

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr mb-4 shadow-lg transition-all duration-500 ${mode === 'login' ? 'from-blue-500 to-indigo-500 shadow-blue-500/20' : 'from-purple-500 to-green-500 shadow-purple-500/20'}`}>
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent transition-all duration-500 ${mode === 'login' ? 'from-blue-200 to-indigo-400' : 'from-purple-200 to-green-400'}`}>
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
                        {mode === 'signup' && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-medium text-neutral-400 ml-1">Confirmar Senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-600"
                                    required
                                />
                            </div>
                        )}
                        <div className="flex justify-end">
                            {mode === 'login' && (
                                <a href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                    Esqueci minha senha
                                </a>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full p-3 bg-gradient-to-r text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mt-2 ${mode === 'login' ? 'from-blue-600 to-indigo-600 shadow-blue-500/20' : 'from-purple-600 to-green-600 shadow-purple-500/20'}`}
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
                            className={`text-sm transition-colors font-medium ${mode === 'login' ? 'text-blue-400 hover:text-blue-300 text-base font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-neutral-600 mt-8">
                    &copy; 2025 Meu Negócio. Gestão Inteligente.
                </p>
            </div>

            {/* Biometric Setup Prompt */}
            <BiometricSetupPrompt
                isOpen={showBiometricSetup}
                isLoading={biometricLoading}
                onSetup={handleSetupBiometric}
                onSkip={handleSkipBiometric}
            />

            {/* DEBUG PANEL - REMOVE BEFORE PRODUCTION */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-green-400 text-[10px] p-2 font-mono max-h-32 overflow-y-auto z-50 pointer-events-none">
                <p>Status Biometria:</p>
                <p>Suportado: {isSupported ? 'SIM' : 'NÃO'}</p>
                <p>Cadastrado: {isEnrolled ? 'SIM' : 'NÃO'}</p>
                <p>Token Salvo: {typeof window !== 'undefined' && localStorage.getItem('biometric_refresh_token') ? 'SIM' : 'NÃO'}</p>
                <p>Email Salvo: {typeof window !== 'undefined' && localStorage.getItem('biometric_email') || 'Nenhum'}</p>
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
