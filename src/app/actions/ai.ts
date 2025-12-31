"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AIResponse, IntentType } from "../types";

// Initialize OpenAI for TTS only
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get all available Gemini API keys
const getGeminiApiKeys = () => {
  const keys = [
    process.env.GOOGLE_GEN_AI_KEY,
    process.env.GEMINI_API_KEY,
    process.env.AI_API_KEY_1,
    process.env.AI_API_KEY_2,
    process.env.AI_API_KEY_3,
    process.env.AI_API_KEY_4,
    process.env.AI_API_KEY_5
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
       - NÃO agende para hoje a menos que o usuário diga "Hoje".
   - CANCEL_APPOINTMENT: Cancelar agendamento ESPECÍFICO. (Requer: clientName).
     - Gatilhos: "Raquel cancelou", "Desmarca a Maria", "Cancela o horário da Ana".
   - REGISTER_SALE: Registrar venda (Entrada). (Requer: service, clientName, amount, paymentMethod).
     - Gatilhos: "Recebi", "Pagou", "Cliente pagou", "Fiz a mão".
   - REGISTER_EXPENSE: Registrar despesa (Saída). (Requer: amount, description).
     - Gatilhos: "Paguei", "Comprei", "Gastei", "Conta de luz".
   - DELETE_LAST_ACTION: Apagar o último registro feito (Desfazer).
     - Gatilhos: "Apaga isso", "Desfaz", "Cancele o último", "Não era isso", "Me enganei", "Cancela", "Errei".
     - Use isso quando o usuário parecer ter cometido um erro imediato após uma ação.
   - REPORT: Gerar relatórios ou consultas.
     - "data": { 
         "entity": "APPOINTMENT" | "FINANCIAL" | "CLIENT", 
         "metric": "LIST" | "SUM" | "COUNT" | "BEST", 
         "period": "TODAY" | "MONTH" | "NEXT_MONTH" | "ALL",
         "targetMonth": number (1-12, opcional),
         "targetYear": number (opcional),
         "filter": "INCOME" | "EXPENSE" | null 
       }
     - Gatilhos: "O que tem pra hoje?", "Quanto ganhei hoje?", "Quantos clientes atendi?", "Melhor cliente do mês", "Agenda de Janeiro".
   - UNKNOWN: Não entendeu ou falta dados críticos que impedem até de perguntar.

3. **FORMATO DE RESPOSTA (JSON PURO):**
   {
     "intent": "TIPO_DA_INTENCAO",
     "data": { ...dados extraídos... },
   {
     "intent": "TIPO_DA_INTENCAO",
     "data": { ...dados extraídos... },
   {
     "intent": "TIPO_DA_INTENCAO",
     "data": { ...dados extraídos... },
     "message": "Texto DETALHADO para exibir na tela.",
     "spokenMessage": "Texto para FALAR. REGRAS: 1. Ações de Sucesso (Agendar, Cadastrar, Vender) -> USE 'OK', 'Feito' ou 'Pronto'. 2. Perguntas ou Relatórios (O que tem hoje?, Listar clientes) -> USE O TEXTO COMPLETO/RESUMIDO DA RESPOSTA."
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
      const timeContext = `Contexto Temporal: Hoje é ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}. Dia da semana: ${now.toLocaleDateString('pt-BR', { weekday: 'long' })}.`;

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

  // 2. Generate Audio with OpenAI (if voice input)
  // 2. Generate Audio with OpenAI (if voice input)
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
