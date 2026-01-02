"use client";

import { useEffect, useState } from 'react';
import { getSubscriptionDetails } from '../actions/profile';
import { AlertTriangle, Calendar, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type SubscriptionDetails = {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    daysRemaining: number | null;
    isLifetime: boolean;
    isActive: boolean;
} | null;

export default function SubscriptionStatus() {
    const [subscription, setSubscription] = useState<SubscriptionDetails>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubscription = async () => {
            try {
                const data = await getSubscriptionDetails();
                setSubscription(data);
            } catch (error) {
                console.error("Failed to fetch subscription details", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubscription();
    }, []);

    if (loading || !subscription) return null;

    // Não mostrar nada para VIP/Vitalício
    if (subscription.isLifetime) return null;

    const { daysRemaining, currentPeriodEnd, status } = subscription;
    const endDate = new Date(currentPeriodEnd).toLocaleDateString('pt-BR');
    const isCanceled = status === 'canceled';
    const isExpired = daysRemaining !== null && daysRemaining <= 0;
    const isNearExpiration = daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0;

    // Se cancelado, mostra apenas a data de acesso final, sem avisos de renovação
    if (isCanceled) {
        return (
            <div className="w-full max-w-xl mx-auto mb-4 px-4">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>Seu acesso vai até {endDate}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Se expirado
    if (isExpired) {
        return (
            <div className="w-full max-w-xl mx-auto mb-4 px-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between group hover:bg-red-500/15 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 p-2 rounded-full text-red-400">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <p className="text-red-200 font-medium text-sm">Seu plano venceu</p>
                            <p className="text-red-300/80 text-xs mt-0.5">Continue aproveitando todos os recursos do app.</p>
                        </div>
                    </div>
                    <Link
                        href="/planos"
                        className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
                    >
                        Renovar
                        <ChevronRight size={14} />
                    </Link>
                </div>
            </div>
        );
    }

    // Se próximo do vencimento (<= 5 dias)
    if (isNearExpiration) {
        return (
            <div className="w-full max-w-xl mx-auto mb-4 px-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500/20 p-1.5 rounded-full text-amber-400">
                            <Clock size={16} />
                        </div>
                        <div>
                            <p className="text-amber-200 font-medium text-xs">Vence em {daysRemaining} dias</p>
                            <p className="text-amber-300/80 text-[10px]">Renove para não perder o acesso.</p>
                        </div>
                    </div>
                    <Link
                        href="/planos"
                        className="text-amber-400 hover:text-amber-300 text-xs font-medium underline decoration-amber-500/30 underline-offset-2"
                    >
                        Ver planos
                    </Link>
                </div>
            </div>
        );
    }

    // Padrão: Apenas mostra a data de vencimento de forma discreta
    return (
        <div className="w-full max-w-xl mx-auto mb-2 px-4">
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/50 border border-neutral-800 text-[10px] text-neutral-500">
                    <Calendar size={10} />
                    <span>Plano vence em {endDate}</span>
                </div>
            </div>
        </div>
    );
}
