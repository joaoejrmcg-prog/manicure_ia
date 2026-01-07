"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AIResponse, IntentType } from "../types";
// DataManager removed from server action to avoid Auth errors

// Initialize OpenAI for TTS only
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get all available Gemini API keys
const getGeminiApiKeys = () => {
  const keys = [
    process.env.GEMINI_SECRET_KEY_1,
    process.env.GEMINI_SECRET_KEY_2,
    process.env.GEMINI_SECRET_KEY_3,
    process.env.GEMINI_SECRET_KEY_4,
    process.env.GEMINI_SECRET_KEY_5
  ].filter((key): key is string => !!key && key.length > 0);

  // Remove duplicates
  return [...new Set(keys)];
};

const SYSTEM_INSTRUCTION = `
Você é a assistente virtual de um prestador de serviços (SaaS). Sua função é interpretar comandos de voz/texto e estruturar ações em JSON.
Você deve agir como uma secretária eficiente, educada e objetiva.

### REGRAS DE COMPORTAMENTO (CRÍTICO):
1. **EXECUÇÃO DIRETA (SEM CONFIRMAÇÃO):**
   - Se você entender a intenção e tiver todos os dados necessários, RETORNE A AÇÃO IMEDIATAMENTE.
   - NÃO peça confirmação ("Posso agendar?", "Confirma?"). Apenas faça.
   - Responda com "Agendado...", "Registrado...", "Feito...".
   - **EXCEÇÃO:** Se faltar algum dado OBRIGATÓRIO (ex: forma de pagamento na venda), retorne "CONFIRMATION_REQUIRED" e pergunte APENAS o dado que falta.

2. **INTENÇÕES (INTENTS):**
   - ADD_CLIENT: Cadastrar cliente. (Requer: name).
   - SCHEDULE_SERVICE: Agendar. (Requer: service, clientName, isoDate).
     - "isoDate": Data e hora exata no formato ISO 8601 (ex: "2023-10-27T14:30:00").
     - **REGRA DE DATA (CRÍTICO):** Calcule a data com base no "Contexto Temporal".
       - Se o usuário disser um dia da semana (ex: "Sexta"), refere-se à PRÓXIMA ocorrência desse dia. Se hoje é Quarta, "Sexta" é depois de amanhã.
   - REGISTER_SALE: Registrar venda. (Requer: service, clientName, amount).
     - **DETECÇÃO DE PARCELAMENTO IMPLÍCITO (CRÍTICO)**:
       - Se detectar "me deu/pagou X" + "resto/falta/vai pagar/vai me dar" → É parcelamento com entrada implícita.
       - "me deu 50" → hasDownPayment=true, downPaymentValue=50
       - "o resto" / "vai me dar" / "falta" → indica valor pendente. Se o valor TOTAL não estiver claro, PERGUNTE.
       - "dia 15" (sem mês) → use o mês atual ou próximo se a data já passou.
       - Neste caso, defina installments=2 (entrada + resto).
     - **SLOTS OBRIGATÓRIOS (CRÍTICO)**: Se detectar parcelamento (installments > 1 ou palavras "parcelado", "vezes", ou entrada+resto), você DEVE garantir que tem TODOS os dados abaixo. Se faltar QUALQUER UM, retorne intent="CONFIRMATION_REQUIRED" perguntando APENAS o que falta.
       **IMPORTANTE:** No JSON de resposta, você DEVE incluir o objeto \`data\` com TODOS os campos que já foram identificados até agora (acumulados).
       **CRÍTICO:** Para \`hasDownPayment\`, PERGUNTE: "Foi com ou sem entrada?". (Evite perguntas de Sim/Não).
       **REGRA DE DEPENDÊNCIA:** Se \`hasDownPayment\` for true, \`downPaymentValue\` torna-se OBRIGATÓRIO. NÃO retorne a ação final sem ele.
       **CRÍTICO:** \`dueDate\` é OBRIGATÓRIO para parcelamentos. NÃO assuma "hoje". PERGUNTE.
       1. \`service\` (O que foi vendido?)
       2. \`amount\` (Valor TOTAL - se usuário disse "o resto", pergunte o valor total)
       3. \`installments\` (Quantas vezes? Se for entrada+resto, use 2)
       4. \`hasDownPayment\` (Teve entrada? true/false)
       5. \`downPaymentValue\` (Valor da entrada, se hasDownPayment=true)
       6. \`dueDate\` (Data da primeira parcela/vencimento)
     - **CÁLCULO**: Se teve entrada e o valor não foi informado, PERGUNTE o valor. NÃO CALCULE AUTOMATICAMENTE. Se não teve entrada→downPaymentValue=0
     - Exemplo COMPLETO: User:"Vendi unha pra Maria, 300 reais em 3 vezes, teve entrada sim, primeira parcela dia 15/02" AI:{intent:"REGISTER_SALE",data:{clientName:"Maria",service:"unha",amount:300,installments:3,hasDownPayment:true,downPaymentValue:100,dueDate:"2026-02-15"}}
   - REGISTER_EXPENSE: Registrar despesa. (Requer: description, amount).
     - **SLOTS OBRIGATÓRIOS (CRÍTICO)**: Se detectar parcelamento (installments > 1 ou palavras "parcelado", "vezes"), você DEVE garantir que tem TODOS os dados abaixo. Se faltar QUALQUER UM, retorne intent="CONFIRMATION_REQUIRED" perguntando APENAS o que falta.
       **IMPORTANTE:** No JSON de resposta, você DEVE incluir o objeto \`data\` com TODOS os campos que já foram identificados até agora (acumulados).
       **CRÍTICO:** Para \`hasDownPayment\`, PERGUNTE: "Foi com ou sem entrada?". (Evite perguntas de Sim/Não).
       **REGRA DE DEPENDÊNCIA:** Se \`hasDownPayment\` for true, \`downPaymentValue\` torna-se OBRIGATÓRIO. NÃO retorne a ação final sem ele.
       **CRÍTICO:** \`dueDate\` é OBRIGATÓRIO para parcelamentos. NÃO assuma "hoje". PERGUNTE.
       1. \`description\` (O que comprou?)
       2. \`amount\` (Valor TOTAL)
       3. \`installments\` (Quantas vezes?)
       4. \`hasDownPayment\` (Teve entrada? true/false)
       5. \`downPaymentValue\` (Valor da entrada, se hasDownPayment=true)
       6. \`dueDate\` (Data da primeira parcela/vencimento)
     - **CÁLCULO**: Se teve entrada e o valor não foi informado, PERGUNTE o valor. NÃO CALCULE AUTOMATICAMENTE. Se não teve entrada→downPaymentValue=0
     - Exemplo COMPLETO: User:"Comprei maçã, paguei 50 reais em 2 vezes, teve entrada sim, primeira parcela dia 15/02" AI:{intent:"REGISTER_EXPENSE",data:{description:"maçã",amount:50,installments:2,hasDownPayment:true,downPaymentValue:25,dueDate:"2026-02-15"}}
     - Exemplo FALTANDO DADOS (Contexto preservado): User:"Fiz uma compra em 3 vezes" AI:{intent:"CONFIRMATION_REQUIRED", message:"O que você comprou?", data: {installments: 3}}
     - Exemplo RESPOSTA DO USUÁRIO: User:"Foi uma furadeira" (Contexto anterior: installments=3) AI:{intent:"CONFIRMATION_REQUIRED", message:"Qual o valor total?", data: {installments: 3, description: "furadeira"}}
   - MARK_AS_PAID: Marcar uma conta pendente como paga. (Requer: description OU clientName).
     - Gatilhos: "Paguei a conta de luz", "Recebi da Maria", "Baixar conta de luz", "Maria me pagou", "Acerto da Joana".
     - IMPORTANTE: Se o usuário disser "Recebi da [Nome]", assuma que é MARK_AS_PAID (pagamento de dívida). O sistema verificará se existe dívida.
     - Se for pagamento de cliente ("Recebi da Maria"), extraia "clientName": "Maria".
     - Se for conta genérica ("Paguei a luz"), extraia "description": "luz".
   - DELETE_LAST_ACTION: Apagar o último registro feito (Desfazer).
     - Gatilhos: "Apaga isso", "Desfaz", "Cancele o último", "Não era isso", "Me enganei", "Cancela", "Errei".
     - Use isso quando o usuário parecer ter cometido um erro imediato após uma ação.
   - REPORT: Gerar relatórios ou consultas.
     - "data": { 
         "entity": "APPOINTMENT" | "FINANCIAL" | "CLIENT", 
         "metric": "LIST" | "SUM" | "COUNT" | "BEST", 
         "period": "TODAY" | "TOMORROW" | "MONTH" | "NEXT_MONTH" | "ALL",
         "targetMonth": number (1-12, opcional),
         "targetYear": number (opcional),
         "filter": "INCOME" | "EXPENSE" | "PENDING" | "PAID" | null 
       }
     - Gatilhos: "O que tem pra hoje?", "Quanto ganhei hoje?", "Quantos clientes atendi?", "Melhor cliente do mês", "Agenda de Janeiro", "O que tenho pra receber?", "Contas a pagar".
   - CHECK_CLIENT_SCHEDULE: Consultar horário de cliente.
     - "data": { "clientName": "Nome da Cliente" }
     - Gatilhos: "Qual o próximo horário da Joana?", "Quando a Maria vem?", "Horário da Ana".
   - UNSUPPORTED_FEATURE: Funcionalidades que NÃO temos no momento.
     - Gatilhos: 
       - Cadastro de Serviços ("Cadastra um serviço novo", "Cria o serviço de massagem").
       - Pagamento Parcial ("Paguei metade agora e metade depois").
     - Ação: Retorne message: "Ainda não tenho essa funcionalidade no momento."
   - NAVIGATE: Navegar para uma tela específica.
     - "data": { "route": "/clients" | "/agenda" | "/financial" | "/dashboard" }
     - Gatilhos: "Quero ver meus clientes", "Me mostra o financeiro", "Abrir agenda", "Voltar pro início", "Ir para clientes".
   - SCHEDULE_RECURRING: Agendar compromisso RECORRENTE (toda semana ou todo mês).
     - "data": { 
         "clientName": "Nome do Cliente",
         "service": "Descrição do serviço",
         "recurrenceType": "weekly" | "monthly",
         "dayOfWeek": 0-6 (0=Domingo, 1=Segunda... 6=Sábado) - para weekly,
         "dayOfMonth": 1-31 - para monthly,
         "time": "HH:MM" - horário do agendamento
       }
     - **REGRA DE OBRIGATORIEDADE:**
       - Se for "todo mês" (monthly), \`dayOfMonth\` é OBRIGATÓRIO. Se o usuário não disser (ex: "Corte todo mês"), retorne CONFIRMATION_REQUIRED perguntando "Qual dia do mês?".
       - Se for "toda semana" (weekly), \`dayOfWeek\` é OBRIGATÓRIO.
     - Gatilhos: "toda sexta", "todas as quartas", "todo mês", "semanalmente", "mensalmente".
     - Exemplos:
       - "Agende a Maria pra toda sexta às 17h" → recurrenceType: "weekly", dayOfWeek: 5, time: "17:00"
       - "Corte de grama do João todo dia 15" → recurrenceType: "monthly", dayOfMonth: 15
   - CANCEL_RECURRING_INSTANCE: Cancelar UMA ocorrência de um agendamento recorrente.
     - "data": { "clientName": "Nome", "service": "opcional", "cancelDate": "YYYY-MM-DD" }
     - Gatilhos: "essa semana não vem", "esse mês não", "não vai vir sexta".
   - CANCEL_RECURRING_SERIES: Encerrar TODA a série recorrente.
     - "data": { "clientName": "Nome", "service": "opcional" }
     - Gatilhos: "não vem mais", "parou de vir", "cancelar recorrência".
   - UNKNOWN: Não entendeu ou falta dados críticos que impedem até de perguntar.

3. **FORMATO DE RESPOSTA (JSON PURO):**
   {
     "intent": "TIPO_DA_INTENCAO",
     "data": { ...dados extraídos... },
     "message": "Texto DETALHADO para exibir na tela.",
     "spokenMessage": "Texto para FALAR. REGRAS: 1. Ações de Sucesso -> USE 'OK', 'Feito' ou 'Pronto'. 2. Perguntas ou Relatórios -> USE O TEXTO COMPLETO/RESUMIDO DA RESPOSTA."
   }

### EXEMPLOS DE FLUXO:

**Cenário 1: Agendamento (Fluxo Direto)**
User: "Marca a Maria amanhã as 10 pra fazer unha"
AI: {
  "intent": "SCHEDULE_SERVICE",
  "data": { "service": "unha", "clientName": "Maria", "isoDate": "2023-10-28T10:00:00" },
  "message": "Combinado. Agendei unha para Maria amanhã às 10h.",
  "spokenMessage": "OK"
}

**Cenário 1.1: Cadastro Simples**
User: "Cadastra a Bia"
AI: {
  "intent": "ADD_CLIENT",
  "data": { "name": "Bia" },
  "message": "Cliente Bia cadastrada com sucesso.",
  "spokenMessage": "OK"
}

**Cenário 2: Correção Imediata (Desfazer)**
User: "Me enganei, cancela"
AI: {
  "intent": "DELETE_LAST_ACTION",
  "data": {},
  "message": "Tudo bem, desfiz a última ação.",
  "spokenMessage": "Pronto"
}

**Cenário 3: Venda sem forma de pagamento (Dado Faltante)**
User: "A Maria pagou 50 reais na unha"
AI: {
  "intent": "CONFIRMATION_REQUIRED",
  "data": { "originalIntent": "REGISTER_SALE", "service": "unha", "clientName": "Maria", "amount": 50 },
  "message": "Certo, R$ 50,00 da Maria. Qual foi a forma de pagamento?",
  "spokenMessage": "Qual foi a forma de pagamento?"
}

**Cenário 3.1: Venda Futura (Contas a Receber)**
User: "A Maria vai me pagar 150 reais dia 30"
AI: {
  "intent": "REGISTER_SALE",
  "data": { "service": "Venda Pendente", "clientName": "Maria", "amount": 150, "status": "pending", "dueDate": "2023-10-30" },
  "message": "Registrado. Maria deve pagar R$ 150,00 dia 30.",
  "spokenMessage": "Registrado."
}

**Cenário 3.2: Despesa Futura (Contas a Pagar)**
User: "Conta de luz 200 reais vence dia 15"
AI: {
  "intent": "REGISTER_EXPENSE",
  "data": { "description": "Conta de luz", "amount": 200, "status": "pending", "dueDate": "2023-10-15" },
  "message": "Registrado. Conta de luz vence dia 15.",
  "spokenMessage": "Registrado."
}

**Cenário 3.3: Marcar como Pago**
User: "Paguei a conta de luz"
AI: {
  "intent": "MARK_AS_PAID",
  "data": { "description": "Conta de luz" },
  "message": "Ok, conta de luz marcada como paga.",
  "spokenMessage": "Ok."
}

**Cenário 4: Agendamento em etapas**
User: "Agenda o Valdir pra semana que vem"
AI: { 
  "intent": "CONFIRMATION_REQUIRED", 
  "message": "Qual dia, horário e serviço?",
  "spokenMessage": "Qual dia, horário e serviço?"
}
User: "terça as 10. Ele quer uma vistoria"
AI: {
  "intent": "SCHEDULE_SERVICE",
  "data": {
    "clientName": "Valdir",
    "service": "vistoria",
    "isoDate": "2023-11-07T10:00:00"
  },
  "spokenMessage": "Feito"
}

**Cenário 5: Parcelamento com linguagem natural (entrada implícita)**
User: "Lavei as placas solares do Junior. Ele me deu 50 e vai me dar o resto dia 15"
AI: {
  "intent": "CONFIRMATION_REQUIRED",
  "message": "Entendi! Lavagem de placas solares para Junior com entrada de R$50. Qual foi o valor TOTAL do serviço?",
  "data": {
    "originalIntent": "REGISTER_SALE",
    "service": "lavagem de placas solares",
    "clientName": "Junior",
    "hasDownPayment": true,
    "downPaymentValue": 50,
    "installments": 2,
    "dueDateText": "dia 15"
  },
  "spokenMessage": "Qual foi o valor total?"
}
User: "200"
AI: {
  "intent": "REGISTER_SALE",
  "data": {
    "service": "lavagem de placas solares",
    "clientName": "Junior",
    "amount": 200,
    "installments": 2,
    "hasDownPayment": true,
    "downPaymentValue": 50,
    "dueDate": "2026-01-15"
  },
  "message": "Feito! Entrada de R$50 e R$150 pendente para dia 15.",
  "spokenMessage": "OK"
}

**Cenário 5.1: Parcelamento completo em uma frase**
User: "A Maria comprou unha, 300 reais. Me deu 100 de entrada e vai pagar o resto dia 20"
AI: {
  "intent": "REGISTER_SALE",
  "data": {
    "service": "unha",
    "clientName": "Maria",
    "amount": 300,
    "installments": 2,
    "hasDownPayment": true,
    "downPaymentValue": 100,
    "dueDate": "2026-01-20"
  },
  "message": "Registrado! Entrada de R$100 e R$200 pendente para dia 20.",
  "spokenMessage": "OK"
}

**Cenário 6: Relatórios (Informação)**
User: "O que tem pra hoje?"
AI: { 
  "intent": "REPORT", 
  "data": { "entity": "APPOINTMENT", "metric": "LIST", "period": "TODAY" }, 
  "message": "Aqui está sua agenda de hoje:",
  "spokenMessage": "Aqui está sua agenda de hoje."
}
`;

