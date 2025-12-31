"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { processCommand } from "../actions/ai";
import { DataManager } from "../lib/data-manager";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'error' | 'success';
};

type ConversationState =
    | { type: 'IDLE' }
    | { type: 'CONFIRM_ADD_CLIENT', data: { name: string, originalIntent: any } }
    | { type: 'ASK_PAYMENT_METHOD', data: { transactionData: any, clientName: string } }
    | { type: 'ASK_SERVICE', data: { scheduleData: any, clientName: string } }
    | { type: 'CONFIRM_ACTION', data: { originalIntent: any } };

export default function CommandCenter() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Olá! Sou sua secretária. Posso agendar um compromisso, lançar uma conta que você recebeu ou pagou e ainda cadastrar um cliente. Vamos começar?' }
    ]);
    const [conversationState, setConversationState] = useState<ConversationState>({ type: 'IDLE' });
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const { isListening, transcript, startListening, stopListening, isSupported } = useSpeechRecognition();

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Check auth and focus
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/login");
            }
        };
        checkUser();
        inputRef.current?.focus();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const addMessage = (role: 'user' | 'assistant', content: string, type: 'text' | 'error' | 'success' = 'text') => {
        setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role,
            content,
            type
        }]);
    };

    const processAIResponse = async (userInput: string) => {
        // 1. Handle State Machine Logic (Client-Side Interception)
        if (conversationState.type === 'CONFIRM_ADD_CLIENT' || conversationState.type === 'CONFIRM_ACTION') {
            if (userInput.toLowerCase().match(/^(sim|s|pode|claro|ok|confirmo)/)) {

                if (conversationState.type === 'CONFIRM_ACTION') {
                    // User confirmed generic action (schedule, sale, etc)
                    const originalIntent = conversationState.data.originalIntent;

                    // Re-inject the original intent as if it was a fresh command, but now we execute it directly
                    // We can reuse the logic below by calling a helper or just setting state to execute
                    // But simpler: just call processAIResponse again with a special flag or just handle the logic here.
                    // Actually, the cleanest way is to execute the action directly here based on the original intent data.

                    try {
                        if (originalIntent.data.originalIntent === 'SCHEDULE_SERVICE') {
                            // ... duplicate logic from below or refactor ...
                            // Let's refactor the execution logic to be reusable or just copy for now to be safe
                            const response = { ...originalIntent, intent: originalIntent.data.originalIntent, data: originalIntent.data };

                            // We need to find the client again
                            const clients = await DataManager.getClients();
                            // Strict match to avoid partial false positives (e.g. "a" matching "Maria")
                            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                            if (client) {
                                // Date parsing
                                const date = response.data.isoDate ? new Date(response.data.isoDate) : new Date();
                                if (!response.data.isoDate) {
                                    // Fallback for legacy
                                    const now = new Date();
                                    if (response.data.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                                    const hourMatch = response.data.timeString?.match(/(\d{1,2})(?:h|:)/);
                                    if (hourMatch) date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
                                }

                                await DataManager.addAppointment(client.id, date, response.data.service);
                                addMessage('assistant', "Agendado com sucesso!", 'success');
                            } else {
                                // Client not found during confirmation execution
                                addMessage('assistant', `Erro: Não encontrei a cliente "${response.data.clientName}" para finalizar.`, 'error');
                            }
                        } else if (originalIntent.data.originalIntent === 'REGISTER_SALE') {
                            const response = { ...originalIntent, intent: originalIntent.data.originalIntent, data: originalIntent.data };
                            const clients = await DataManager.getClients();
                            const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                            if (client) {
                                if (!response.data.paymentMethod) {
                                    setConversationState({
                                        type: 'ASK_PAYMENT_METHOD',
                                        data: {
                                            transactionData: response.data,
                                            clientName: client.name
                                        }
                                    });
                                    addMessage('assistant', "Qual foi a forma de pagamento? (Pix, Dinheiro, Cartão...)");
                                    return;
                                }

                                await DataManager.addTransaction({
                                    type: 'income',
                                    amount: response.data.amount,
                                    description: response.data.service,
                                    payment_method: response.data.paymentMethod,
                                    client_id: client.id
                                });
                                addMessage('assistant', "Venda registrada com sucesso!", 'success');
                            } else {
                                // Client not found -> Trigger Add Client Flow
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
                            // Should not happen here usually, but just in case
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

                            // If AI asked for confirmation directly, we might not have the ID yet
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
                        } else if (originalIntent.data.originalIntent === 'MULTI_ACTION') {
                            const actions = originalIntent.data.actions;
                            for (const action of actions) {
                                // Execute each action sequentially
                                // We reuse the logic by recursively calling a helper or just duplicating for now (simpler)
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
                                } catch (err) {
                                    console.error("Erro em ação múltipla:", err);
                                    addMessage('assistant', `Erro ao executar uma das ações.`, 'error');
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

                // Logic for CONFIRM_ADD_CLIENT (existing)
                try {
                    const newClient = await DataManager.addClient({ name: conversationState.data.name });
                    addMessage('assistant', `Pronto! Cadastrei a ${conversationState.data.name}.`, 'success');

                    // Resume original intent (Separate try/catch to not block client creation success)
                    try {
                        const originalData = conversationState.data.originalIntent.data;

                        if (conversationState.data.originalIntent.intent === 'REGISTER_SALE') {
                            if (!originalData.paymentMethod) {
                                setConversationState({
                                    type: 'ASK_PAYMENT_METHOD',
                                    data: {
                                        transactionData: originalData,
                                        clientName: conversationState.data.name
                                    }
                                });
                                addMessage('assistant', "Qual foi a forma de pagamento? (Pix, Dinheiro, Cartão...)");
                                return;
                            } else {
                                await DataManager.addTransaction({
                                    type: 'income',
                                    amount: originalData.amount,
                                    description: originalData.service,
                                    payment_method: originalData.paymentMethod,
                                    client_id: newClient.id
                                });
                                addMessage('assistant', `Venda registrada: R$${originalData.amount} (${originalData.service})`, 'success');
                            }
                        } else if (conversationState.data.originalIntent.intent === 'SCHEDULE_SERVICE') {
                            // Date parsing logic
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
                            addMessage('assistant', `Agendado: ${originalData.service} para ${newClient.name} em ${date.toLocaleString()}.`, 'success');
                        }
                    } catch (resumptionError) {
                        console.error("Erro na retomada:", resumptionError);
                        addMessage('assistant', "Cliente cadastrada, mas houve um erro ao processar o pedido seguinte.", 'error');
                    }

                    setConversationState({ type: 'IDLE' });
                    return;

                } catch (error) {
                    console.error(error);
                    addMessage('assistant', "Erro ao cadastrar cliente.", 'error');
                    setConversationState({ type: 'IDLE' });
                    return;
                }
            } else {
                // If user says something else (not yes/no), assume it's a correction or new command
                // Reset state and fall through to standard processing
                setConversationState({ type: 'IDLE' });
                // We need to re-process this input as a fresh command
                // Since we are inside handleSendMessage, we can't easily recurse without refactoring.
                // But setting IDLE and letting the user type again is safer than cancelling.
                // BETTER: We can just let it fall through to the main logic below!
                // But we need to break out of this if block.

                // However, the function structure has early returns.
                // So we should call processCommand here or refactor.

                // Simplest fix: If not confirmed/cancelled, treat as cancellation for now but with a better message?
                // No, the user wants to correct.

                // Let's try to fall through by NOT returning.
                // But we need to clear the state first.
                setConversationState({ type: 'IDLE' });
                // And we need to ensure we don't duplicate the message addition (it's already added at top).
                // We can just let the function continue to step 2.
            }
        }

        if (conversationState.type === 'ASK_PAYMENT_METHOD') {
            const paymentMethod = userInput; // Take input as payment method
            const { transactionData, clientName } = conversationState.data;

            // Update transaction data with the provided payment method
            const updatedTransactionData = { ...transactionData, paymentMethod };

            try {
                const clients = await DataManager.getClients();
                const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

                if (client) {
                    await DataManager.addTransaction({
                        type: 'income',
                        amount: updatedTransactionData.amount,
                        description: updatedTransactionData.service,
                        payment_method: updatedTransactionData.paymentMethod,
                        client_id: client.id
                    });
                    addMessage('assistant', `Venda registrada: R$${updatedTransactionData.amount} no ${updatedTransactionData.paymentMethod}.`, 'success');
                } else {
                    // Client not found -> Trigger Add Client Flow
                    addMessage('assistant', `Não encontrei o cliente "${clientName}". Deseja cadastrá-lo agora?`);
                    setConversationState({
                        type: 'CONFIRM_ADD_CLIENT',
                        data: {
                            name: clientName,
                            originalIntent: {
                                intent: 'REGISTER_SALE',
                                data: updatedTransactionData // Pass the data WITH the payment method so it executes immediately after
                            }
                        }
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                addMessage('assistant', "Erro ao registrar venda.", 'error');
            }
            setConversationState({ type: 'IDLE' });
            return;
        }

        if (conversationState.type === 'ASK_SERVICE') {
            const service = userInput;
            const { scheduleData, clientName } = conversationState.data;
            const updatedScheduleData = { ...scheduleData, service };

            try {
                const clients = await DataManager.getClients();
                const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

                if (client) {
                    // Date parsing logic
                    const date = updatedScheduleData.isoDate ? new Date(updatedScheduleData.isoDate) : new Date();
                    if (!updatedScheduleData.isoDate) {
                        const now = new Date();
                        if (updatedScheduleData.timeString?.includes('amanhã')) date.setDate(now.getDate() + 1);
                        const hourMatch = updatedScheduleData.timeString?.match(/(\d{1,2})(?:h|:)/);
                        if (hourMatch) date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
                    }

                    await DataManager.addAppointment(client.id, date, updatedScheduleData.service);
                    addMessage('assistant', `Agendado: ${updatedScheduleData.service} para ${client.name} em ${date.toLocaleString()}.`, 'success');
                } else {
                    // Client not found -> Trigger Add Client Flow
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

        // 2. Standard AI Processing (Server Action)
        try {
            // Prepare history (last 10 messages)
            const history = messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`);
            const response = await processCommand(userInput, history);

            // Handle specific intents that require client-side logic
            switch (response.intent) {
                case 'CONFIRMATION_REQUIRED':
                    // Check if we are missing critical data even if AI asked for confirmation
                    // Only force ASK_PAYMENT_METHOD if we have client and service but missing payment
                    if (response.data?.originalIntent === 'REGISTER_SALE' && !response.data?.paymentMethod && response.data?.clientName && response.data?.service) {
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
                    break;

                case 'REGISTER_SALE':
                case 'SCHEDULE_SERVICE':
                    if (response.data?.clientName) {
                        const clients = await DataManager.getClients();
                        const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                        if (!client) {
                            // Client not found -> Trigger Flow
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

                        // Client found -> Execute Action
                        if (response.intent === 'REGISTER_SALE') {
                            if (!response.data.paymentMethod) {
                                setConversationState({
                                    type: 'ASK_PAYMENT_METHOD',
                                    data: {
                                        transactionData: response.data,
                                        clientName: client.name
                                    }
                                });
                                addMessage('assistant', "Qual foi a forma de pagamento? (Pix, Dinheiro, Cartão...)");
                                return;
                            }

                            await DataManager.addTransaction({
                                type: 'income',
                                amount: response.data.amount,
                                description: response.data.service,
                                payment_method: response.data.paymentMethod,
                                client_id: client.id
                            });
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

                            // Date parsing logic
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
                    if (clients.length === 0) addMessage('assistant', "Nenhuma cliente cadastrada.", 'text');
                    else addMessage('assistant', `Clientes: ${clients.map(c => c.name).join(", ")}`, 'text');
                    break;

                case 'REGISTER_EXPENSE':
                    await DataManager.addTransaction({
                        type: 'expense',
                        amount: response.data.amount,
                        description: response.data.description
                    });
                    addMessage('assistant', response.message, 'success');
                    break;

                case 'DELETE_LAST_ACTION':
                    const deleted = await DataManager.deleteLastAction();
                    if (deleted) addMessage('assistant', "Último registro apagado com sucesso.", 'success');
                    else addMessage('assistant', "Não encontrei nada recente para apagar.", 'error');
                    break;

                case 'RISKY_ACTION':
                    addMessage('assistant', response.message, 'text');
                    break;

                case 'CANCEL_APPOINTMENT':
                    if (response.data?.clientName) {
                        const clients = await DataManager.getClients();
                        const client = clients.find(c => c.name.toLowerCase() === response.data.clientName.toLowerCase());

                        if (client) {
                            const nextApp = await DataManager.findNextAppointment(client.id);
                            if (nextApp) {
                                const date = new Date(nextApp.date_time).toLocaleString();
                                // We use CONFIRMATION_REQUIRED flow manually here
                                addMessage('assistant', `Encontrei um agendamento para ${client.name} em ${date} (${nextApp.description}). Deseja cancelar?`);
                                setConversationState({
                                    type: 'CONFIRM_ACTION',
                                    data: {
                                        originalIntent: {
                                            intent: 'CANCEL_APPOINTMENT',
                                            data: { appointmentId: nextApp.id, description: nextApp.description }
                                        }
                                    }
                                });
                            } else {
                                addMessage('assistant', `Não encontrei nenhum agendamento futuro para ${client.name}.`, 'error');
                            }
                        } else {
                            addMessage('assistant', `Não encontrei a cliente "${response.data.clientName}".`, 'error');
                        }
                    }
                    break;

                default:
                    addMessage('assistant', response.message, response.intent === 'UNKNOWN' ? 'error' : 'text');
            }

        } catch (error) {
            console.error(error);
            addMessage('assistant', "Desculpe, tive um erro técnico.", 'error');
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

    return (
        <div className="flex flex-col h-[600px] bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-neutral-200">Assistente IA</h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-blue-400" />
                        </div>
                        <h4 className="text-lg font-medium text-neutral-300 mb-2">Como posso ajudar?</h4>
                        <p className="text-sm text-neutral-500 max-w-xs">
                            Tente dizer: "Agendar reunião com João amanhã às 14h" ou "Recebi 150 reais da consultoria".
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex w-full",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                                msg.role === 'user'
                                    ? "bg-blue-600 text-white rounded-tr-none"
                                    : cn(
                                        "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700",
                                        msg.type === 'error' && "border-red-500/50 bg-red-500/10 text-red-200",
                                        msg.type === 'success' && "border-green-500/50 bg-green-500/10 text-green-200"
                                    )
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-1 opacity-50 text-xs uppercase tracking-wider font-medium">
                                    <Bot className="w-3 h-3" />
                                    IA
                                </div>
                            )}
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-neutral-900 border-t border-neutral-800">
                <div className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                        placeholder={isListening ? "Ouvindo..." : "Digite ou fale um comando..."}
                        className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-600 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
                        disabled={isProcessing}
                    />

                    <div className="absolute right-2 flex items-center gap-1">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-300",
                                isListening
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                                    : "hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200"
                            )}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={!input.trim() || isProcessing}
                            className="p-2 hover:bg-neutral-700 text-neutral-400 hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-center text-neutral-600 mt-2">
                    Pressione Enter para enviar
                </p>
            </div>
        </div>
    );
}
