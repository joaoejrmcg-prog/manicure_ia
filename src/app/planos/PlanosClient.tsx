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
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/perfil" className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Escolha seu Plano</h1>
                        <p className="text-sm text-gray-500 mt-1">Selecione o plano ideal para o seu negócio</p>
                    </div>
                </div>

                {/* Mensagem de aviso */}
                {showMessage && (
                    <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-blue-500" size={20} />
                            <div>
                                <p className="font-semibold text-blue-800">Em breve - Pagamento via boleto</p>
                                <p className="text-sm text-blue-600">Estamos finalizando a integração de pagamentos. Aguarde!</p>
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

                {/* Código de Indicação */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-sm p-6 text-white text-center">
                    <h3 className="text-xl font-bold mb-2">🎁 Tem um código de indicação?</h3>
                    <p className="text-blue-100 mb-4">
                        Ganhe 30 dias grátis ao se cadastrar com o código de um amigo!
                    </p>
                    <Link
                        href="/indique"
                        className="inline-block bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-200"
                    >
                        Indicar e Ganhar Benefícios
                    </Link>
                </div>

                {/* Info VIP */}
                <div className="mt-6 p-6 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl shadow-sm text-center">
                    <h3 className="text-xl font-bold text-white mb-2">⭐ Plano VIP</h3>
                    <p className="text-yellow-50 text-sm">
                        Parceiros e amigos especiais têm acesso vitalício! Entre em contato para mais informações.
                    </p>
                </div>
            </div>
        </div>
    );
}
