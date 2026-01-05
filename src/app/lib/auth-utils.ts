import { supabase } from "./supabase";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Realiza o logout do usuário.
 * Se o usuário tiver biometria ativada, faz apenas um "Soft Logout" (limpa sessão local),
 * mantendo o refresh token válido no servidor para o próximo login biométrico.
 * 
 * Se não tiver biometria, faz o logout completo (invalida token no servidor).
 */
export const performLogout = async (router: AppRouterInstance) => {
    const hasBiometrics = typeof window !== 'undefined' && localStorage.getItem('biometric_enrolled') === 'true';

    if (hasBiometrics) {
        console.log('[AUTH] Performing Soft Logout for Biometric User');

        // Soft Logout: Limpa apenas sessão local do Supabase
        // Isso preserva o refresh token no servidor para ser usado pela biometria depois

        // 1. Identificar chaves do Supabase no localStorage
        // O padrão é `sb-<project-ref>-auth-token`
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                keysToRemove.push(key);
            }
        }

        // 2. Remover chaves de sessão
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // 3. Forçar redirecionamento e refresh para limpar estado da memória
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('justLoggedOut', 'true');
        }
        router.push('/login');
        router.refresh();

        // Pequeno delay para garantir que a UI atualize
        setTimeout(() => {
            window.location.href = '/login';
        }, 100);

    } else {
        console.log('[AUTH] Performing Hard Logout');
        // Hard Logout: Invalida token no servidor
        await supabase.auth.signOut();
        router.push('/login');
    }
};
