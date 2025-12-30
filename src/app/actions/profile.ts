"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Retorna dados completos do perfil do usuário
 */
export async function getUserProfile() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Buscar profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp, referral_code')
        .eq('user_id', user.id)
        .single();

    // Buscar subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user.id)
        .single();

    return {
        email: user.email,
        whatsapp: profile?.whatsapp,
        referralCode: profile?.referral_code,
        plan: subscription?.plan || 'trial',
        status: subscription?.status || 'trial',
        currentPeriodEnd: subscription?.current_period_end,
    };
}

/**
 * Retorna informações detalhadas da assinatura
 */
export async function getSubscriptionDetails() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user.id)
        .single();

    if (!subscription) return null;

    // Calcular dias restantes
    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const diffTime = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determinar limite de IA
    let aiLimit = 'Ilimitado';
    if (subscription.plan === 'light') {
        aiLimit = '10 interações/dia';
    }

    // Determinar se é vitalício (VIP)
    const isLifetime = subscription.plan === 'vip' || endDate.getFullYear() >= 2099;

    // Lógica de acesso: Ativo se status for 'active', 'trial' OU 'canceled' com dias restantes
    const isActive = subscription.status === 'active' ||
        subscription.status === 'trial' ||
        (subscription.status === 'canceled' && daysRemaining > 0);

    return {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        daysRemaining: isLifetime ? null : daysRemaining,
        aiLimit,
        isLifetime,
        isActive,
    };
}

/**
 * Cancela a assinatura do usuário
 */
export async function cancelSubscription() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Atualiza status para canceled, mas MANTÉM a data de fim
    const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
}

