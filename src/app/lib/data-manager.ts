import { supabase } from "./supabase";
import { Client, Appointment, FinancialRecord } from "../types";
import { checkWritePermission } from "../actions/subscription";

export const DataManager = {
    addClient: async (clientData: Partial<Client> & { name: string }) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

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

    getFinancialSummary: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // For MVP, just getting last 50 records
        const { data, error } = await supabase
            .from('financial_records')
            .select('*, client:clients(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500);

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
    }
};
