'use client';

import { useState } from 'react';
import { cancelSubscription } from '../actions/profile';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CancelSubscription() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCancel = async () => {
        setLoading(true);
        try {
            await cancelSubscription();
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error canceling subscription:', error);
            alert('Erro ao cancelar assinatura. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-sm text-red-500 hover:text-red-600 hover:underline font-medium transition-colors"
            >
                Cancelar Assinatura
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                                <AlertTriangle className="w-6 h-6" />
                                Cancelar Assinatura
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Tem certeza que deseja cancelar? <br />
                            <span className="font-medium text-gray-800">Você continuará com acesso aos recursos Premium até o fim do período atual.</span>
                            <br /><br />
                            Após essa data, sua conta voltará para o plano Grátis.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                Manter Assinatura
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
