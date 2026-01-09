"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Verifica se o usuário pode usar a IA (NÃO incrementa o contador)
export async function checkUsageLimit() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                        // Server Actions can't set cookies in some contexts, but needed for auth
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                        // Handle
                    }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Usuário não autenticado");
    }

    const now = new Date();
    // Adjust for BRT (UTC-3)
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brtDate.toISOString().split('T')[0];

    // 0. Get Subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user.id)
        .single();

    let plan = subscription?.plan || 'trial';
    let status = subscription?.status || 'trial';

    // Check expiration
    if (subscription?.current_period_end) {
        const expiry = new Date(subscription.current_period_end);
        if (now > expiry && plan !== 'vip') {
            status = 'overdue';
        }
    }

    // 1. Get current usage
    const { data: usage, error } = await supabase
        .from('daily_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching usage:", error);
        return { allowed: true, count: 0 };
    }

    const currentCount = usage?.count || 0;

    // Logic:
    // VIP = Always allowed
    if (plan === 'vip') {
        return { allowed: true, count: currentCount };
    }
    // Overdue Logic
    if (status === 'overdue') {
        return { allowed: false, count: currentCount, message: `IA bloqueada. Fatura vencida.` };
    }
    // Canceled = Blocked immediately
    if (status === 'canceled') {
        return { allowed: false, count: currentCount, message: "Assinatura cancelada." };
    }

    // Plan Limits (Light & Trial)
    if (plan === 'light' || plan === 'trial') {
        if (currentCount >= 10) return { allowed: false, count: currentCount };
    }

    // Apenas verifica, NÃO incrementa
    return { allowed: true, count: currentCount };
}

// Incrementa o contador de uso - chamar APENAS quando a ação for bem-sucedida (mensagem verde)
export async function incrementUsage() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) { }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) { }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { count: 0 };

    const now = new Date();
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brtDate.toISOString().split('T')[0];

    // Get current usage
    const { data: usage } = await supabase
        .from('daily_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    const currentCount = usage?.count || 0;

    // Increment
    const { error: upsertError } = await supabase
        .from('daily_usage')
        .upsert({
            user_id: user.id,
            date: today,
            count: currentCount + 1
        }, { onConflict: 'user_id, date' });

    if (upsertError) {
        console.error("Error incrementing usage:", upsertError);
        return { count: currentCount };
    }

    return { count: currentCount + 1 };
}

// Mantém compatibilidade com código antigo (deprecated - usar checkUsageLimit + incrementUsage)
export async function checkAndIncrementUsage() {
    const limit = await checkUsageLimit();
    if (!limit.allowed) return limit;
    const result = await incrementUsage();
    return { allowed: true, count: result.count };
}

export async function getDailyUsage() {
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
    if (!user) return 0;

    const now = new Date();
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brtDate.toISOString().split('T')[0];

    const { data: usage } = await supabase
        .from('daily_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    return usage?.count || 0;
}

export async function refundUsageAction() {
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
    if (!user) return;

    const now = new Date();
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brtDate.toISOString().split('T')[0];

    // Get current usage
    const { data: usage } = await supabase
        .from('daily_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    if (usage && usage.count > 0) {
        await supabase
            .from('daily_usage')
            .update({ count: usage.count - 1 })
            .eq('user_id', user.id)
            .eq('date', today);
    }
}
