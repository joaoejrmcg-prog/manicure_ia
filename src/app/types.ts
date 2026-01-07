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
    // Recurring appointment fields
    is_recurring?: boolean;
    recurrence_type?: 'weekly' | 'monthly';
    recurrence_day_of_week?: number; // 0=Sunday, 6=Saturday
    recurrence_day_of_month?: number; // 1-31
    recurrence_time?: string; // HH:MM:SS format
    recurrence_end_date?: string; // ISO string
}

export interface RecurringException {
    id: string;
    recurring_appointment_id: string;
    user_id: string;
    exception_date: string; // YYYY-MM-DD
    exception_type: 'cancelled' | 'rescheduled';
    rescheduled_to?: string; // ISO string
    reason?: string;
    created_at?: string;
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
    status?: 'paid' | 'pending';
    due_date?: string;
}

export type IntentType = 'ADD_CLIENT' | 'DELETE_CLIENT' | 'UPDATE_CLIENT' | 'LIST_CLIENTS' | 'SCHEDULE_SERVICE' | 'CANCEL_APPOINTMENT' | 'REGISTER_SALE' | 'REGISTER_EXPENSE' | 'DELETE_LAST_ACTION' | 'RISKY_ACTION' | 'CONFIRMATION_REQUIRED' | 'MULTI_ACTION' | 'REPORT' | 'UNKNOWN' | 'CHECK_CLIENT_SCHEDULE' | 'UNSUPPORTED_FEATURE' | 'NAVIGATE' | 'MARK_AS_PAID' | 'SCHEDULE_RECURRING' | 'CANCEL_RECURRING_INSTANCE' | 'CANCEL_RECURRING_SERIES';

export interface AIResponse {
    intent: IntentType;
    data?: any;
    message: string; // Human readable explanation of what was understood
    spokenMessage?: string; // New field for short audio text
    confidence: number;
    audio?: string; // Base64 audio data
}
