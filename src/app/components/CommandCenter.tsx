"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { processCommand, generateAudio } from "../actions/ai";
import { DataManager } from "../lib/data-manager";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { checkAndIncrementUsage, getDailyUsage, refundUsageAction } from "../actions/usage";
import { VoiceOrb } from "./VoiceOrb";
import { getRandomTip } from "@/lib/tips";

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
        { id: '1', role: 'assistant', content: 'Olá! Sou sua secretária. Vamos começar?' }
    ]);
    const [conversationState, setConversationState] = useState<ConversationState>({ type: 'IDLE' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [usageCount, setUsageCount] = useState(0);
    const [inputType, setInputType] = useState<'text' | 'voice'>('text');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [userPlan, setUserPlan] = useState<string>('trial'); // Default to trial
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        getDailyUsage().then(setUsageCount);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [input]);
    const router = useRouter();

    const { isListening, transcript, startListening, stopListening, isSupported, resetTranscript } = useSpeechRecognition();

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
            setInputType('voice');
        }
    }, [transcript]);

    // Auto-send when listening stops
    useEffect(() => {
        if (!isListening && transcript && !isProcessing) {
            const userInput = transcript;

            const autoSend = async () => {
                setInput("");
                resetTranscript(); // Clear transcript to prevent double-send
                addMessage('user', userInput);
                setIsProcessing(true);
                await processAIResponse(userInput);
                setIsProcessing(false);
            };

            autoSend();
        }
    }, [isListening]); // Only trigger when isListening changes

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
                return;
            }

            // Fetch subscription
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

        // Refund usage if it's an error or just informational (text)
        // Only 'success' messages should consume quota
        // AND skipRefund must be false
        if (role === 'assistant' && type !== 'success' && !skipRefund) {
            refundUsageAction().then(() => {
                // Update local count to reflect refund
                setUsageCount(prev => Math.max(0, prev - 1));
            });
        }

        // Add random tip after success messages (30% chance)
        if (role === 'assistant' && type === 'success') {
            // 30% probability
            if (Math.random() < 0.3) {
                // Delay slightly so tip appears after success message
                setTimeout(() => {
                    const randomTip = getRandomTip();
                    setMessages(prev => [...prev, {
                        id: Math.random().toString(36).substring(7),
                        role: 'assistant',
                        content: `💡 **Dica:** ${randomTip}`,
                        type: 'text'
                    }]);
                }, 500); // 500ms delay for better UX
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
        // VOICE DISABLED BY USER REQUEST (See .voice_backup.tsx for original)
        return;

        /*
        const effectiveInputType = forcedInputType || inputType;
        console.log(`🔊 playAudioWithCache called for: "${text}" | InputType: ${effectiveInputType}`);
        if (effectiveInputType !== 'voice') {
            console.log("🔇 Skipping audio: inputType is not voice");
            return;
        }
        */

        try {
            setIsSpeaking(true);
            const cacheKey = `audio_cache_${text.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const cachedAudio = localStorage.getItem(cacheKey);

            let audioToPlay = cachedAudio;
            let shouldCache = false;

            if (!audioToPlay) {
                if (serverAudioData) {
                    audioToPlay = serverAudioData || null;
                    shouldCache = true;
                } else {
                    // Try to generate with OpenAI
                    const generated = await generateAudio(text);
                    if (generated) {
                        audioToPlay = generated;
                        shouldCache = true;
                    } else {
                        // Fallback to Browser TTS (Native PT-BR)
                        console.log("🌐 Using Browser TTS fallback");
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = 'pt-BR';
                        utterance.rate = 1.1; // Slightly faster

                        // Find a good PT-BR voice
                        const voices = window.speechSynthesis.getVoices();
                        const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt'));
                        if (ptVoice) utterance.voice = ptVoice || null;

                        window.speechSynthesis.speak(utterance);

                        // Wait for end (approximate since onend is tricky with React updates)
                        await new Promise<void>(resolve => {
                            utterance.onend = () => resolve();
                            // Timeout fallback
                            setTimeout(resolve, (text.length * 100) + 1000);
                        });
                        return; // Exit since we played via browser
                    }
                }
            }

            if (audioToPlay) {
                // PLAY FIRST!
                const audio = new Audio(`data:audio/mp3;base64,${audioToPlay}`);

                // Cache in background (don't await)
                if (shouldCache) {
                    setTimeout(() => {
                        try {
                            localStorage.setItem(cacheKey, audioToPlay!);
                            console.log("💾 Audio cached in background");
                        } catch (e) {
                            console.warn("Storage full, skipping cache");
                        }
                    }, 0);
                }

                await new Promise<void>((resolve) => {
                    audio.onended = () => resolve();
                    audio.play().catch(e => {
                        console.error("Audio play error:", e);
                        resolve();
                    });
                });
            }
        } catch (e) {
            console.error("Error playing system audio:", e);
        } finally {
            setIsSpeaking(false);
        }
    };

    const processAIResponse = async (userInput: string) => {
        // 1. Handle State Machine Logic (Client-Side Interception)
        if (conversationState.type === 'CONFIRM_ADD_CLIENT' || conversationState.type === 'CONFIRM_ACTION') {
            if (userInput.toLowerCase().match(/^(sim|s|pode|claro|ok|confirmo)/)) {
                if (!await checkLimit()) return;

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
                        } else if (originalIntent.data.originalIntent === 'MARK_AS_PAID_ID') {
                            // Transition to ASK_PAYMENT_METHOD instead of updating immediately
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

                // Logic for CONFIRM_ADD_CLIENT (existing)
                try {
                    const newClient = await DataManager.addClient({ name: conversationState.data.name });
                    addMessage('assistant', `Pronto! Cadastrei a ${conversationState.data.name}.`, 'success');

                    // Resume original intent (Separate try/catch to not block client creation success)
                    try {
                        const originalData = conversationState.data.originalIntent.data;

                        if (conversationState.data.originalIntent.intent === 'REGISTER_SALE') {
                            // Sanitize amount
                            const amount = Number(String(originalData.amount).replace(',', '.'));

                            // Check if it's a pending sale
                            let isPending = originalData.status === 'pending';
                            let dueDate = originalData.dueDate;

                            // Fallback: If AI forgot status='pending' but sent a due date, infer pending
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
                                        transactionData: { ...originalData, amount }, // Pass sanitized amount
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
                            const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                            const msg = `Agendado: ${originalData.service} para ${newClient.name} em ${dateStr}.`;
                            addMessage('assistant', msg, 'success');



                            // Use a short confirmation for audio, but cache it
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

            // Validate amount again
            const amount = Number(String(updatedTransactionData.amount).replace(',', '.'));
            if (isNaN(amount) || amount <= 0) {
                // Should not happen if we validated before entering this state, but as a safeguard:
                addMessage('assistant', "Valor inválido. Por favor, tente registrar novamente.");
                setConversationState({ type: 'IDLE' });
                return;
            }

            // checkLimit is already called at start of processAIResponse, but here we are in a continuation state.
            // We need to charge for this continuation step as well?
            // Actually, the user already paid for the first step (which refunded).
            // So we SHOULD charge here.
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
                    // Income Logic (Existing)
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
                        // Client not found -> Trigger Add Client Flow
                        const msg = `Não encontrei o cliente "${clientName}". Deseja cadastrá-lo agora?`;
                        addMessage('assistant', msg);
                        await playAudioWithCache(msg, undefined);

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
                    // Date parsing logic
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
            // Check usage limit BEFORE processing
            if (!await checkLimit()) return;

            // Capture inputType at the start of the request to avoid state drift
            const currentInputType = inputType;

            // Prepare history (last 10 messages)
            const history = messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`);
            // Force 'text' to prevent server from generating audio (saves cost/time)
            const response = await processCommand(userInput, history, 'text');

            if (response.spokenMessage || response.audio) {
                await playAudioWithCache(response.spokenMessage || response.message, response.audio, currentInputType);
            }

            // Handle specific intents that require client-side logic
            switch (response.intent) {
                case 'CONFIRMATION_REQUIRED':
                    // Check if we are missing critical data even if AI asked for confirmation
                    // Only force ASK_PAYMENT_METHOD if we have client, service AND amount but missing payment
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
                            // Sanitize amount - handle various formats
                            let amountStr = String(response.data.amount || '').trim();
                            // Remove R$, espaços, e converte vírgula para ponto
                            amountStr = amountStr.replace(/R\$|\.(?=\d{3})/g, '').replace(',', '.').trim();
                            const amount = Number(amountStr);

                            // Validate amount
                            if (!amount || isNaN(amount) || amount <= 0) {
                                // Amount is missing or invalid. 
                                // The AI likely asked for it in response.message.
                                // Just show the message and let the user reply (IDLE state).
                                addMessage('assistant', response.message || "Por favor, informe o valor do serviço.");
                                return;
                            }

                            // Installment Logic
                            const installments = response.data.installments || 1;
                            const downPayment = response.data.downPayment || 0;
                            const installmentValue = response.data.installmentValue || (amount - downPayment) / (installments - (downPayment > 0 ? 0 : 0)); // If downPayment exists, it's separate usually? AI logic says: "Entrada + 2x". So installments=3 (total) or 2 (remaining)?
                            // Let's stick to the plan: AI normalizes to TOTAL installments.
                            // Case 1: "300 em 3x" -> amount=300, installments=3, downPayment=0. Each = 100.
                            // Case 2: "Entrada 50 + 2x 100" -> amount=250, downPayment=50, installments=3 (1+2).

                            // Actually, let's trust the AI's "installmentValue" if present.
                            let finalInstallmentValue = response.data.installmentValue;
                            if (!finalInstallmentValue) {
                                if (downPayment > 0) {
                                    // If downPayment is set, we assume the rest is split among (installments - 1)
                                    // Example: 3x total. 1 is downPayment. 2 are future.
                                    if (installments > 1) {
                                        finalInstallmentValue = (amount - downPayment) / (installments - 1);
                                    } else {
                                        finalInstallmentValue = 0; // Should not happen if installments=1 and downPayment=amount
                                    }
                                } else {
                                    finalInstallmentValue = amount / installments;
                                }
                            }

                            // 1. Handle Down Payment (or Single Payment)
                            if (downPayment > 0) {
                                // Entry is ALWAYS paid immediately (or at least treated as such for now, unless AI says otherwise, but "Entrada" implies now)
                                // If paymentMethod missing for entry?
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

                            // 2. Handle Future Installments
                            const startIdx = downPayment > 0 ? 1 : 0; // If downPayment, we already did 1.
                            const loopCount = downPayment > 0 ? installments - 1 : installments;

                            if (loopCount > 0) {
                                // If it's a standard sale without downPayment, the first one might be PAID or PENDING depending on status.
                                // If status='pending', ALL are pending.
                                // If status='paid' (default), usually implies "Credit Card" where you receive all? 
                                // NO, for a small business, "3x no cartão" usually means receiving in 3 months (if not anticipated).
                                // BUT "3x no dinheiro/promissória" means 3 months.
                                // Let's assume: If "Pending", all pending. If "Paid" and installments > 1, it might be Credit Card (treated as 1 receipt? or 3?)
                                // User request: "Generate records... If 2 times, generate 2 records."

                                // If status is PAID and method is CREDIT_CARD, usually we register 1 sale of total amount?
                                // User said: "Precisa entender que é necessário a quantidade de vezes e então gerar registros no banco de dados."
                                // So we generate N records regardless.

                                const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();
                                for (let i = 0; i < loopCount; i++) {
                                    const isFirstOfLoop = i === 0;
                                    // Calculate Date
                                    // Create a fresh date from baseDate to avoid mutation issues
                                    const date = new Date(baseDate.getTime()); // Clone
                                    const monthOffset = i;

                                    // Safe month increment handling day overflow (e.g. Jan 31 -> Feb 28/29)
                                    const targetMonth = date.getMonth() + monthOffset;
                                    date.setMonth(targetMonth);

                                    // If day changed (overflow), set to last day of previous month
                                    if (date.getDate() !== baseDate.getDate()) {
                                        date.setDate(0);
                                    }

                                    const dateStr = date.toISOString().split('T')[0];

                                    // Status Logic
                                    // If downPayment > 0, future ones are PENDING.
                                    // If NO downPayment:
                                    //   - If status='pending', ALL pending.
                                    //   - If status='paid', 1st is PAID, others PENDING? Or all PAID (Credit Card)?
                                    //   - Let's assume: If PaymentMethod is Credit Card, all are PAID (technically approved).
                                    //   - If PaymentMethod is "Promissória/Fiado", all PENDING.
                                    //   - For safety: If installments > 1, force PENDING for i > 0 unless explicitly "Paid".

                                    let currentStatus = response.data.status || 'paid';
                                    if (i > 0 && !response.data.paymentMethod?.toLowerCase().includes('cartão')) {
                                        currentStatus = 'pending';
                                    }
                                    // If downPayment exists, all remaining are pending usually
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
                    if (clients.length === 0) addMessage('assistant', "Nenhuma cliente cadastrada.", 'success');
                    else addMessage('assistant', `Clientes: ${clients.map(c => c.name).join(", ")}`, 'success');
                    break;

                case 'REGISTER_EXPENSE':
                    const expenseStatus = response.data.status || 'paid';
                    const expensePaymentMethod = response.data.paymentMethod;



                    // Installment Logic for Expense
                    const expInstallments = response.data.installments || 1;
                    const expDownPayment = response.data.downPayment || 0;

                    // Calculate installment value if not provided
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

                    // 1. Handle Down Payment (Entry)
                    if (expDownPayment > 0) {


                        await DataManager.addTransaction({
                            type: 'expense',
                            amount: expDownPayment,
                            description: `${response.data.description} (Entrada)`,
                            payment_method: expensePaymentMethod,
                            status: 'paid' // Entry is paid
                        });
                    }

                    // 2. Handle Future Installments
                    const expStartIdx = expDownPayment > 0 ? 1 : 0;
                    const expLoopCount = expDownPayment > 0 ? expInstallments - 1 : expInstallments;

                    if (expLoopCount > 0) {
                        const baseDate = response.data.dueDate ? new Date(response.data.dueDate) : new Date();

                        for (let i = 0; i < expLoopCount; i++) {
                            const isFirstOfLoop = i === 0;
                            const date = new Date(baseDate.getTime()); // Clone
                            const monthOffset = i;

                            const targetMonth = date.getMonth() + monthOffset;
                            date.setMonth(targetMonth);

                            // Handle day overflow
                            if (date.getDate() !== baseDate.getDate()) {
                                date.setDate(0);
                            }

                            const dateStr = date.toISOString().split('T')[0];

                            let currentStatus = expenseStatus;
                            // If installments > 1, usually future ones are pending unless explicitly paid (e.g. credit card bill paid in full? No, expense installments usually mean future payments)
                            if (i > 0 || expDownPayment > 0) {
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
                        // Scenario: "Recebi da Natalia"
                        const pendingList = await DataManager.findPendingTransactionsByClient(response.data.clientName);

                        if (pendingList.length === 0) {
                            // No pending bills -> Ask to register new sale
                            addMessage('assistant', `Não encontrei contas pendentes para ${response.data.clientName}. Deseja registrar uma nova venda?`);
                            setConversationState({
                                type: 'CONFIRM_ACTION',
                                data: {
                                    originalIntent: {
                                        intent: 'REGISTER_SALE',
                                        data: {
                                            clientName: response.data.clientName,
                                            // We don't have amount/service yet, so the AI will ask later or we can prompt now
                                            // But standard REGISTER_SALE flow handles missing data
                                        }
                                    }
                                }
                            });
                        } else if (pendingList.length === 1) {
                            // One pending bill -> Confirm
                            const bill = pendingList[0];
                            const dateStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString('pt-BR') : 'sem data';
                            addMessage('assistant', `Você está falando da conta "${bill.description}" de R$${bill.amount} que vence dia ${dateStr}?`);
                            setConversationState({
                                type: 'CONFIRM_ACTION',
                                data: {
                                    originalIntent: {
                                        intent: 'CONFIRMATION_REQUIRED', // Fake intent to match structure
                                        data: {
                                            originalIntent: 'MARK_AS_PAID_ID', // Internal intent
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
                            // Multiple pending bills -> List them (MVP: Just list and ask to be specific)
                            const list = pendingList.map(p => `${p.description} (R$${p.amount})`).join(', ');
                            addMessage('assistant', `Encontrei ${pendingList.length} contas pendentes da ${response.data.clientName}: ${list}. Qual delas você quer baixar?`);
                            // IDLE state, user replies with description
                        }
                    } else if (response.data?.description) {
                        // Legacy/Generic: "Paguei a luz"
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
                    today.setHours(0, 0, 0, 0); // Normalize to start of day

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
                                // targetDate format: YYYY-MM-DD
                                // d is Date object
                                const targetDateStr = response.data.targetDate;
                                // Create date object from target string to compare properly (ignoring time)
                                // But simpler: compare YYYY-MM-DD strings
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
                        // NEW LOGIC: Handle Pending (Overdue vs Upcoming)
                        if (status === 'PENDING' && period === 'MONTH' && type) {
                            const pendingRecords = await DataManager.getPendingFinancialRecords(type.toLowerCase());
                            console.log('[DEBUG] Pending Records Found:', pendingRecords.length, pendingRecords);

                            const targetM = response.data.targetMonth ? response.data.targetMonth - 1 : today.getMonth();
                            const targetY = response.data.targetYear || today.getFullYear();
                            const lastDayOfMonth = new Date(targetY, targetM + 1, 0);

                            let overdueSum = 0;
                            let upcomingSum = 0;

                            pendingRecords.forEach(r => {
                                if (!r.due_date) {
                                    console.log('[DEBUG] Record skipped: No due_date', r);
                                    return;
                                }

                                let dateStr = r.due_date;
                                // If it looks like a date-only string (YYYY-MM-DD), append time to avoid timezone issues
                                if (dateStr.length === 10 && !dateStr.includes('T')) {
                                    dateStr += 'T12:00:00';
                                }

                                const dueDate = new Date(dateStr);

                                if (isNaN(dueDate.getTime())) {
                                    console.error(`[DEBUG] Invalid Date encountered: ${r.due_date} (parsed as ${dateStr})`);
                                    return;
                                }

                                console.log(`[DEBUG] Processing Record: ${r.description} | Due: ${r.due_date} | Parsed: ${dueDate.toISOString()} | Amount: ${r.amount}`);
                                console.log(`[DEBUG] Comparison: < Today(${today.toISOString()})? ${dueDate < today} | <= LastDay(${lastDayOfMonth.toISOString()})? ${dueDate <= lastDayOfMonth}`);

                                if (dueDate < today) {
                                    overdueSum += Number(r.amount);
                                    console.log(`[DEBUG] Added to Overdue. New Sum: ${overdueSum}`);
                                } else if (dueDate <= lastDayOfMonth) {
                                    upcomingSum += Number(r.amount);
                                    console.log(`[DEBUG] Added to Upcoming. New Sum: ${upcomingSum}`);
                                } else {
                                    console.log('[DEBUG] Record outside current month range.');
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
                            // EXISTING LOGIC (Summary of created_at records - usually for "Paid" or "History")
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
        <div className="flex flex-col h-full bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
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
                            <span className="mx-1 text-neutral-700">•</span>
                            {['vip', 'pro'].includes(userPlan.toLowerCase()) ? (
                                <span className="text-blue-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Ilimitado
                                </span>
                            ) : (
                                <span className={usageCount >= 10 ? "text-red-400" : "text-neutral-400"}>
                                    {Math.max(0, 10 - usageCount)} respostas verdes restantes
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 transition-all duration-300",
                (isListening || (isProcessing && inputType === 'voice') || isSpeaking) && "pb-[350px]"
            )}>
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
                                "max-w-full md:max-w-[80%] rounded-2xl px-4 py-3 text-lg",
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
                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setInputType('text');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={isListening ? "Ouvindo..." : "Digite ou fale um comando..."}
                        className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none resize-none min-h-[48px] max-h-[120px] scrollbar-thin scrollbar-thumb-neutral-600"
                        disabled={isProcessing}
                        rows={1}
                    />

                    <div className="flex items-center gap-2 pb-1">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-3 rounded-xl transition-all duration-300",
                                isListening
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
                            )}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={!input.trim() || isProcessing}
                            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 shadow-lg shadow-blue-500/20 disabled:shadow-none"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-center text-neutral-600 mt-2">
                    Enter para enviar • Shift + Enter para quebrar linha
                </p>
            </div>
            {(isListening || (isProcessing && inputType === 'voice') || isSpeaking) && (
                <VoiceOrb mode={isSpeaking ? 'SPEAKING' : (isProcessing ? 'PROCESSING' : 'LISTENING')} />
            )}
        </div>
    );
}
