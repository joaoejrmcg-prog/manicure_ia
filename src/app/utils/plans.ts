/**
 * Retorna nome formatado do plano
 */
export function getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
        'vip': 'VIP',
        'pro': 'PRO',
        'light': 'LIGHT',
        'trial': 'TRIAL',
    };
    return names[plan] || plan.toUpperCase();
}

/**
 * Retorna preço do plano
 */
export function getPlanPrice(plan: string): string {
    const prices: Record<string, string> = {
        'vip': 'Vitalício',
        'pro': 'R$ 39,90/mês',
        'light': 'R$ 19,90/mês',
        'trial': 'Grátis (7 dias)',
    };
    return prices[plan] || '-';
}
