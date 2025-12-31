"use client";

import { useState, useEffect } from "react";
import { Bell, ChevronRight, Lightbulb, X } from "lucide-react";

const TIPS = [
    "🎁 Quer 30 dias de acesso VIP grátis? Toque no botão 'Indicar Amigos' no seu perfil e compartilhe seu link exclusivo!",
    "💡 Você sabia que não precisa digitar? Toque no microfone e diga: 'Marca o João amanhã às 10h'. Eu preencho a agenda para você!",
    "🚫 Ainda não faço parcelamentos (ex: '3x no cartão'). Por enquanto, registre o valor total da venda de uma vez só.",
    "📅 Quer uma visão geral do mês? Acesse o menu 'Agenda' para ver seu calendário completo de compromissos.",
    "💰 Anotar despesas é vital! Diga: 'Gastei 50 reais de gasolina' e eu abato isso do seu faturamento diário.",
    "💅 Conhece uma Manicure? Indique o app! Ela pode agendar a próxima cliente sem parar de fazer a unha da atual, usando apenas a voz.",
    "⏳ Contas a pagar futuras (agendadas) ainda não estão disponíveis. Registre a despesa apenas no dia que você realmente pagar.",
    "🐘 Eu lembro dos seus clientes! Se o cliente já veio antes, basta dizer o primeiro nome que eu encontro o cadastro.",
    "🛑 Atingiu o limite diário da IA? Não se preocupe! Você pode continuar registrando tudo manualmente pelos menus do aplicativo.",
    "🚀 Tente dizer tudo de uma vez para ser mais produtivo: 'Cadastra a Ana, marca ela pra terça às 14h e anota que ela já pagou 50 reais no Pix'.",
    "📝 Ainda não controlo 'Fiado' ou contas a receber. Registre a venda apenas quando o cliente efetuar o pagamento.",
    "💵 Especifique como recebeu para seu caixa bater certinho! Diga: 'Recebi 100 reais no Dinheiro' ou 'Recebi 200 no Cartão'.",
    "🌿 Jardineiros adoram este app! É ideal para agendar a manutenção mensal dos clientes recorrentes em segundos.",
    "❌ Imprevistos acontecem. Se alguém desistir, apenas diga: 'A Maria cancelou' e eu libero o horário na sua agenda.",
    "📈 Quer ver seu lucro? Pergunte: 'Quanto eu ganhei hoje?' e eu somo tudo o que você registrou.",
    "🚚 Quem faz fretes usa muito nosso sistema! É fácil dizer 'Agendar mudança do Carlos para sábado' enquanto dirige.",
    "🔮 Olhe para o futuro! Pergunte: 'O que eu tenho pra semana que vem?' e prepare-se com antecedência.",
    "🏆 Descubra quem valoriza seu trabalho. Pergunte: 'Quem foi meu melhor cliente esse mês?'.",
    "📚 Professores particulares podem organizar as aulas dos alunos e saber exatamente quem está devendo a mensalidade.",
    "📝 Ao agendar, fale o serviço específico (ex: 'Marca o Pedro para troca de fiação') para saber quanto tempo vai levar.",
    "📅 O fim do mês não precisa ser estressante. Pergunte 'Agenda de Janeiro' ou 'Faturamento de Dezembro' para ter um panorama completo.",
    "💪 Indique para um Personal Trainer! Ele pode registrar o pagamento da hora/aula entre um exercício e outro.",
    "✏️ Esqueceu de anotar na hora? Diga: 'Ontem eu gastei 30 reais na padaria' e eu ajusto a data para você.",
    "🗣️ Sou treinada para entender sua fala natural. Não precisa falar como robô, fale como se estivesse conversando com uma secretária.",
    "🛋️ Trabalha com Higienização de Estofados? O app ajuda a calcular quanto você gastou de produtos químicos versus o valor do serviço.",
    "☀️ Comece o dia organizado. Ao tomar café, pergunte: 'O que tem pra hoje?' e visualize sua rota.",
    "🔧 Você é Marido de Aluguel? O app é sua caixa de ferramentas administrativa. Agende visitas e cobre serviços em um lugar só.",
    "⚡ Este app é perfeito para Eletricistas registrarem o valor das peças compradas falando 'Gastei X em fios' enquanto estão no alto da escada.",
    "👗 Vende Cosméticos ou Roupas porta a porta? Diga 'Vendi 2 perfumes para a Sônia' e nunca mais perca o controle do fiado.",
    "🐕 Tem um amigo Dog Walker? Indique o app! Ele pode anotar qual cachorro passeou e quem já pagou enquanto caminha no parque.",
    "🛵 Faz entregas por conta própria? Controle quanto gastou de combustível no dia para saber seu lucro real da diária.",
    "❄️ Conhece um Técnico de Ar Condicionado? No verão a agenda lota! Indique o app para ele não perder nenhum chamado na correria.",
    "💈 Barbeiros usam o app para ver qual cliente corta cabelo toda semana e ofereça um plano mensal.",
    "🚗 Indique para seu Mecânico! Ele pode listar as peças que comprou para o carro falando: 'Comprei óleo e filtro por 150 reais'.",
    "🧠 Profissionais liberais como Psicólogos usam o app para organizar a agenda de pacientes sem precisar de uma recepcionista.",
    "🤝 Organizar a vida financeira traz paz. Se este app te ajuda, compartilhe com um amigo autônomo e ajude ele a crescer também!"
];

export default function TipOfTheDay() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);

    useEffect(() => {
        // Define a dica baseada no dia do mês, garantindo que funcione para qualquer tamanho de lista
        const today = new Date().getDate();
        setCurrentTipIndex((today - 1) % TIPS.length);
    }, []);

    const handleNextTip = () => {
        setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-neutral-400 hover:text-yellow-400 transition-colors relative group"
                title="Dica do Dia"
            >
                <Bell className="w-5 h-5 group-hover:animate-swing" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200 h-[100dvh] w-screen"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden relative animate-in zoom-in-95 duration-200 m-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header com gradiente */}
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Lightbulb size={120} />
                            </div>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 z-20 text-white/80 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full p-1"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                    <Lightbulb className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-bold">Dica do Dia #{currentTipIndex + 1}</h3>
                            </div>
                            <p className="text-yellow-50 relative z-10 opacity-90">
                                Um conselho especial para impulsionar seu negócio
                            </p>
                        </div>

                        {/* Conteúdo com rolagem se necessário */}
                        <div className="p-8 text-center overflow-y-auto custom-scrollbar">
                            <p className="text-lg text-neutral-200 font-medium leading-relaxed">
                                "{TIPS[currentTipIndex]}"
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 flex justify-between items-center">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-sm font-medium text-neutral-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handleNextTip}
                                className="flex items-center gap-2 text-sm font-medium text-yellow-500 hover:text-yellow-400 transition-colors px-4 py-2 rounded-lg hover:bg-yellow-500/10"
                            >
                                Ver próxima dica
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
