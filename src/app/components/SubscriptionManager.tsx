"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Zap, CreditCard, FileText, Loader2 } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import SubscriptionBadge from "./SubscriptionBadge";
import CancelSubscription from "../perfil/CancelSubscription";

import { plansData } from "../utils/plans";

interface SubscriptionManagerProps {
    profile: any;
    subscription: any;
}

export default function SubscriptionManager({ profile, subscription }: SubscriptionManagerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch('/api/asaas/invoices', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setInvoices(data.invoices || []);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handlePayInvoice = (invoiceId: string, planName: string) => {
        setSelectedInvoiceId(invoiceId);
        setSelectedPlan(planName);
        setShowPaymentModal(true);
    };

    const handleSubscribe = () => {
        router.push('/planos');
    };

    const handleRenew = () => {
        setSelectedInvoiceId(null);
        setSelectedPlan(profile.plan); // Renew current plan
        setShowPaymentModal(true);
    };

    const handleConfirmPayment = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
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

            let response;

            if (selectedInvoiceId) {
                // Update existing invoice
                response = await fetch('/api/asaas/payment/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        paymentId: selectedInvoiceId,
                        billingType: billingType
                    })
                });
            } else if (selectedPlan) {
                // Create new subscription (or renewal)
                response = await fetch('/api/asaas/checkout', {
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
            } else {
                return;
            }

            const data = await response.json();

            if (response.ok && data.success && data.paymentUrl) {
                router.push(`/planos/sucesso?paymentUrl=${encodeURIComponent(data.paymentUrl)}`);
            } else {
                console.error('Payment error:', data);
                alert('Erro ao processar pagamento: ' + (data.error || JSON.stringify(data.details) || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error('Request error:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
        } finally {
            setIsLoading(false);
            setSelectedInvoiceId(null);
            setSelectedPlan(null);
        }
    };

    return (
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-200">Assinatura</h2>

                {/* Botão de Assinar se for Trial */}
                {profile.plan === 'trial' && (
                    <button
                        onClick={handleSubscribe}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-green-900/20"
                    >
                        Assinar Agora
                    </button>
                )}

                {/* Botão de Pagar Mensalidade se for Ativo (Light ou Pro) */}
                {(profile.plan === 'light' || profile.plan === 'pro') && (
                    <button
                        onClick={handleRenew}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
                    >
                        Pagar Mensalidade
                    </button>
                )}
            </div>

            <SubscriptionBadge plan={profile.plan} status={profile.status} />

            <div className="mt-6 space-y-4">
                {/* Vencimento */}
                <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Calendar className="text-blue-500" size={20} />
                        <div>
                            <p className="text-sm text-neutral-400">Vencimento</p>
                            <p className="font-semibold text-neutral-200">
                                {subscription.isLifetime
                                    ? '♾️ Vitalício'
                                    : new Date(subscription.currentPeriodEnd!).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                    {!subscription.isLifetime && subscription.daysRemaining !== null && (
                        <div className="text-right">
                            <p className="text-2xl font-bold text-blue-500">{subscription.daysRemaining}</p>
                            <p className="text-xs text-neutral-400">dias restantes</p>
                        </div>
                    )}
                </div>

                {/* Limite IA */}
                <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl">
                    <Zap className="text-yellow-500" size={20} />
                    <div>
                        <p className="text-sm text-neutral-400">Uso da IA</p>
                        <p className="font-semibold text-neutral-200">{subscription.aiLimit}</p>
                    </div>
                </div>
            </div>

            {/* Faturas Pendentes */}
            {invoices.length > 0 && (
                <div className="mt-6 border-t border-neutral-800 pt-6">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
                        <FileText size={18} />
                        Faturas Pendentes
                    </h3>
                    <div className="space-y-3">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-white font-medium">{invoice.description}</p>
                                    <p className="text-sm text-neutral-400">
                                        Vence em: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                    <span className="text-white font-bold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                                    </span>
                                    <button
                                        onClick={() => handlePayInvoice(invoice.id, profile.plan)}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Pagar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cancelamento (apenas se não for trial/vitalício e estiver ativo) */}
            {!subscription.isLifetime && profile.plan !== 'trial' && subscription.isActive && (
                <div className="mt-4 pt-4 border-t border-neutral-800 flex justify-center">
                    <CancelSubscription currentPeriodEnd={subscription.currentPeriodEnd} />
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p className="text-neutral-200">Processando...</p>
                    </div>
                </div>
            )}

            {/* Payment Method Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {selectedInvoiceId ? 'Pagar Fatura' : (selectedPlan === profile.plan ? 'Renovar Assinatura' : 'Assinar Plano')}
                        </h2>

                        {/* Plan Selection if not paying invoice */}
                        {!selectedInvoiceId && (
                            <div className="mb-6 space-y-3">
                                <p className="text-neutral-400 text-sm mb-2">Escolha o plano:</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {plansData.map((plan) => (
                                        <button
                                            key={plan.name}
                                            onClick={() => setSelectedPlan(plan.name.toLowerCase())}
                                            className={`p-3 rounded-lg border text-center transition-all ${selectedPlan === plan.name.toLowerCase()
                                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-750'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">{plan.name}</div>
                                            <div className="text-xs mt-1">{plan.price}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-neutral-400 mb-6">Escolha a forma de pagamento.</p>

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
        </div>
    );
}
