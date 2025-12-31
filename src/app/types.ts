export interface Client {
    id: string;
    name: string; // Nome usado pela IA
    full_name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    created_at: string;
}

export interface Appointment {
    id: string;
    client_id: string;
    date_time: string; // ISO string
    description: string;
    notes?: string;
    created_at?: string;
    client?: Client; // Joined data
}

export interface FinancialRecord {
    id: string;
    client_id?: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    payment_method?: string;
    created_at: string;
    client?: Client;
}

export type IntentType = 'ADD_CLIENT' | 'DELETE_CLIENT' | 'UPDATE_CLIENT' | 'LIST_CLIENTS' | 'SCHEDULE_SERVICE' | 'CANCEL_APPOINTMENT' | 'REGISTER_SALE' | 'REGISTER_EXPENSE' | 'DELETE_LAST_ACTION' | 'RISKY_ACTION' | 'CONFIRMATION_REQUIRED' | 'MULTI_ACTION' | 'REPORT' | 'UNKNOWN' | 'CHECK_CLIENT_SCHEDULE';

export interface AIResponse {
    intent: IntentType;
    data?: any;
    message: string; // Human readable explanation of what was understood
    spokenMessage?: string; // New field for short audio text
    confidence: number;
    audio?: string; // Base64 audio data
}
