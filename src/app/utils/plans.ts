export const plansData = [
    {
        name: 'LIGHT',
        price: 'R$ 19,90/mês',
        value: 19.90,
        features: [
            '10 interações com IA por dia',
            'Agenda ilimitada',
            'Gestão financeira completa',
            'Cadastro de clientes',
            'Suporte por email',
        ],
    },
    {
        name: 'PRO',
        price: 'R$ 39,90/mês',
        value: 39.90,
        features: [
            '✨ IA Ilimitada',
            'Agenda ilimitada',
            'Gestão financeira completa',
            'Cadastro de clientes',
            'Suporte prioritário',
            'Relatórios avançados',
        ],
        isMostPopular: true,
    },
];

export function getPlanDisplayName(plan: string) {
    switch (plan) {
        case 'light':
            return 'Plano Light';
        case 'pro':
            return 'Plano Pro';
        case 'vip':
            return 'Plano VIP';
        case 'trial':
            return 'Período de Testes';
        default:
            return plan.charAt(0).toUpperCase() + plan.slice(1);
    }
}
