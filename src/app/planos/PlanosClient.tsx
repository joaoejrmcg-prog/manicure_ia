"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import PlanCard from "../components/PlanCard";

interface PlanosClientProps {
    currentPlan: string;
}

export default function PlanosClient({ currentPlan }: PlanosClientProps) {
    const [showMessage, setShowMessage] = useState(false);

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

    const handleSelectPlan = (planName: string) => {
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 3000);
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

                {/* Mensagem de aviso */}
                {showMessage && (
                    <div className="mb-6 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-lg animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-blue-400" size={20} />
                            <div>
                                <p className="font-semibold text-blue-300">Em breve - Pagamento via boleto</p>
                                <p className="text-sm text-blue-400/80">Estamos finalizando a integração de pagamentos. Aguarde!</p>
                            </div>
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
                            onSelect={() => handleSelectPlan(plan.name)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
