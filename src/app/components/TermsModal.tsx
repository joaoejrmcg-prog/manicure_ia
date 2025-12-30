'use client';

import { useState, useEffect } from 'react';
import { acceptTerms, checkTermsAccepted } from '../actions/auth';
import { ShieldCheck, ScrollText } from 'lucide-react';

export default function TermsModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const accepted = await checkTermsAccepted();
            setIsOpen(!accepted);
        } catch (error) {
            console.error('Error checking terms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setAccepting(true);
        try {
            await acceptTerms();
            setIsOpen(false);
        } catch (error) {
            console.error('Error accepting terms:', error);
            alert('Erro ao aceitar os termos. Tente novamente.');
        } finally {
            setAccepting(false);
        }
    };

    if (loading || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Termos de Uso</h2>
                        <p className="text-sm text-gray-500">Atualizado em Dezembro de 2025</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto text-gray-600 text-sm leading-relaxed space-y-4">
                    <p className="font-medium text-gray-800">Bem-vindo ao nosso Sistema de Gestão Profissional!</p>

                    <p>
                        Antes de continuar, precisamos que você leia e aceite nossos termos de uso.
                        Este é um compromisso de transparência e segurança entre nós.
                    </p>

                    <h3 className="font-bold text-gray-800 mt-4">1. O Serviço</h3>
                    <p>
                        Nossa plataforma oferece ferramentas de gestão, agendamento e inteligência artificial para auxiliar profissionais liberais.
                        O uso da IA é um suporte e não substitui a decisão final do profissional.
                    </p>

                    <h3 className="font-bold text-gray-800 mt-4">2. Assinatura e Cancelamento</h3>
                    <p>
                        Nossos planos funcionam no modelo de assinatura recorrente. Você pode cancelar a qualquer momento.
                        Ao cancelar, você continuará com acesso até o fim do período já pago. Não há reembolso para períodos parciais não utilizados.
                    </p>

                    <h3 className="font-bold text-gray-800 mt-4">3. Seus Dados (LGPD)</h3>
                    <p>
                        Seus dados e os dados de seus clientes pertencem a você. Nós utilizamos essas informações apenas para fornecer o serviço contratado.
                        Adotamos medidas de segurança para proteger suas informações.
                    </p>

                    <h3 className="font-bold text-gray-800 mt-4">4. Responsabilidades</h3>
                    <p>
                        Você é responsável por manter sua senha segura e pelas informações inseridas no sistema.
                        O uso ético da ferramenta é fundamental.
                    </p>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-gray-500 text-center sm:text-left">
                        Ao clicar em aceitar, você concorda com todos os termos acima.
                    </p>
                    <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {accepting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Processando...
                            </>
                        ) : (
                            <>
                                <ScrollText className="w-4 h-4" />
                                Li e Aceito os Termos
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
