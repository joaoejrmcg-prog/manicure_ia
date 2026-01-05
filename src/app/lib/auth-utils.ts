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

        // 1. Salvar dados biométricos
        const biometricData = {
            credential: localStorage.getItem('biometric_credential'),
            email: localStorage.getItem('biometric_email'),
            refreshToken: localStorage.getItem('biometric_refresh_token'),
            enrolled: localStorage.getItem('biometric_enrolled')
        };

        // 2. Limpar TUDO do localStorage (garante que sessão do Supabase morra)
        localStorage.clear();

        // 3. Restaurar dados biométricos
        if (biometricData.credential) localStorage.setItem('biometric_credential', biometricData.credential);
        if (biometricData.email) localStorage.setItem('biometric_email', biometricData.email);
        if (biometricData.refreshToken) localStorage.setItem('biometric_refresh_token', biometricData.refreshToken);
        if (biometricData.enrolled) localStorage.setItem('biometric_enrolled', biometricData.enrolled);

        // 4. Redirecionar com flag na URL (mais robusto que sessionStorage)
        router.push('/login?logged_out=true');
        router.refresh();

    } else {
        console.log('[AUTH] Performing Hard Logout');
        await supabase.auth.signOut();
        router.push('/login');
    }
};
