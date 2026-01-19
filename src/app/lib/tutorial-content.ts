// Tutorial para Profissionais Liberais e Prestadores de Serviço
// autoAdvance: true = avança automaticamente após typewriter, sem botão

export const TUTORIAL_INTRO = [
    {
        id: 'intro_1',
        text: 'Que bom que você está aqui! 👋',
        delay: 50,
        autoAdvance: true,
    },
    {
        id: 'intro_2',
        text: 'Nosso objetivo é simples: você fala, eu faço. Sem complicação.',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'intro_3',
        text: 'Vou te ensinar em 3 etapas rápidas como tirar o máximo desse app.',
        delay: 40,
        // sem autoAdvance = mostra botão Continuar
    },
];

export const TUTORIAL_LEVEL_1 = [
    {
        id: 'l1_step1',
        text: '📌 **Passo 1: Cadastrar um cliente**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l1_step1_detail',
        text: 'Basta dizer algo como: "Cadastra o Sr. Carlos" ou "Nova cliente Dona Maria".',
        delay: 35,
    },
    {
        id: 'l1_step2',
        text: '📌 **Passo 2: Agendar um serviço**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l1_step2_detail',
        text: 'Diga: "Agenda o Carlos pra segunda às 9h" ou "Marca visita na Dona Maria sexta às 14h".',
        delay: 35,
    },
    {
        id: 'l1_step3',
        text: '📌 **Passo 3: Registrar um recebimento**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l1_step3_detail',
        text: 'Após o serviço, diga: "O Carlos pagou 150 reais" ou "Recebi 200 da Dona Maria no Pix".',
        delay: 35,
    },
    {
        id: 'l1_step4',
        text: '💡 **Dica:** Você pode ver seus clientes e agenda nas telas do menu lateral.',
        delay: 35,
    },
    {
        id: 'l1_final',
        text: '🎉 **Parabéns!** Você completou o Nível 1. Quando quiser continuar aprendendo, é só digitar **tutorial**.',
        delay: 30,
    },
];


export const TUTORIAL_LEVEL_2 = [
    {
        id: 'l2_step1',
        text: '📌 **Passo 1: Registrar uma despesa**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step1_detail',
        text: 'Diga: "Gastei 50 reais em gasolina" ou "Comprei material por 120 reais".',
        delay: 35,
    },
    {
        id: 'l2_step2',
        text: '📌 **Passo 2: Contas a pagar (futuras)**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step2_detail',
        text: 'Diga: "Conta de luz vence dia 15, 200 reais" ou "Parcela da ferramenta vence dia 10, 350 reais".',
        delay: 35,
    },
    {
        id: 'l2_step3',
        text: '📌 **Passo 3: Contas a receber (futuras)**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step3_detail',
        text: 'Diga: "O Sr. Paulo vai me pagar 500 dia 20" ou "Dona Ana deve 300 pra sexta".',
        delay: 35,
    },
    {
        id: 'l2_step4',
        text: '📌 **Passo 4: Marcar como pago**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step4_detail',
        text: 'Quando pagar ou receber, diga: "Paguei a conta de luz" ou "Recebi do Sr. Paulo".',
        delay: 35,
    },
    {
        id: 'l2_step5',
        text: '📌 **Passo 5: Desfazer**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step5_detail',
        text: 'Errou algo? Diga: "Cancela", "Desfaz" ou "Me enganei".',
        delay: 35,
    },
    {
        id: 'l2_step6',
        text: '📌 **Passo 6: Consultas**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l2_step6_detail',
        text: 'Pergunte: "O que tem pra hoje?", "Quanto ganhei esse mês?" ou "Quais contas vencem essa semana?".',
        delay: 35,
    },
    {
        id: 'l2_final',
        text: '🎉 **Parabéns!** Você completou o Nível 2. Digite **tutorial** para o Nível 3.',
        delay: 30,
    },
];

export const TUTORIAL_LEVEL_3 = [
    {
        id: 'l3_step1',
        text: '📌 **Passo 1: Serviços parcelados**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l3_step1_detail',
        text: 'Diga: "O Roberto fechou um serviço de 1200 reais em 4 vezes, entrada de 300, primeira parcela dia 15".',
        delay: 30,
        autoAdvance: true,
    },
    {
        id: 'l3_step1_tip',
        text: '💡 Eu entendo linguagem natural: "Ele me deu 200 de entrada e paga o resto dia 20" também funciona!',
        delay: 30,
    },
    {
        id: 'l3_step2',
        text: '📌 **Passo 2: Agendamentos recorrentes**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l3_step2_detail',
        text: 'Diga: "Agenda o Sr. Carlos toda segunda às 8h" ou "Visita na Dona Lúcia todo dia 15 do mês".',
        delay: 35,
    },
    {
        id: 'l3_step3',
        text: '📌 **Passo 3: Cancelar uma ocorrência**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l3_step3_detail',
        text: 'Se o cliente desmarcar uma vez: "Essa semana o Sr. Carlos não vem" ou "Esse mês não tem".',
        delay: 35,
    },
    {
        id: 'l3_step4',
        text: '📌 **Passo 4: Encerrar recorrência**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l3_step4_detail',
        text: 'Se o contrato acabou: "O Sr. Carlos não vem mais" ou "Cancelar recorrência da Dona Lúcia".',
        delay: 35,
    },
    {
        id: 'l3_step5',
        text: '📌 **Passo 5: Consultar horário**',
        delay: 40,
        autoAdvance: true,
    },
    {
        id: 'l3_step5_detail',
        text: 'Pergunte: "Quando é o próximo do Sr. Carlos?" ou "Qual o horário da Dona Lúcia?".',
        delay: 35,
    },
    {
        id: 'l3_final',
        text: '🏆 **Você é um Expert!** Completou todos os tutoriais. Agora é só usar e prosperar! 🚀 Lembre-se: você pode refazer o tutorial a qualquer momento digitando **tutorial**.',
        delay: 25,
    },
];

export const LEVEL_NAMES = {
    1: '🌱 Primeiros Passos',
    2: '🌿 Dominando o Básico',
    3: '🌳 Modo Especialista',
};
