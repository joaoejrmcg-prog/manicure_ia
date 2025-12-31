'use client';

import { useState } from 'react';
import { sendSupportMessage } from '../actions/support';
import { HelpCircle, Mail, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';

export default function AjudaPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const faqs = [
        {
            question: "Como funciona o limite de IA?",
            answer: "O limite de interações com a IA depende do seu plano. No plano Light, você tem 10 interações por dia. No plano PRO e VIP, o uso é ilimitado."
        },
        {
            question: "Posso cancelar a qualquer momento?",
            answer: "Sim! Você pode cancelar sua assinatura quando quiser através da página de Perfil. Seu acesso continuará ativo até o fim do período já pago."
        },
        {
            question: "Como funcionam os pagamentos?",
            answer: "Atualmente aceitamos pagamentos via boleto bancário. O boleto é gerado mensalmente e enviado para seu email."
        },
        {
            question: "Meus dados estão seguros?",
            answer: "Absolutamente. Seguimos rigorosamente a LGPD e utilizamos criptografia de ponta para proteger seus dados e os de seus clientes."
        }
    ];

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSending(true);

        const formData = new FormData(e.currentTarget);
        await sendSupportMessage(formData);

        setSending(false);
        setSent(true);
        e.currentTarget.reset();

        setTimeout(() => setSent(false), 5000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
                <HelpCircle className="text-blue-500" />
                Central de Ajuda
            </h1>

            <div className="grid md:grid-cols-2 gap-8">
                {/* FAQ Section */}
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Perguntas Frequentes
                    </h2>

                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <div key={index} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                                <button
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                    className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-neutral-800 transition-colors"
                                >
                                    <span className="font-medium text-neutral-200">{faq.question}</span>
                                    {openFaq === index ? (
                                        <ChevronUp className="w-4 h-4 text-neutral-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-neutral-500" />
                                    )}
                                </button>
                                {openFaq === index && (
                                    <div className="px-4 pb-4 text-sm text-neutral-400 animate-in slide-in-from-top-2 duration-200">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Form */}
                <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 h-fit">
                    <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Fale Conosco
                    </h2>

                    {sent ? (
                        <div className="bg-green-500/10 text-green-400 p-4 rounded-xl text-center animate-in fade-in border border-green-500/20">
                            <p className="font-bold">Mensagem enviada!</p>
                            <p className="text-sm">Responderemos em breve no seu email.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Assunto</label>
                                <select
                                    name="subject"
                                    required
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                >
                                    <option value="">Selecione um assunto</option>
                                    <option value="duvida">Dúvida sobre o sistema</option>
                                    <option value="tecnico">Problema técnico</option>
                                    <option value="financeiro">Financeiro / Pagamentos</option>
                                    <option value="sugestao">Sugestão de melhoria</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Mensagem</label>
                                <textarea
                                    name="message"
                                    required
                                    rows={4}
                                    placeholder="Descreva como podemos ajudar..."
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={sending}
                                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sending ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Enviar Mensagem
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