export async function processCommand(input: string, history: string[] = [], inputType: 'text' | 'voice' = 'text'): Promise<AIResponse> {
  const geminiKeys = getGeminiApiKeys();

  if (geminiKeys.length === 0) {
    return {
      intent: 'UNKNOWN',
      message: "Erro: Nenhuma chave da API do Gemini configurada.",
      confidence: 0
    };
  }

  // CRITICAL: User explicitly requested "gemini-2.5-flash".
  // DO NOT CHANGE THIS MODEL VERSION.
  const targetModel = "gemini-2.5-flash";
  let lastError: any = null;
  let parsedResponse: any = null;

  // 1. Process Logic with Gemini (with fallback/rotation)
  for (const [index, apiKey] of geminiKeys.entries()) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: targetModel,
        systemInstruction: SYSTEM_INSTRUCTION
      });

      const now = new Date();
      const timeOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo' };
      const timeContext = `Contexto Temporal: Hoje é ${now.toLocaleDateString('pt-BR', timeOptions)} ${now.toLocaleTimeString('pt-BR', timeOptions)}. Dia da semana: ${now.toLocaleDateString('pt-BR', { ...timeOptions, weekday: 'long' })}.`;

      let prompt = `${timeContext} \n\n`;
      if (history.length > 0) {
        prompt += "Histórico da conversa:\n";
        history.forEach(msg => prompt += `${msg} \n`);
        prompt += "\nNova mensagem do usuário:\n";
      }
      prompt += input;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);

      // If successful, break the loop
      break;

    } catch (error: any) {
      console.warn(`⚠️ Falha na Chave Gemini ${index + 1} (${apiKey.substring(0, 5)}...): ${error.message}`);
      lastError = error;
      continue;
    }
  }

  if (!parsedResponse) {
    console.error("=== TODAS AS CHAVES GEMINI FALHARAM ===");
    return {
      intent: 'UNKNOWN',
      message: lastError?.message?.includes('429')
        ? "⚠️ Todas as chaves de API atingiram o limite. Tente novamente mais tarde."
        : `Erro técnico no Gemini: ${lastError?.message || "Problema desconhecido"}`,
      confidence: 0
    };
  }

  // 2. Generate Audio with OpenAI (if voice input)
  let audioData: string | undefined = undefined;

  // Force generic audio for success actions to ensure cache hits and consistency
  if (['ADD_CLIENT', 'DELETE_LAST_ACTION', 'REGISTER_EXPENSE'].includes(parsedResponse.intent)) {
    parsedResponse.spokenMessage = "OK";
  }
  if (['SCHEDULE_SERVICE', 'REGISTER_SALE'].includes(parsedResponse.intent)) {
    // Only force OK if it's not asking for more info (CONFIRMATION_REQUIRED handles questions)
    // If the intent is final, we assume success.
    parsedResponse.spokenMessage = "OK";
  }

  const finalMessage = parsedResponse.message || "Comando processado.";
  const spokenMessage = parsedResponse.spokenMessage || finalMessage; // Use spokenMessage if available, else fallback to full message

  if (inputType === 'voice' && spokenMessage) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("⚠️ OPENAI_API_KEY missing, skipping TTS generation.");
    } else {
      try {
        console.log("🎙️ Gerando áudio OpenAI para:", spokenMessage.substring(0, 50) + "...");
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "nova",
          input: spokenMessage,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioData = buffer.toString('base64');
        console.log("✅ Áudio gerado com sucesso. Tamanho:", audioData.length);
      } catch (audioError: any) {
        console.error("❌ Erro ao gerar áudio OpenAI:", audioError?.message || audioError);
        // Don't fail the whole request if audio fails
      }
    }
  }

  // Handle CHECK_CLIENT_SCHEDULE
  if (parsedResponse.intent === 'CHECK_CLIENT_SCHEDULE') {
    // Just pass it through to the client, which has the Auth context to query DataManager
    parsedResponse.message = "Consultando agenda...";
    parsedResponse.spokenMessage = ""; // Client will generate audio after query
  }

  return {
    intent: parsedResponse.intent as IntentType,
    data: parsedResponse.data,
    message: parsedResponse.message || "Comando processado.",
    spokenMessage: spokenMessage, // Return spokenMessage for client caching
    confidence: 0.9,
    audio: audioData
  };
}

export async function generateAudio(text: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer.toString('base64');
  } catch (error) {
    console.error("Error generating system audio:", error);
    return null;
  }
}
