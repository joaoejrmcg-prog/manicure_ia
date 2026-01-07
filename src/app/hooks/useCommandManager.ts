import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { processCommand } from '../actions/ai';
import { DataManager } from '../lib/data-manager';
import { supabase } from '../lib/supabase';
import { checkAndIncrementUsage, getDailyUsage, refundUsageAction } from '../actions/usage';
import { getRandomTip } from '@/lib/tips';
import { AIResponse } from '../types';

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
    | { type: 'CONFIRM_ACTION', data: { originalIntent: any } };

export function useCommandManager(playAudio: (text: string, serverAudioData?: string, forcedInputType?: 'text' | 'voice') => Promise<void>) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Olá! Sou sua secretária. Vamos começar?' }
    ]);
    const [conversationState, setConversationState] = useState<ConversationState>({ type: 'IDLE' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [usageCount, setUsageCount] = useState(0);
    const [userPlan, setUserPlan] = useState<string>('trial');

    const router = useRouter();

    // Initial Data Fetch
    useEffect(() => {
        getDailyUsage().then(setUsageCount);

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

    const addMessage = useCallback((role: 'user' | 'assistant', content: string, type: 'text' | 'error' | 'success' = 'text', skipRefund = false) => {
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

        /*
        // Dicas desativadas temporariamente a pedido do usuário
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
        */
    }, []);

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

    const processAIResponse = async (userInput: string, inputType: 'text' | 'voice' = 'text') => {
        setIsProcessing(true);
        try {
            // 1. Handle State Machine Logic
            if (conversationState.type === 'CONFIRM_ADD_CLIENT' || conversationState.type === 'CONFIRM_ACTION') {
                if (userInput.toLowerCase().match(/^(sim|s|pode|claro|ok|confirmo)/)) {
                    if (!await checkLimit()) return;

                    if (conversationState.type === 'CONFIRM_ACTION') {
                        const originalIntent = conversationState.data.originalIntent;
                        try {
                            // Re-execute logic based on original intent
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
                                    await playAudio("Pronto, agendado.", undefined);
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
                                        if (nextApp) appointmentId = nextApp.id;
                                        else {
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

                    // Logic for CONFIRM_ADD_CLIENT
                    try {
                        const newClient = await DataManager.addClient({ name: conversationState.data.name });
                        addMessage('assistant', `Pronto! Cadastrei a ${conversationState.data.name}.`, 'success');

                        try {
                            const originalData = conversationState.data.originalIntent.data;
                            if (conversationState.data.originalIntent.intent === 'REGISTER_SALE') {
                                const amount = Number(String(originalData.amount).replace(',', '.'));
                                let isPending = originalData.status === 'pending';
                                let dueDate = originalData.dueDate;
                                if (!isPending && dueDate && dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) isPending = true;

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
                                    await playAudio("Pronto, registrado.", undefined);
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
                                    await playAudio("Pronto, registrado.", undefined);
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
                                addMessage('assistant', `Agendado: ${originalData.service} para ${newClient.name} em ${dateStr}.`, 'success');
                                await playAudio("Pronto, agendado.", undefined);
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
                            await playAudio(msg, undefined);
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

            // 2. Standard AI Processing
            try {
                if (!await checkLimit()) return;

                const history = messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`);
                const response = await processCommand(userInput, history, 'text');

                if (response.spokenMessage || response.audio) {
                    await playAudio(response.spokenMessage || response.message, response.audio, inputType);
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
                                        await playAudio(spoken, undefined, inputType);
                                    } else {
                                        const msg = `A cliente ${client.name} não tem agendamentos futuros.`;
                                        if (!await checkLimit()) break;
                                        addMessage('assistant', msg, 'success');
                                        await playAudio(msg, undefined, inputType);
                                    }
                                } else {
                                    const msg = `Não encontrei nenhuma cliente chamada "${clientName}".`;
                                    addMessage('assistant', msg);
                                    await playAudio(msg, undefined, inputType);
                                }
                            } catch (e) {
                                console.error("Erro ao consultar horário:", e);
                                addMessage('assistant', "Houve um erro ao consultar a agenda.", 'error');
                            }
                        }
                        return;

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
                                        if (installments > 1) finalInstallmentValue = (amount - downPayment) / (installments - 1);
                                        else finalInstallmentValue = 0;
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
                                        if (date.getDate() !== baseDate.getDate()) date.setDate(0);
                                        const dateStr = date.toISOString().split('T')[0];

                                        let currentStatus = response.data.status || 'paid';
                                        if (i > 0 && !response.data.paymentMethod?.toLowerCase().includes('cartão')) currentStatus = 'pending';
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
                                if (expInstallments > 1) expFinalInstallmentValue = (response.data.amount - expDownPayment) / (expInstallments - 1);
                                else expFinalInstallmentValue = 0;
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
                                if (date.getDate() !== baseDate.getDate()) date.setDate(0);
                                const dateStr = date.toISOString().split('T')[0];

                                await DataManager.addTransaction({
                                    type: 'expense',
                                    amount: expFinalInstallmentValue,
                                    description: `${response.data.description} (${i + 1 + (expDownPayment > 0 ? 1 : 0)}/${expInstallments})`,
                                    payment_method: expensePaymentMethod,
                                    status: expenseStatus,
                                    due_date: dateStr
                                });
                            }
                        }
                        addMessage('assistant', response.message, 'success');
                        break;

                    case 'DELETE_LAST_ACTION':
                        const deleted = await DataManager.deleteLastAction();
                        if (deleted) addMessage('assistant', response.message, 'success');
                        else addMessage('assistant', "Não encontrei nada recente para apagar.", 'error');
                        break;

                    case 'CANCEL_APPOINTMENT':
                        let appointmentId = response.data?.appointmentId;
                        if (!appointmentId && response.data?.clientName) {
                            const clients = await DataManager.getClients();
                            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());
                            if (client) {
                                const nextApp = await DataManager.findNextAppointment(client.id);
                                if (nextApp) appointmentId = nextApp.id;
                            }
                        }
                        if (appointmentId) {
                            await DataManager.cancelAppointment(appointmentId);
                            addMessage('assistant', response.message, 'success');
                        } else {
                            addMessage('assistant', "Não encontrei o agendamento para cancelar.", 'error');
                        }
                        break;

                    case 'NAVIGATE':
                        if (response.data?.path) router.push(response.data.path);
                        addMessage('assistant', response.message);
                        break;

                    default:
                        addMessage('assistant', response.message);
                        break;
                }

            } catch (error) {
                console.error(error);
                addMessage('assistant', "Desculpe, tive um erro ao processar. Pode repetir?", 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return {
        input,
        setInput,
        messages,
        conversationState,
        isProcessing,
        usageCount,
        userPlan,
        addMessage,
        processAIResponse,
        handleLogout,
        setConversationState
    };
}
