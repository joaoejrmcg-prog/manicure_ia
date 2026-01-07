import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { DataManager } from "../lib/data-manager";
import { processCommand, generateAudio } from "../actions/ai";
import { checkAndIncrementUsage, getDailyUsage, refundUsageAction } from "../actions/usage";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { getRandomTip } from "@/lib/tips";

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'error' | 'success';
};

export type ConversationState =
    | { type: 'IDLE' }
    | { type: 'CONFIRM_ADD_CLIENT', data: { name: string, originalIntent: any } }
    | { type: 'ASK_PAYMENT_METHOD', data: { transactionData: any, clientName: string } }
    | { type: 'ASK_SERVICE', data: { scheduleData: any, clientName: string } }
    | { type: 'CONFIRM_ACTION', data: { originalIntent: any } }
    | { type: 'FILLING_SLOT', data: { missingSlot: string, originalIntent: any, accumulatedData: any } };

export function useCommandCenterLogic() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Olá! Sou sua secretária. Vamos começar?' }
    ]);
    const [conversationState, setConversationState] = useState<ConversationState>({ type: 'IDLE' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [usageCount, setUsageCount] = useState(0);
    const [inputType, setInputType] = useState<'text' | 'voice'>('text');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [userPlan, setUserPlan] = useState<string>('trial');

    const router = useRouter();
    const { isListening, transcript, startListening, stopListening, isSupported, resetTranscript } = useSpeechRecognition();

    useEffect(() => {
        getDailyUsage().then(setUsageCount);
    }, []);

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
            setInputType('voice');
        }
    }, [transcript]);

    useEffect(() => {
        if (!isListening && transcript && !isProcessing) {
            const userInput = transcript;

            const autoSend = async () => {
                setInput("");
                resetTranscript();
                addMessage('user', userInput);
                setIsProcessing(true);
                await processAIResponse(userInput);
                setIsProcessing(false);
            };

            autoSend();
        }
    }, [isListening]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/login");
                return;
            }

            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plan')
                .eq('user_id', session.user.id)
                .single();

            if (sub?.plan) setUserPlan(sub.plan);
        };
        checkUser();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const addMessage = (role: 'user' | 'assistant', content: string, type: 'text' | 'error' | 'success' = 'text', skipRefund = false) => {
        setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role,
            content,
            type
        }]);

        if (role === 'assistant' && type !== 'success' && !skipRefund) {
            refundUsageAction().then(() => {
                setUsageCount(prev => Math.max(0, prev - 1));
            });
        }

        if (role === 'assistant' && type === 'success') {
            if (Math.random() < 0.3) {
                setTimeout(() => {
                    const randomTip = getRandomTip();
                    setMessages(prev => [...prev, {
                        id: Math.random().toString(36).substring(7),
                        role: 'assistant',
                        content: `💡 **Dica:** ${randomTip}`,
                        type: 'text'
                    }]);
                }, 500);
            }
        }
    };

    const checkLimit = async () => {
        const usage = await checkAndIncrementUsage();
        setUsageCount(usage.count);

        if (!usage.allowed) {
            addMessage('assistant', `🛑 Você atingiu seu limite diário de 10 interações.`, 'error', true);
            addMessage('assistant', `Você pode continuar realizando esta ação manualmente através do menu do aplicativo.`, 'text', true);
            addMessage('assistant', `Que tal fazer um upgrade para o plano PRO? Assim você tem acesso ilimitado e seu negócio não para! 🚀`, 'text', true);
            setConversationState({ type: 'IDLE' });
            return false;
        }
        return true;
    };

    const playAudioWithCache = async (text: string, serverAudioData?: string, forcedInputType?: 'text' | 'voice') => {
        return;
        // VOICE DISABLED BY USER REQUEST
    };

    const processAIResponse = async (userInput: string) => {
        if (conversationState.type === 'CONFIRM_ADD_CLIENT' || conversationState.type === 'CONFIRM_ACTION') {
            if (userInput.toLowerCase().match(/^(sim|s|pode|claro|ok|confirmo)/)) {
                if (!await checkLimit()) return;

                if (conversationState.type === 'CONFIRM_ACTION') {
                    const originalIntent = conversationState.data.originalIntent;
                    try {
                        if (originalIntent.data.originalIntent === 'SCHEDULE_SERVICE') {
                            const response = { ...originalIntent, intent: originalIntent.data.originalIntent, data: originalIntent.data };
                            const clients = await DataManager.getClients();
                            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                            if (client) {
                                const date = response.data.isoDate ? new Date(response.data.isoDate) : new Date();
                                if (!response.data.isoDate) {
                                    const now = new Date();
                                    if (response.data.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                                    const hourMatch = response.data.timeString?.match(/(\d{1,2})(?:h|:)/);
                                    if (hourMatch) date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
                                }

                                await DataManager.addAppointment(client.id, date, response.data.service);
                                addMessage('assistant', "Agendado com sucesso!", 'success');
                            } else {
                                addMessage('assistant', `Erro: Não encontrei a cliente "${response.data.clientName}" para finalizar.`, 'error');
                            }
                        } else if (originalIntent.data.originalIntent === 'REGISTER_SALE') {
                            const response = { ...originalIntent, intent: originalIntent.data.originalIntent, data: originalIntent.data };
                            const clients = await DataManager.getClients();
                            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                            if (client) {
                                if (response.data.status === 'pending') {
                                    await DataManager.addTransaction({
                                        type: 'income',
                                        amount: response.data.amount,
                                        description: response.data.service,
                                        client_id: client.id,
                                        status: 'pending',
                                        due_date: response.data.dueDate
                                    });
                                    addMessage('assistant', "Venda pendente registrada com sucesso!", 'success');
                                } else if (!response.data.paymentMethod) {
                                    setConversationState({
                                        type: 'ASK_PAYMENT_METHOD',
                                        data: {
                                            transactionData: response.data,
                                            clientName: client.name
                                        }
                                    });
                                    addMessage('assistant', "Qual foi a forma de pagamento? (Pix, Dinheiro, Cartão...)");
                                    return;
                                } else {
                                    await DataManager.addTransaction({
                                        type: 'income',
                                        amount: response.data.amount,
                                        description: response.data.service,
                                        payment_method: response.data.paymentMethod,
                                        client_id: client.id,
                                        status: 'paid'
                                    });
                                    addMessage('assistant', "Venda registrada com sucesso!", 'success');
                                }
                            } else {
                                addMessage('assistant', `Não encontrei a cliente "${response.data.clientName}". Deseja cadastrá-la agora?`);
                                setConversationState({
                                    type: 'CONFIRM_ADD_CLIENT',
                                    data: {
                                        name: response.data.clientName,
                                        originalIntent: {
                                            intent: 'REGISTER_SALE',
                                            data: response.data
                                        }
                                    }
                                });
                                return;
                            }
                        } else if (originalIntent.data.originalIntent === 'ADD_CLIENT') {
                            await DataManager.addClient({ name: originalIntent.data.name });
                            addMessage('assistant', "Cliente cadastrada.", 'success');
                        } else if (originalIntent.data.originalIntent === 'REGISTER_EXPENSE') {
                            const response = { ...originalIntent, intent: originalIntent.data.originalIntent, data: originalIntent.data };
                            await DataManager.addTransaction({
                                type: 'expense',
                                amount: response.data.amount,
                                description: response.data.description
                            });
                            addMessage('assistant', "Despesa registrada com sucesso!", 'success');
                        } else if (originalIntent.data.originalIntent === 'DELETE_LAST_ACTION') {
                            const deleted = await DataManager.deleteLastAction();
                            if (deleted) addMessage('assistant', "Último registro apagado com sucesso.", 'success');
                            else addMessage('assistant', "Não encontrei nada recente para apagar.", 'error');
                        } else if (originalIntent.data.originalIntent === 'CANCEL_APPOINTMENT') {
                            let appointmentId = originalIntent.data.appointmentId;

                            if (!appointmentId && originalIntent.data.clientName) {
                                const clients = await DataManager.getClients();
                                const client = clients.find(c => c.name.toLowerCase() === originalIntent.data.clientName.toLowerCase());
                                if (client) {
                                    const nextApp = await DataManager.findNextAppointment(client.id);
                                    if (nextApp) {
                                        appointmentId = nextApp.id;
                                    } else {
                                        addMessage('assistant', `Não encontrei nenhum agendamento futuro para ${client.name} para cancelar.`, 'error');
                                        setConversationState({ type: 'IDLE' });
                                        return;
                                    }
                                } else {
                                    addMessage('assistant', `Não encontrei a cliente "${originalIntent.data.clientName}".`, 'error');
                                    setConversationState({ type: 'IDLE' });
                                    return;
                                }
                            }

                            if (appointmentId) {
                                await DataManager.cancelAppointment(appointmentId);
                                addMessage('assistant', "Agendamento cancelado com sucesso.", 'success');
                            }
                        } else if (originalIntent.data.originalIntent === 'MARK_AS_PAID_ID') {
                            const data = originalIntent.data.data;
                            setConversationState({
                                type: 'ASK_PAYMENT_METHOD',
                                data: {
                                    transactionData: { ...data, isUpdate: true },
                                    clientName: data.clientName || "Cliente"
                                }
                            });
                            addMessage('assistant', "Certo. E qual foi a forma de pagamento?");
                            return;
                        } else if (originalIntent.data.originalIntent === 'MULTI_ACTION') {
                            const actions = originalIntent.data.actions;
                            for (const action of actions) {
                                try {
                                    if (action.intent === 'ADD_CLIENT') {
                                        await DataManager.addClient({ name: action.data.name });
                                        addMessage('assistant', `Cliente ${action.data.name} cadastrado.`, 'success');
                                    } else if (action.intent === 'SCHEDULE_SERVICE') {
                                        const clients = await DataManager.getClients();
                                        const client = clients.find(c => c.name.toLowerCase() === action.data.clientName.toLowerCase());
                                        if (client) {
                                            const date = action.data.isoDate ? new Date(action.data.isoDate) : new Date();
                                            await DataManager.addAppointment(client.id, date, action.data.service);
                                            addMessage('assistant', `Agendado: ${action.data.service} para ${client.name}.`, 'success');
                                        } else {
                                            addMessage('assistant', `Erro ao agendar: Cliente ${action.data.clientName} não encontrado.`, 'error');
                                        }
                                    } else if (action.intent === 'REGISTER_SALE') {
                                        const clients = await DataManager.getClients();
                                        const client = clients.find(c => c.name.toLowerCase() === action.data.clientName.toLowerCase());
                                        if (client) {
                                            await DataManager.addTransaction({
                                                type: 'income',
                                                amount: action.data.amount,
                                                description: action.data.service,
                                                payment_method: action.data.paymentMethod,
                                                client_id: client.id
                                            });
                                            addMessage('assistant', `Venda registrada: R$${action.data.amount}.`, 'success');
                                        } else {
                                            addMessage('assistant', `Erro ao registrar venda: Cliente ${action.data.clientName} não encontrado.`, 'error');
                                        }
                                    }
                                } catch (err: any) {
                                    console.error("Erro em ação múltipla:", err);
                                    addMessage('assistant', err.message || `Erro ao executar uma das ações.`, 'error');
                                }
                            }
                        }

                        setConversationState({ type: 'IDLE' });
                        return;

                    } catch (e) {
                        console.error(e);
                        addMessage('assistant', "Erro ao executar ação confirmada.", 'error');
                        setConversationState({ type: 'IDLE' });
                        return;
                    }
                }

                try {
                    const newClient = await DataManager.addClient({ name: conversationState.data.name });
                    addMessage('assistant', `Pronto! Cadastrei a ${conversationState.data.name}.`, 'success');

                    try {
                        const originalData = conversationState.data.originalIntent.data;

                        if (conversationState.data.originalIntent.intent === 'REGISTER_SALE') {
                            const amount = Number(String(originalData.amount).replace(',', '.'));
                            let isPending = originalData.status === 'pending';
                            let dueDate = originalData.dueDate;

                            if (!isPending && dueDate && dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                isPending = true;
                            }

                            if (isPending) {
                                await DataManager.addTransaction({
                                    type: 'income',
                                    amount: amount,
                                    description: originalData.service || 'Venda',
                                    client_id: newClient.id,
                                    status: 'pending',
                                    due_date: dueDate
                                });
                                addMessage('assistant', `Venda pendente registrada: R$${originalData.amount}.`, 'success');
                                await playAudioWithCache("Pronto, registrado.", undefined);
                            } else if (!originalData.paymentMethod) {
                                setConversationState({
                                    type: 'ASK_PAYMENT_METHOD',
                                    data: {
                                        transactionData: { ...originalData, amount },
                                        clientName: conversationState.data.name
                                    }
                                });
                                addMessage('assistant', "Qual foi a forma de pagamento? (Pix, Dinheiro, Cartão...)");
                                return;
                            } else {
                                await DataManager.addTransaction({
                                    type: 'income',
                                    amount: Number(originalData.amount),
                                    description: originalData.service || 'Venda',
                                    payment_method: originalData.paymentMethod,
                                    client_id: newClient.id,
                                    status: 'paid'
                                });
                                addMessage('assistant', `Venda registrada: R$${originalData.amount} (${originalData.service || 'Venda'})`, 'success');
                                await playAudioWithCache("Pronto, registrado.", undefined);
                            }
                        } else if (conversationState.data.originalIntent.intent === 'SCHEDULE_SERVICE') {
                            const date = originalData.isoDate ? new Date(originalData.isoDate) : new Date();
                            if (!originalData.isoDate) {
                                const now = new Date();
                                if (originalData.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                                const timeMatch = originalData.timeString?.match(/(\d{1,2})(?:h|:)?(\d{2})?/);
                                if (timeMatch) {
                                    const hours = parseInt(timeMatch[1]);
                                    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                                    date.setHours(hours, minutes, 0, 0);
                                }
                            }

                            await DataManager.addAppointment(newClient.id, date, originalData.service);
                            const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                            const msg = `Agendado: ${originalData.service} para ${newClient.name} em ${dateStr}.`;
                            addMessage('assistant', msg, 'success');
                            await playAudioWithCache("Pronto, agendado.", undefined);
                        }
                    } catch (resumptionError) {
                        console.error("Erro na retomada:", resumptionError);
                        addMessage('assistant', "Cliente cadastrada, mas houve um erro ao processar o pedido seguinte.", 'error');
                    }

                    setConversationState({ type: 'IDLE' });
                    return;

                } catch (error: any) {
                    console.error(error);
                    addMessage('assistant', error.message || "Erro ao cadastrar cliente.", 'error');
                    setConversationState({ type: 'IDLE' });
                    return;
                }
            } else {
                setConversationState({ type: 'IDLE' });
            }
        }

        if (conversationState.type === 'FILLING_SLOT') {
            const { missingSlot, originalIntent, accumulatedData } = conversationState.data;
            const newData = { ...accumulatedData };
            console.log('DEBUG: FILLING_SLOT start', { missingSlot, userInput, newData });

            // Enhanced heuristics to capture data even if not the current missing slot
            const lowerInput = userInput.toLowerCase();

            // Try to extract installments (e.g., "3x", "3 vezes")
            const installmentsMatch = lowerInput.match(/(\d+)\s*(x|vezes)/);
            if (installmentsMatch) {
                const val = parseInt(installmentsMatch[1]);
                if (!isNaN(val)) newData.installments = val;
            }

            // Try to extract down payment value (e.g., "entrada de 50")
            if (lowerInput.includes('entrada')) {
                const downPaymentMatch = lowerInput.match(/entrada\s*(?:de)?\s*(?:r\$)?\s*(\d+(?:[.,]\d{2})?)/);
                if (downPaymentMatch) {
                    const val = parseFloat(downPaymentMatch[1].replace(',', '.'));
                    if (!isNaN(val)) {
                        newData.downPaymentValue = val;
                        newData.hasDownPayment = true;
                    }
                }
            }

            // Specific slot mapping
            if (missingSlot === 'amount') {
                const val = parseFloat(userInput.replace(/[^0-9,.]/g, '').replace(',', '.'));
                if (!isNaN(val)) newData.amount = val;
            } else if (missingSlot === 'installments' && !newData.installments) {
                const val = parseInt(userInput.replace(/[^0-9]/g, ''));
                if (!isNaN(val)) newData.installments = val;
            } else if (missingSlot === 'hasDownPayment') {
                if (lowerInput.includes('sim') || lowerInput.includes('teve') || lowerInput.includes('com')) newData.hasDownPayment = true;
                else if (lowerInput.includes('não') || lowerInput.includes('sem')) newData.hasDownPayment = false;
            } else if (missingSlot === 'downPaymentValue' && !newData.downPaymentValue) {
                const val = parseFloat(userInput.replace(/[^0-9,.]/g, '').replace(',', '.'));
                if (!isNaN(val)) newData.downPaymentValue = val;
            } else if (missingSlot === 'dueDate') {
                newData.dueDate = userInput;
            } else if (missingSlot === 'description' || missingSlot === 'service') {
                newData[missingSlot] = userInput;
            }

            // Re-process with AI to validate and format (especially dates)
            const contextPrompt = `Estou respondendo sobre o campo '${missingSlot}'. O valor é: "${userInput}". 
            Dados acumulados até agora: ${JSON.stringify(newData)}. 
            Intenção original: ${originalIntent.intent}. 
            IMPORTANTE: O input acima refere-se EXCLUSIVAMENTE ao campo '${missingSlot}'. 
            NÃO altere os outros campos (como service, description, amount) que já estão nos dados acumulados.
            Atualize apenas o '${missingSlot}' e retorne o JSON completo.
            Se completou tudo, retorne a ação final. Se ainda falta algo, retorne CONFIRMATION_REQUIRED.`;

            if (!await checkLimit()) return;

            try {
                const response = await processCommand(contextPrompt, [], 'text');

                if (response.intent === 'CONFIRMATION_REQUIRED') {
                    addMessage('assistant', response.message);

                    // Determine the next missing slot based on what's missing in the returned data
                    // If AI didn't return data, fallback to merging what we have
                    const updatedData = { ...newData, ...(response.data || {}) };
                    console.log('DEBUG: AI Response in FILLING_SLOT', { responseData: response.data, updatedData });

                    let nextMissingSlot = 'unknown';
                    if (originalIntent.intent === 'REGISTER_EXPENSE' && !updatedData.description) nextMissingSlot = 'description';
                    else if (originalIntent.intent === 'REGISTER_SALE' && !updatedData.service) nextMissingSlot = 'service';
                    else if (!updatedData.amount) nextMissingSlot = 'amount';
                    else if (!updatedData.installments) nextMissingSlot = 'installments';
                    else if (updatedData.hasDownPayment === undefined) nextMissingSlot = 'hasDownPayment';
                    else if (updatedData.hasDownPayment === true && !updatedData.downPaymentValue) nextMissingSlot = 'downPaymentValue';
                    else if (!updatedData.dueDate) nextMissingSlot = 'dueDate';

                    setConversationState({
                        type: 'FILLING_SLOT',
                        data: {
                            missingSlot: nextMissingSlot,
                            originalIntent: originalIntent,
                            accumulatedData: updatedData
                        }
                    });
                    return;
                } else {
                    // Success! Process the final action
                    // We need to route this to the standard handler below (processAIResponse logic)
                    // But we are inside the useEffect/state handler. 
                    // Let's call the handler logic directly or set state to IDLE and let the standard flow handle it?
                    // No, we are in the middle of a flow.

                    // Let's recursively call processAIResponse with the *result* of the AI? 
                    // No, processAIResponse takes a string.

                    // We should handle the success response here.
                    // Ensure we pass the accumulated data, merging with what the AI returned
                    response.data = { ...newData, ...(response.data || {}) };
                    console.log('DEBUG: Final Action Data Merge', response.data);
                    await handleFinalAction(response);
                    setConversationState({ type: 'IDLE' });
                    return;
                }
            } catch (e) {
                console.error(e);
                addMessage('assistant', "Não entendi. Pode repetir?", 'error');
            }
            return;
        }
        if (conversationState.type === 'ASK_PAYMENT_METHOD') {
            const paymentMethod = userInput;
            const { transactionData, clientName } = conversationState.data;
            const updatedTransactionData = { ...transactionData, paymentMethod };

            const amount = Number(String(updatedTransactionData.amount).replace(',', '.'));
            if (isNaN(amount) || amount <= 0) {
                addMessage('assistant', "Valor inválido. Por favor, tente registrar novamente.");
                setConversationState({ type: 'IDLE' });
                return;
            }

            if (!await checkLimit()) return;

            try {
                if (updatedTransactionData.type === 'expense') {
                    await DataManager.addTransaction({
                        type: 'expense',
                        amount: amount,
                        description: updatedTransactionData.description || 'Despesa',
                        payment_method: updatedTransactionData.paymentMethod,
                        status: 'paid',
                        due_date: updatedTransactionData.dueDate
                    });
                    addMessage('assistant', `Despesa registrada: ${updatedTransactionData.description} R$${updatedTransactionData.amount} no ${updatedTransactionData.paymentMethod}.`, 'success');
                } else {
                    const clients = await DataManager.getClients();
                    const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

                    if (client) {
                        if (updatedTransactionData.isUpdate && updatedTransactionData.id) {
                            await DataManager.updateTransaction(updatedTransactionData.id, {
                                status: 'paid',
                                payment_method: updatedTransactionData.paymentMethod
                            });
                            addMessage('assistant', `Recebimento de ${clientName} (${updatedTransactionData.description}) registrado no ${updatedTransactionData.paymentMethod}!`, 'success');
                        } else {
                            await DataManager.addTransaction({
                                type: 'income',
                                amount: amount,
                                description: updatedTransactionData.service || 'Venda',
                                payment_method: updatedTransactionData.paymentMethod,
                                client_id: client.id
                            });
                            addMessage('assistant', `Venda registrada: R$${updatedTransactionData.amount} no ${updatedTransactionData.paymentMethod}.`, 'success');
                        }
                    } else {
                        const msg = `Não encontrei o cliente "${clientName}". Deseja cadastrá-lo agora?`;
                        addMessage('assistant', msg);
                        await playAudioWithCache(msg, undefined);

                        setConversationState({
                            type: 'CONFIRM_ADD_CLIENT',
                            data: {
                                name: clientName,
                                originalIntent: {
                                    intent: 'REGISTER_SALE',
                                    data: updatedTransactionData
                                }
                            }
                        });
                        return;
                    }
                }
            } catch (error) {
                console.error(error);
                addMessage('assistant', "Erro ao registrar transação.", 'error');
            }
            setConversationState({ type: 'IDLE' });
            return;
        }

        if (conversationState.type === 'ASK_SERVICE') {
            const service = userInput;
            const { scheduleData, clientName } = conversationState.data;
            const updatedScheduleData = { ...scheduleData, service };

            if (!await checkLimit()) return;

            try {
                const clients = await DataManager.getClients();
                const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

                if (client) {
                    const date = updatedScheduleData.isoDate ? new Date(updatedScheduleData.isoDate) : new Date();
                    if (!updatedScheduleData.isoDate) {
                        const now = new Date();
                        if (updatedScheduleData.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                        const hourMatch = updatedScheduleData.timeString?.match(/(\d{1,2})(?:h|:)/);
                        if (hourMatch) date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
                    }

                    await DataManager.addAppointment(client.id, date, updatedScheduleData.service);
                    const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                    addMessage('assistant', `Agendado: ${updatedScheduleData.service} para ${client.name} em ${dateStr}.`, 'success');
                } else {
                    addMessage('assistant', `Não encontrei o cliente "${clientName}". Deseja cadastrá-lo agora?`);
                    setConversationState({
                        type: 'CONFIRM_ADD_CLIENT',
                        data: {
                            name: clientName,
                            originalIntent: {
                                intent: 'SCHEDULE_SERVICE',
                                data: updatedScheduleData
                            }
                        }
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                addMessage('assistant', "Erro ao agendar serviço.", 'error');
            }
            setConversationState({ type: 'IDLE' });
            return;
        }

        try {
            if (!await checkLimit()) return;

            const currentInputType = inputType;
            const history = messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`);
            const response = await processCommand(userInput, history, 'text');

            if (response.spokenMessage || response.audio) {
                await playAudioWithCache(response.spokenMessage || response.message, response.audio, currentInputType);
            }

            switch (response.intent) {
                case 'CONFIRMATION_REQUIRED':
                    if (response.data?.originalIntent === 'REGISTER_SALE' && response.data?.amount && !response.data?.paymentMethod && response.data?.clientName && response.data?.service) {
                        addMessage('assistant', response.message);
                        setConversationState({
                            type: 'ASK_PAYMENT_METHOD',
                            data: {
                                transactionData: response.data,
                                clientName: response.data.clientName
                            }
                        });
                        return;
                    }

                    if (response.data?.originalIntent === 'SCHEDULE_SERVICE' && !response.data?.service) {
                        addMessage('assistant', response.message);
                        setConversationState({
                            type: 'ASK_SERVICE',
                            data: {
                                scheduleData: response.data,
                                clientName: response.data.clientName
                            }
                        });
                        return;
                    }

                    addMessage('assistant', response.message);
                    setConversationState({
                        type: 'CONFIRM_ACTION',
                        data: { originalIntent: response }
                    });
                    return;

                case 'CHECK_CLIENT_SCHEDULE':
                    const clientName = response.data?.clientName;
                    if (clientName) {
                        try {
                            const clients = await DataManager.getClients();
                            const client = clients.find(c => c.name.toLowerCase().includes(clientName.toLowerCase()));

                            if (client) {
                                const nextApp = await DataManager.findNextAppointment(client.id);
                                if (nextApp) {
                                    const date = new Date(nextApp.date_time);
                                    const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
                                    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                    const msg = `A ${client.name} tem horário agendado para ${dateStr} às ${timeStr}. Serviço: ${nextApp.description}.`;
                                    const spoken = `A ${client.name} vem ${dateStr} às ${timeStr}.`;

                                    if (!await checkLimit()) break;
                                    addMessage('assistant', msg, 'success');
                                    await playAudioWithCache(spoken, undefined, inputType);
                                } else {
                                    const msg = `A cliente ${client.name} não tem agendamentos futuros.`;
                                    if (!await checkLimit()) break;
                                    addMessage('assistant', msg, 'success');
                                    await playAudioWithCache(msg, undefined, inputType);
                                }
                            } else {
                                const msg = `Não encontrei nenhuma cliente chamada "${clientName}".`;
                                addMessage('assistant', msg);
                                await playAudioWithCache(msg, undefined, inputType);
                            }
                        } catch (e) {
                            console.error("Erro ao consultar horário:", e);
                            addMessage('assistant', "Houve um erro ao consultar a agenda.", 'error');
                        }
                    }
                    return;
                    break;

                case 'REGISTER_SALE':
                case 'SCHEDULE_SERVICE':
                    if (response.data?.clientName) {
                        const clients = await DataManager.getClients();
                        const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                        if (!client) {
                            addMessage('assistant', `Não encontrei a cliente "${response.data.clientName}". Deseja cadastrá-la agora?`);
                            setConversationState({
                                type: 'CONFIRM_ADD_CLIENT',
                                data: {
                                    name: response.data.clientName,
                                    originalIntent: response
                                }
                            });
                            return;
                        }

                        if (response.intent === 'REGISTER_SALE') {
                            let amountStr = String(response.data.amount || '').trim();
                            amountStr = amountStr.replace(/R\$|\.(?=\d{3})/g, '').replace(',', '.').trim();
                            const amount = Number(amountStr);

                            if (!amount || isNaN(amount) || amount <= 0) {
                                addMessage('assistant', response.message || "Por favor, informe o valor do serviço.");
                                return;
                            }

                            const installments = response.data.installments || 1;
                            const downPayment = response.data.downPayment || 0;

                            let finalInstallmentValue = response.data.installmentValue;
                            if (!finalInstallmentValue) {
                                if (downPayment > 0) {
                                    if (installments > 1) {
                                        finalInstallmentValue = (amount - downPayment) / (installments - 1);
                                    } else {
                                        finalInstallmentValue = 0;
                                    }
                                } else {
                                    finalInstallmentValue = amount / installments;
                                }
                            }

                            if (downPayment > 0) {
                                if (!response.data.paymentMethod) {
                                    setConversationState({
                                        type: 'ASK_PAYMENT_METHOD',
                                        data: {
                                            transactionData: { ...response.data, amount: downPayment, isEntry: true, remainingInstallments: installments - 1, remainingValue: finalInstallmentValue, fullAmount: amount },
                                            clientName: client.name
                                        }
                                    });
                                    addMessage('assistant', `Certo, entrada de R$${downPayment}. Qual a forma de pagamento da entrada?`);
                                    return;
                                }

                                await DataManager.addTransaction({
                                    type: 'income',
                                    amount: downPayment,
                                    description: `${response.data.service} (Entrada)`,
                                    payment_method: response.data.paymentMethod,
                                    client_id: client.id,
                                    status: 'paid'
                                });
                            }

                            const startIdx = downPayment > 0 ? 1 : 0;
                            const loopCount = downPayment > 0 ? installments - 1 : installments;

                            if (loopCount > 0) {
                                const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();
                                for (let i = 0; i < loopCount; i++) {
                                    const date = new Date(baseDate.getTime());
                                    const monthOffset = i;
                                    const targetMonth = date.getMonth() + monthOffset;
                                    date.setMonth(targetMonth);

                                    if (date.getDate() !== baseDate.getDate()) {
                                        date.setDate(0);
                                    }

                                    const dateStr = date.toISOString().split('T')[0];

                                    let currentStatus = response.data.status || 'paid';
                                    if (i > 0 && !response.data.paymentMethod?.toLowerCase().includes('cartão')) {
                                        currentStatus = 'pending';
                                    }
                                    if (downPayment > 0) currentStatus = 'pending';

                                    await DataManager.addTransaction({
                                        type: 'income',
                                        amount: finalInstallmentValue,
                                        description: `${response.data.service} (${i + 1 + (downPayment > 0 ? 1 : 0)}/${installments})`,
                                        payment_method: response.data.paymentMethod,
                                        client_id: client.id,
                                        status: currentStatus,
                                        due_date: dateStr
                                    });
                                }
                            }

                            addMessage('assistant', response.message, 'success');
                        } else if (response.intent === 'SCHEDULE_SERVICE') {
                            if (!response.data.service) {
                                setConversationState({
                                    type: 'ASK_SERVICE',
                                    data: {
                                        scheduleData: response.data,
                                        clientName: client.name
                                    }
                                });
                                addMessage('assistant', "Qual serviço será realizado?");
                                return;
                            }

                            const date = response.data.isoDate ? new Date(response.data.isoDate) : new Date();
                            if (!response.data.isoDate) {
                                const now = new Date();
                                if (response.data.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                                const hourMatch = response.data.timeString?.match(/(\d{1,2})(?:h|:)/);
                                if (hourMatch) date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
                            }

                            await DataManager.addAppointment(client.id, date, response.data.service);
                            addMessage('assistant', response.message, 'success');
                        }
                    }
                    break;

                case 'ADD_CLIENT':
                    if (response.data?.name) {
                        await DataManager.addClient({ name: response.data.name });
                        addMessage('assistant', response.message, 'success');
                    }
                    break;

                case 'DELETE_CLIENT':
                    if (response.data?.name) {
                        const removed = await DataManager.removeClient(response.data.name);
                        if (removed) addMessage('assistant', response.message, 'success');
                        else addMessage('assistant', `Cliente ${response.data.name} não encontrada.`, 'error');
                    }
                    break;

                case 'LIST_CLIENTS':
                    const clients = await DataManager.getClients();
                    if (clients.length === 0) addMessage('assistant', "Nenhuma cliente cadastrada.", 'success');
                    else addMessage('assistant', `Clientes: ${clients.map(c => c.name).join(", ")}`, 'success');
                    break;

                case 'REGISTER_EXPENSE':
                    const expenseStatus = response.data.status || 'paid';
                    const expensePaymentMethod = response.data.paymentMethod;

                    const expInstallments = response.data.installments || 1;
                    const expDownPayment = response.data.downPayment || 0;

                    let expFinalInstallmentValue = response.data.installmentValue;
                    if (!expFinalInstallmentValue) {
                        if (expDownPayment > 0) {
                            if (expInstallments > 1) {
                                expFinalInstallmentValue = (response.data.amount - expDownPayment) / (expInstallments - 1);
                            } else {
                                expFinalInstallmentValue = 0;
                            }
                        } else {
                            expFinalInstallmentValue = response.data.amount / expInstallments;
                        }
                    }

                    if (expDownPayment > 0) {
                        await DataManager.addTransaction({
                            type: 'expense',
                            amount: expDownPayment,
                            description: `${response.data.description} (Entrada)`,
                            payment_method: expensePaymentMethod,
                            status: 'paid'
                        });
                    }

                    const expLoopCount = expDownPayment > 0 ? expInstallments - 1 : expInstallments;

                    if (expLoopCount > 0) {
                        const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();

                        for (let i = 0; i < expLoopCount; i++) {
                            const date = new Date(baseDate.getTime());
                            const monthOffset = i;

                            const targetMonth = date.getMonth() + monthOffset;
                            date.setMonth(targetMonth);

                            if (date.getDate() !== baseDate.getDate()) {
                                date.setDate(0);
                            }

                            const dateStr = date.toISOString().split('T')[0];

                            let currentStatus = expenseStatus;
                            // Force pending if it's an installment plan (unless explicitly paid or single installment)
                            if (i > 0 || expDownPayment > 0 || (expInstallments > 1 && expDownPayment === 0)) {
                                currentStatus = 'pending';
                            }

                            await DataManager.addTransaction({
                                type: 'expense',
                                amount: expFinalInstallmentValue,
                                description: `${response.data.description} (${i + 1 + (expDownPayment > 0 ? 1 : 0)}/${expInstallments})`,
                                payment_method: expensePaymentMethod,
                                status: currentStatus,
                                due_date: dateStr
                            });
                        }
                    }
                    addMessage('assistant', response.message, 'success');
                    break;

                case 'MARK_AS_PAID':
                    if (response.data?.clientName) {
                        const pendingList = await DataManager.findPendingTransactionsByClient(response.data.clientName);

                        if (pendingList.length === 0) {
                            addMessage('assistant', `Não encontrei contas pendentes para ${response.data.clientName}. Deseja registrar uma nova venda?`);
                            setConversationState({
                                type: 'CONFIRM_ACTION',
                                data: {
                                    originalIntent: {
                                        intent: 'REGISTER_SALE',
                                        data: {
                                            clientName: response.data.clientName,
                                        }
                                    }
                                }
                            });
                        } else if (pendingList.length === 1) {
                            const bill = pendingList[0];
                            const dateStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString('pt-BR') : 'sem data';
                            addMessage('assistant', `Você está falando da conta "${bill.description}" de R$${bill.amount} que vence dia ${dateStr}?`);
                            setConversationState({
                                type: 'CONFIRM_ACTION',
                                data: {
                                    originalIntent: {
                                        intent: 'CONFIRMATION_REQUIRED',
                                        data: {
                                            originalIntent: 'MARK_AS_PAID_ID',
                                            data: {
                                                id: bill.id,
                                                description: bill.description,
                                                amount: bill.amount,
                                                clientName: response.data.clientName
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            const list = pendingList.map(p => `${p.description} (R$${p.amount})`).join(', ');
                            addMessage('assistant', `Encontrei ${pendingList.length} contas pendentes da ${response.data.clientName}: ${list}. Qual delas você quer baixar?`);
                        }
                    } else if (response.data?.description) {
                        const pending = await DataManager.findPendingTransaction(response.data.description);
                        if (pending) {
                            await DataManager.updateTransaction(pending.id, { status: 'paid' });
                            addMessage('assistant', `Conta "${pending.description}" marcada como paga!`, 'success');
                        } else {
                            addMessage('assistant', `Não encontrei nenhuma conta pendente com a descrição "${response.data.description}".`, 'error');
                        }
                    }
                    break;

                case 'DELETE_LAST_ACTION':
                    const deleted = await DataManager.deleteLastAction();
                    if (deleted) addMessage('assistant', "Último registro apagado com sucesso.", 'success');
                    else addMessage('assistant', "Não encontrei nada recente para apagar.", 'error');
                    break;

                case 'REPORT':
                    if (!await checkLimit()) break;
                    const { entity, metric, period, filter, type, status } = response.data;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (entity === 'APPOINTMENT') {
                        const appointments = await DataManager.getAppointments();
                        const filtered = appointments.filter(a => {
                            const d = new Date(a.date_time);
                            if (period === 'TODAY') return d.toDateString() === today.toDateString();
                            if (period === 'TOMORROW') {
                                const tomorrow = new Date(today);
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                return d.toDateString() === tomorrow.toDateString();
                            }
                            if (period === 'NEXT_MONTH') {
                                const nextMonth = new Date(today);
                                nextMonth.setMonth(nextMonth.getMonth() + 1);
                                return d.getMonth() === nextMonth.getMonth() && d.getFullYear() === nextMonth.getFullYear();
                            }
                            if (period === 'MONTH') {
                                const targetM = response.data.targetMonth ? response.data.targetMonth - 1 : today.getMonth();
                                const targetY = response.data.targetYear || today.getFullYear();
                                return d.getMonth() === targetM && d.getFullYear() === targetY;
                            }
                            if (period === 'SPECIFIC_DATE' && response.data.targetDate) {
                                const targetDateStr = response.data.targetDate;
                                const dStr = d.toISOString().split('T')[0];
                                return dStr === targetDateStr;
                            }
                            return true;
                        });

                        if (metric === 'COUNT') {
                            addMessage('assistant', `Você tem ${filtered.length} agendamentos.`, 'success');
                        } else {
                            if (filtered.length === 0) addMessage('assistant', "Nada agendado para este período.", 'success');
                            else {
                                const list = filtered.map(a => {
                                    const d = new Date(a.date_time);
                                    const isToday = d.toDateString() === today.toDateString();
                                    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const dateStr = isToday ? time : `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${time}`;
                                    return `• ${dateStr} - ${a.client?.name || 'Cliente'} (${a.description})`;
                                }).join('\n');
                                addMessage('assistant', `Agenda:\n${list}`, 'success');
                            }
                        }

                    }
                    else if (entity === 'FINANCIAL') {
                        if (status === 'PENDING' && period === 'MONTH' && type) {
                            const pendingRecords = await DataManager.getPendingFinancialRecords(type.toLowerCase());

                            const targetM = response.data.targetMonth ? response.data.targetMonth - 1 : today.getMonth();
                            const targetY = response.data.targetYear || today.getFullYear();
                            const lastDayOfMonth = new Date(targetY, targetM + 1, 0);

                            let overdueSum = 0;
                            let upcomingSum = 0;

                            pendingRecords.forEach(r => {
                                if (!r.due_date) return;

                                let dateStr = r.due_date;
                                if (dateStr.length === 10 && !dateStr.includes('T')) {
                                    dateStr += 'T12:00:00';
                                }

                                const dueDate = new Date(dateStr);

                                if (isNaN(dueDate.getTime())) return;

                                if (dueDate < today) {
                                    overdueSum += Number(r.amount);
                                } else if (dueDate <= lastDayOfMonth) {
                                    upcomingSum += Number(r.amount);
                                }
                            });

                            const total = overdueSum + upcomingSum;
                            const typeLabel = type.toLowerCase() === 'income' ? 'receber' : 'pagar';

                            let msg = '';
                            if (total === 0) {
                                msg = `Não encontrei contas a ${typeLabel} para este mês.`;
                            } else {
                                msg = `Para este mês, você tem um total de R$ ${total.toFixed(2)} a ${typeLabel}.`;
                                if (overdueSum > 0 && upcomingSum > 0) {
                                    msg += ` Sendo R$ ${overdueSum.toFixed(2)} já vencidos e R$ ${upcomingSum.toFixed(2)} que ainda vão vencer.`;
                                } else if (overdueSum > 0) {
                                    msg += ` Atenção: Todo esse valor (R$ ${overdueSum.toFixed(2)}) já está vencido.`;
                                } else {
                                    msg += ` Todo esse valor ainda vai vencer.`;
                                }
                            }

                            addMessage('assistant', msg, 'success');
                        } else {
                            const records = await DataManager.getFinancialSummary();
                            const filtered = records.filter(r => {
                                const d = new Date(r.created_at);
                                if (period === 'TODAY') return d.toDateString() === today.toDateString();
                                if (period === 'TOMORROW') {
                                    const tomorrow = new Date(today);
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    return d.toDateString() === tomorrow.toDateString();
                                }
                                if (period === 'NEXT_MONTH') {
                                    const nextMonth = new Date(today);
                                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                                    return d.getMonth() === nextMonth.getMonth() && d.getFullYear() === nextMonth.getFullYear();
                                }
                                if (period === 'MONTH') {
                                    const targetM = response.data.targetMonth ? response.data.targetMonth - 1 : today.getMonth();
                                    const targetY = response.data.targetYear || today.getFullYear();
                                    return d.getMonth() === targetM && d.getFullYear() === targetY;
                                }
                                if (period === 'SPECIFIC_DATE' && response.data.targetDate) {
                                    const targetDateStr = response.data.targetDate;
                                    const dStr = d.toISOString().split('T')[0];
                                    return dStr === targetDateStr;
                                }
                                return true;
                            });

                            const typeFilter = (type || filter) ? (type || filter).toLowerCase() : null;
                            const finalRecords = typeFilter ? filtered.filter(r => r.type === typeFilter) : filtered;

                            const statusFilter = status ? status.toLowerCase() : null;
                            const statusFiltered = statusFilter ? finalRecords.filter(r => r.status === statusFilter) : finalRecords;

                            const total = statusFiltered.reduce((sum, r) => sum + Number(r.amount), 0);

                            const label = typeFilter === 'income' ? 'Ganhos' : typeFilter === 'expense' ? 'Gastos' : 'Total';
                            const periodLabel = period === 'TODAY' ? 'de hoje' : period === 'TOMORROW' ? 'de amanhã' : period === 'NEXT_MONTH' ? 'do mês que vem' : period === 'MONTH' ? 'deste mês' : 'total';

                            if (status === 'PAID') {
                                addMessage('assistant', `${label} pagos ${periodLabel}: R$ ${total.toFixed(2)}`, 'success');
                            } else {
                                addMessage('assistant', `${label} ${periodLabel}: R$ ${total.toFixed(2)}`, 'success');
                            }
                        }
                    }
                    else if (entity === 'CLIENT' && metric === 'BEST') {
                        const records = await DataManager.getFinancialSummary();
                        const income = records.filter(r => r.type === 'income');
                        const totals: Record<string, number> = {};

                        income.forEach(r => {
                            const name = r.client?.name || 'Desconhecido';
                            totals[name] = (totals[name] || 0) + Number(r.amount);
                        });

                        let bestClient = '';
                        let maxAmount = 0;

                        Object.entries(totals).forEach(([name, amount]) => {
                            if (amount > maxAmount) {
                                maxAmount = amount;
                                bestClient = name;
                            }
                        });

                        if (bestClient) {
                            addMessage('assistant', `Melhor cliente (baseado nos últimos registros): ${bestClient} (R$ ${maxAmount.toFixed(2)})`, 'success');
                        } else {
                            addMessage('assistant', "Não tenho dados suficientes para determinar o melhor cliente.", 'success');
                        }
                    }
                    break;

                case 'NAVIGATE':
                    if (response.data?.route) {
                        addMessage('assistant', response.message, 'success');
                        router.push(response.data.route);
                    }
                    break;

                case 'RISKY_ACTION':
                    addMessage('assistant', response.message, 'text');
                    break;

                default:
                    addMessage('assistant', response.message, response.intent === 'UNKNOWN' ? 'error' : 'text');
            }

        } catch (error: any) {
            console.error(error);
            addMessage('assistant', error.message || "Desculpe, tive um erro técnico.", 'error');
        }
    };

    const handleFinalAction = async (response: any) => {
        // This function mimics the switch case logic for final actions
        // We can reuse the logic by calling a refactored function or just copying the relevant parts for now
        // Given the complexity, let's just handle the specific intents we expect from slot filling (REGISTER_SALE, REGISTER_EXPENSE)

        if (response.intent === 'REGISTER_SALE') {
            // ... Logic from REGISTER_SALE case ...
            // We can actually just call processAIResponse with a special flag or refactor processAIResponse to accept an object?
            // Refactoring processAIResponse to accept (input: string | AIResponse) would be cleaner but risky for now.

            // Let's copy the critical logic for REGISTER_SALE and REGISTER_EXPENSE here to ensure it works within the hook's context

            const clients = await DataManager.getClients();
            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

            if (!client) {
                addMessage('assistant', `Não encontrei a cliente "${response.data.clientName}". Deseja cadastrá-la agora?`);
                setConversationState({
                    type: 'CONFIRM_ADD_CLIENT',
                    data: {
                        name: response.data.clientName,
                        originalIntent: response
                    }
                });
                return;
            }

            let amountStr = String(response.data.amount || '').trim();
            amountStr = amountStr.replace(/R\$|\.(?=\d{3})/g, '').replace(',', '.').trim();
            const amount = Number(amountStr);

            if (!amount || isNaN(amount) || amount <= 0) {
                addMessage('assistant', response.message || "Por favor, informe o valor do serviço.");
                return;
            }

            const installments = response.data.installments || 1;
            const downPayment = response.data.downPaymentValue || response.data.downPayment || 0;
            let finalInstallmentValue = response.data.installmentValue;

            if (!finalInstallmentValue) {
                if (downPayment > 0) {
                    if (installments > 1) {
                        finalInstallmentValue = (amount - downPayment) / (installments - 1);
                    } else {
                        finalInstallmentValue = 0;
                    }
                } else {
                    finalInstallmentValue = amount / installments;
                }
            }

            if (downPayment > 0) {
                // If we have down payment, we might need payment method for it.
                // If not provided, we ask.
                if (!response.data.paymentMethod) {
                    setConversationState({
                        type: 'ASK_PAYMENT_METHOD',
                        data: {
                            transactionData: { ...response.data, amount: downPayment, isEntry: true, remainingInstallments: installments - 1, remainingValue: finalInstallmentValue, fullAmount: amount },
                            clientName: client.name
                        }
                    });
                    addMessage('assistant', `Certo, entrada de R$${downPayment}. Qual a forma de pagamento da entrada?`);
                    return;
                }

                await DataManager.addTransaction({
                    type: 'income',
                    amount: downPayment,
                    description: `${response.data.service} (Entrada)`,
                    payment_method: response.data.paymentMethod,
                    client_id: client.id,
                    status: 'paid'
                });
            }

            const startIdx = downPayment > 0 ? 1 : 0;
            const loopCount = downPayment > 0 ? installments - 1 : installments;

            if (loopCount > 0) {
                const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();
                for (let i = 0; i < loopCount; i++) {
                    const date = new Date(baseDate.getTime());
                    const monthOffset = i;
                    const targetMonth = date.getMonth() + monthOffset;
                    date.setMonth(targetMonth);

                    if (date.getDate() !== baseDate.getDate()) {
                        date.setDate(0);
                    }

                    const dateStr = date.toISOString().split('T')[0];

                    let currentStatus = response.data.status || 'paid';
                    // Force pending for future installments unless card
                    if (i > 0 && !response.data.paymentMethod?.toLowerCase().includes('cartão')) {
                        currentStatus = 'pending';
                    }
                    // If it's an installment plan (not card), it's usually pending
                    if (installments > 1 && !response.data.paymentMethod?.toLowerCase().includes('cartão')) {
                        currentStatus = 'pending';
                    }

                    // Specific logic: If has down payment, subsequent are pending (unless card)
                    if (downPayment > 0) currentStatus = 'pending';
                    // Specific logic: If NO down payment, ALL are pending (unless card)
                    if (downPayment === 0 && installments > 1) currentStatus = 'pending';


                    await DataManager.addTransaction({
                        type: 'income',
                        amount: finalInstallmentValue,
                        description: `${response.data.service} (${i + 1 + (downPayment > 0 ? 1 : 0)}/${installments})`,
                        payment_method: response.data.paymentMethod,
                        client_id: client.id,
                        status: currentStatus,
                        due_date: dateStr
                    });
                }
            }

            addMessage('assistant', response.message, 'success');
        } else if (response.intent === 'REGISTER_EXPENSE') {
            const expenseStatus = response.data.status || 'paid';
            const expensePaymentMethod = response.data.paymentMethod;

            const expInstallments = response.data.installments || 1;
            const expDownPayment = response.data.downPaymentValue || response.data.downPayment || 0;

            let expFinalInstallmentValue = response.data.installmentValue;
            if (!expFinalInstallmentValue) {
                if (expDownPayment > 0) {
                    if (expInstallments > 1) {
                        expFinalInstallmentValue = (response.data.amount - expDownPayment) / (expInstallments - 1);
                    } else {
                        expFinalInstallmentValue = 0;
                    }
                } else {
                    expFinalInstallmentValue = response.data.amount / expInstallments;
                }
            }

            if (expDownPayment > 0) {
                await DataManager.addTransaction({
                    type: 'expense',
                    amount: expDownPayment,
                    description: `${response.data.description} (Entrada)`,
                    payment_method: expensePaymentMethod,
                    status: 'paid'
                });
            }

            const expLoopCount = expDownPayment > 0 ? expInstallments - 1 : expInstallments;

            if (expLoopCount > 0) {
                const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();

                for (let i = 0; i < expLoopCount; i++) {
                    const date = new Date(baseDate.getTime());
                    const monthOffset = i;

                    const targetMonth = date.getMonth() + monthOffset;
                    date.setMonth(targetMonth);

                    if (date.getDate() !== baseDate.getDate()) {
                        date.setDate(0);
                    }
                    const dateStr = date.toISOString().split('T')[0];

                    let currentStatus = expenseStatus;
                    // Force pending if it's an installment plan (unless explicitly paid or single installment)
                    if (i > 0 || expDownPayment > 0 || (expInstallments > 1 && expDownPayment === 0)) {
                        currentStatus = 'pending';
                    }

                    await DataManager.addTransaction({
                        type: 'expense',
                        amount: expFinalInstallmentValue,
                        description: `${response.data.description} (${i + 1 + (expDownPayment > 0 ? 1 : 0)}/${expInstallments})`,
                        payment_method: expensePaymentMethod,
                        status: currentStatus,
                        due_date: dateStr
                    });
                }
            }
            addMessage('assistant', response.message, 'success');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userInput = input;
        setInput("");
        addMessage('user', userInput);
        setIsProcessing(true);

        await processAIResponse(userInput);

        setIsProcessing(false);
    };

    return {
        input,
        setInput,
        messages,
        isProcessing,
        usageCount,
        inputType,
        isSpeaking,
        userPlan,
        isListening,
        startListening,
        stopListening,
        isSupported,
        handleSubmit,
        handleLogout,
        setInputType
    };
}
