import { supabase } from "./supabase";
import { Client, Appointment, FinancialRecord, RecurringException } from "../types";
import { checkWritePermission } from "../actions/subscription";

export const DataManager = {
    addClient: async (clientData: Partial<Client> & { name: string }) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Check for duplicate name (case insensitive)
        const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', clientData.name)
            .maybeSingle();

        if (existing) {
            throw new Error(`Já existe um cliente com o nome "${clientData.name}". Por favor, use um nome diferente (ex: sobrenome).`);
        }

        const { data, error } = await supabase
            .from('clients')
            .insert([{ ...clientData, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        return data as Client;
    },

    updateClient: async (id: string, updates: Partial<Client>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        if (updates.name) {
            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .eq('user_id', user.id)
                .ilike('name', updates.name)
                .neq('id', id)
                .maybeSingle();

            if (existing) {
                throw new Error(`Já existe um cliente com o nome "${updates.name}". Por favor, use um nome diferente.`);
            }
        }

        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data as Client;
    },

    removeClient: async (idOrName: string) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        // Tenta remover por ID primeiro (UUID), se falhar tenta por nome (legacy/AI)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);

        const query = supabase.from('clients').delete();

        if (isUUID) {
            query.eq('id', idOrName);
        } else {
            query.ilike('name', idOrName);
        }

        // Security: Ensure we only delete client belonging to user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query.eq('user_id', user.id);

        const { data, error } = await query.select();

        if (error) throw error;
        return data && data.length > 0;
    },

    getClients: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Client[];
    },

    addAppointment: async (clientId: string, date: Date, description: string) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('appointments')
            .insert([{
                client_id: clientId,
                date_time: date.toISOString(),
                description,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data as Appointment;
    },

    updateAppointment: async (id: string, updates: Partial<Appointment>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data as Appointment;
    },

    getAppointments: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('appointments')
            .select('*, client:clients(name)')
            .eq('user_id', user.id)
            .order('date_time', { ascending: true });

        if (error) throw error;
        return data as Appointment[];
    },

    findNextAppointment: async (clientId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('appointments')
            .select('*, client:clients(name)')
            .eq('user_id', user.id)
            .eq('client_id', clientId)
            .gte('date_time', now) // Only future appointments
            .order('date_time', { ascending: true })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
        return data as Appointment | null;
    },

    cancelAppointment: async (appointmentId: string) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', appointmentId)
            .eq('user_id', user.id);

        if (error) throw error;
        return true;
    },

    addTransaction: async (transactionData: Partial<FinancialRecord>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('financial_records')
            .insert([{ ...transactionData, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        return data as FinancialRecord;
    },

    updateTransaction: async (id: string, updates: Partial<FinancialRecord>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('financial_records')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data as FinancialRecord;
    },

    deleteTransaction: async (id: string) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { error } = await supabase
            .from('financial_records')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return true;
    },

    getFinancialSummary: async (startDate?: string, endDate?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        let query = supabase
            .from('financial_records')
            .select('*, client:clients(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (startDate && endDate) {
            // Logic:
            // 1. If status is 'pending', check 'due_date'
            // 2. If status is NOT 'pending' (paid), check 'created_at' (or payment date if we had it, but created_at is the proxy for now)

            // Supabase .or() syntax with nested ANDs:
            // or(and(status.eq.pending,due_date.gte.Start,due_date.lte.End),and(status.neq.pending,created_at.gte.Start,created_at.lte.End))

            const pendingFilter = `and(status.eq.pending,due_date.gte.${startDate},due_date.lte.${endDate})`;
            const paidFilter = `and(status.neq.pending,created_at.gte.${startDate},created_at.lte.${endDate})`;

            query = query.or(`${pendingFilter},${paidFilter}`);
        } else {
            // Fallback for no date range (e.g. initial load if not provided, though we plan to always provide it)
            query = query.limit(500);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data as FinancialRecord[];
    },

    deleteLastAction: async () => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Try to find the absolute latest record between appointments and transactions
        const { data: lastApp } = await supabase
            .from('appointments')
            .select('id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const { data: lastTrans } = await supabase
            .from('financial_records')
            .select('id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let tableToDelete = '';
        let idToDelete = '';

        if (lastApp && lastTrans) {
            if (new Date(lastApp.created_at) > new Date(lastTrans.created_at)) {
                tableToDelete = 'appointments';
                idToDelete = lastApp.id;
            } else {
                tableToDelete = 'financial_records';
                idToDelete = lastTrans.id;
            }
        } else if (lastApp) {
            tableToDelete = 'appointments';
            idToDelete = lastApp.id;
        } else if (lastTrans) {
            tableToDelete = 'financial_records';
            idToDelete = lastTrans.id;
        } else {
            return false; // Nothing to delete
        }

        const { error } = await supabase
            .from(tableToDelete)
            .delete()
            .eq('id', idToDelete);

        if (error) throw error;
        return true;
    },

    findPendingTransaction: async (description: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Search for pending transactions that match the description
        const { data, error } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .ilike('description', `%${description}%`)
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data as FinancialRecord | null;
    },

    getPendingFinancialRecords: async (type: 'income' | 'expense') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .eq('type', type)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data as FinancialRecord[];
    },

    findPendingTransactionsByClient: async (clientName: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // 1. Find Client ID
        const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', clientName) // Exact match (case insensitive) preferred, or we could do partial
            .single();

        if (!client) return [];

        // 2. Find Pending Transactions
        const { data, error } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('client_id', client.id)
            .eq('status', 'pending')
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data as FinancialRecord[];
    },

    // ============================================
    // RECURRING APPOINTMENTS
    // ============================================

    addRecurringAppointment: async (
        clientId: string,
        description: string,
        recurrenceType: 'weekly' | 'monthly',
        options: {
            dayOfWeek?: number; // 0=Sunday, 6=Saturday
            dayOfMonth?: number; // 1-31
            time?: string; // HH:MM format
            endDate?: Date;
        }
    ) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Create a placeholder date_time for the recurring appointment
        const now = new Date();
        const timeStr = options.time || '09:00';
        const [hours, minutes] = timeStr.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);

        const { data, error } = await supabase
            .from('appointments')
            .insert([{
                client_id: clientId,
                date_time: now.toISOString(),
                description,
                user_id: user.id,
                is_recurring: true,
                recurrence_type: recurrenceType,
                recurrence_day_of_week: options.dayOfWeek,
                recurrence_day_of_month: options.dayOfMonth,
                recurrence_time: timeStr + ':00',
                recurrence_end_date: options.endDate?.toISOString() || null
            }])
            .select()
            .single();

        if (error) throw error;
        return data as Appointment;
    },

    getRecurringAppointments: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('appointments')
            .select('*, client:clients(*)')
            .eq('user_id', user.id)
            .eq('is_recurring', true)
            .is('recurrence_end_date', null) // Only active recurring
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Appointment[];
    },

    getRecurringExceptions: async (recurringAppointmentId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('recurring_exceptions')
            .select('*')
            .eq('recurring_appointment_id', recurringAppointmentId)
            .eq('user_id', user.id);

        if (error) throw error;
        return data as RecurringException[];
    },

    addRecurringException: async (
        recurringAppointmentId: string,
        exceptionDate: Date,
        exceptionType: 'cancelled' | 'rescheduled',
        options?: {
            rescheduledTo?: Date;
            reason?: string;
        }
    ) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Format date as YYYY-MM-DD
        const dateStr = exceptionDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('recurring_exceptions')
            .insert([{
                recurring_appointment_id: recurringAppointmentId,
                user_id: user.id,
                exception_date: dateStr,
                exception_type: exceptionType,
                rescheduled_to: options?.rescheduledTo?.toISOString() || null,
                reason: options?.reason || null
            }])
            .select()
            .single();

        if (error) throw error;
        return data as RecurringException;
    },

    cancelRecurringSeries: async (recurringAppointmentId: string, endDate?: Date) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('appointments')
            .update({
                recurrence_end_date: (endDate || new Date()).toISOString()
            })
            .eq('id', recurringAppointmentId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data as Appointment;
    },

    findRecurringAppointmentByClientAndDescription: async (clientId: string, description?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        let query = supabase
            .from('appointments')
            .select('*, client:clients(*)')
            .eq('user_id', user.id)
            .eq('client_id', clientId)
            .eq('is_recurring', true)
            .is('recurrence_end_date', null);

        if (description) {
            query = query.ilike('description', `%${description}%`);
        }

        const { data, error } = await query.limit(1).single();

        if (error && error.code !== 'PGRST116') throw error;
        return data as Appointment | null;
    },

    getExpandedAppointments: async (startDate: Date, endDate: Date) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Get regular (non-recurring) appointments in the range
        // Include is_recurring = false OR is_recurring IS NULL (legacy appointments)
        const { data: regularAppointments, error: regularError } = await supabase
            .from('appointments')
            .select('*, client:clients(*)')
            .eq('user_id', user.id)
            .or('is_recurring.eq.false,is_recurring.is.null')
            .gte('date_time', startDate.toISOString())
            .lte('date_time', endDate.toISOString())
            .order('date_time', { ascending: true });

        if (regularError) throw regularError;

        // Get active recurring appointments
        const { data: recurringAppointments, error: recurringError } = await supabase
            .from('appointments')
            .select('*, client:clients(*)')
            .eq('user_id', user.id)
            .eq('is_recurring', true)
            .or(`recurrence_end_date.is.null,recurrence_end_date.gte.${startDate.toISOString()}`);

        if (recurringError) throw recurringError;

        // Expand recurring appointments into instances
        const expandedRecurring: Appointment[] = [];

        for (const recurring of recurringAppointments || []) {
            // Get exceptions for this recurring appointment
            const { data: exceptions } = await supabase
                .from('recurring_exceptions')
                .select('*')
                .eq('recurring_appointment_id', recurring.id)
                .gte('exception_date', startDate.toISOString().split('T')[0])
                .lte('exception_date', endDate.toISOString().split('T')[0]);

            const exceptionDates = new Set((exceptions || [])
                .filter(e => e.exception_type === 'cancelled')
                .map(e => e.exception_date));

            // Generate instances within the date range
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                let shouldAdd = false;

                if (recurring.recurrence_type === 'weekly' && recurring.recurrence_day_of_week !== null) {
                    shouldAdd = currentDate.getDay() === recurring.recurrence_day_of_week;
                } else if (recurring.recurrence_type === 'monthly' && recurring.recurrence_day_of_month !== null) {
                    shouldAdd = currentDate.getDate() === recurring.recurrence_day_of_month;
                }

                if (shouldAdd) {
                    const dateStr = currentDate.toISOString().split('T')[0];

                    // Check if this date is an exception
                    if (!exceptionDates.has(dateStr)) {
                        // Check if recurrence has ended
                        if (!recurring.recurrence_end_date || new Date(recurring.recurrence_end_date) >= currentDate) {
                            // Create instance
                            const instanceDate = new Date(currentDate);
                            if (recurring.recurrence_time) {
                                const [h, m] = recurring.recurrence_time.split(':').map(Number);
                                instanceDate.setHours(h, m, 0, 0);
                            }

                            expandedRecurring.push({
                                ...recurring,
                                id: `${recurring.id}-${dateStr}`, // Virtual ID
                                date_time: instanceDate.toISOString()
                            });
                        }
                    }
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // Combine and sort
        const allAppointments = [...(regularAppointments || []), ...expandedRecurring];
        allAppointments.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

        return allAppointments as Appointment[];
    }
};
