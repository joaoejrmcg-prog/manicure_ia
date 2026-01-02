"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import PlanCard from "../components/PlanCard";
import { createBrowserClient } from '@supabase/ssr';

interface PlanosClientProps {
    currentPlan: string;
}

export default function PlanosClient({ currentPlan }: PlanosClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const router = useRouter();

    const plansData = [
        {
            name: 'LIGHT',
            price: 'R$ 19,90/mês',
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

    const handleInitiateCheckout = (planName: string) => {
        setSelectedPlan(planName);
        setShowPaymentModal(true);
    };

    const handleConfirmPayment = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
        if (!selectedPlan) return;

        setIsLoading(true);
        setShowPaymentModal(false);

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            const response = await fetch('/api/asaas/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    plan: selectedPlan.toLowerCase(),
                    billingType: billingType
                })
            });

            const data = await response.json();

            if (response.ok && data.success && data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                console.error('Checkout error:', data);
                alert('Erro ao criar pagamento: ' + (data.error || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error('Request error:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
        } finally {
            setIsLoading(false);
            setSelectedPlan(null);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/perfil" className="text-neutral-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-100">Escolha seu Plano</h1>
                        <p className="text-sm text-neutral-400 mt-1">Selecione o plano ideal para o seu negócio</p>
                    </div>
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p className="text-neutral-200">Gerando link de pagamento...</p>
                        </div>
                    </div>
                )}

                {/* Payment Method Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                            <h2 className="text-xl font-bold text-white mb-4">Como deseja pagar?</h2>
                            <p className="text-neutral-400 mb-6">Escolha a forma de pagamento para o plano <strong>{selectedPlan}</strong>.</p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleConfirmPayment('PIX')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💠</span>
                                        <span className="font-medium text-white">Pix</span>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </button>

                                <button
                                    onClick={() => handleConfirmPayment('BOLETO')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📄</span>
                                        <span className="font-medium text-white">Boleto Bancário</span>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </button>

                                <button
                                    onClick={() => handleConfirmPayment('CREDIT_CARD')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💳</span>
                                        <span className="font-medium text-white">Cartão de Crédito</span>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="mt-6 w-full py-2 text-neutral-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Grid de Planos */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {plansData.map((plan) => (
                        <PlanCard
                            key={plan.name}
                            name={plan.name}
                            price={plan.price}
                            features={plan.features}
                            isCurrentPlan={currentPlan.toUpperCase() === plan.name}
                            isMostPopular={plan.isMostPopular}
                            onSelect={() => handleInitiateCheckout(plan.name)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
