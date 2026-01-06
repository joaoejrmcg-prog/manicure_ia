import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommandCenterLogic } from './useCommandCenterLogic';
import { DataManager } from '../lib/data-manager';
import { processCommand } from '../actions/ai';
import { checkAndIncrementUsage } from '../actions/usage';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
            signOut: vi.fn(),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { plan: 'pro' } }),
                }),
            }),
        }),
    },
}));

vi.mock('../lib/data-manager', () => ({
    DataManager: {
        getClients: vi.fn(),
        addTransaction: vi.fn(),
        addClient: vi.fn(),
        addAppointment: vi.fn(),
    },
}));

vi.mock('../actions/ai', () => ({
    processCommand: vi.fn(),
    generateAudio: vi.fn(),
}));

vi.mock('../actions/usage', () => ({
    checkAndIncrementUsage: vi.fn().mockResolvedValue({ allowed: true, count: 0 }),
    getDailyUsage: vi.fn().mockResolvedValue(0),
    refundUsageAction: vi.fn().mockResolvedValue(true),
}));

vi.mock('./useSpeechRecognition', () => ({
    useSpeechRecognition: () => ({
        isListening: false,
        transcript: '',
        startListening: vi.fn(),
        stopListening: vi.fn(),
        isSupported: true,
        resetTranscript: vi.fn(),
    }),
}));

vi.mock('@/lib/tips', () => ({
    getRandomTip: () => 'Dica teste',
}));

describe('useCommandCenterLogic - Payment Scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock for getClients
        (DataManager.getClients as any).mockResolvedValue([
            { id: 'client-1', name: 'Maria' },
        ]);
    });

    it('should register a simple cash sale', async () => {
        const { result } = renderHook(() => useCommandCenterLogic());

        // Mock AI response
        (processCommand as any).mockResolvedValue({
            intent: 'REGISTER_SALE',
            message: 'Venda registrada',
            data: {
                clientName: 'Maria',
                service: 'Manicure',
                amount: 50,
                paymentMethod: 'Dinheiro',
                status: 'paid'
            }
        });

        act(() => {
            result.current.setInput('Venda manicure Maria 50 reais dinheiro');
        });

        await act(async () => {
            await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
        });

        expect(DataManager.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
            type: 'income',
            amount: 50,
            description: 'Manicure (1/1)',
            payment_method: 'Dinheiro',
            client_id: 'client-1',
            status: 'paid'
        }));
    });

    it('should register a sale with installments (Credit Card)', async () => {
        const { result } = renderHook(() => useCommandCenterLogic());

        // Mock AI response for "300 em 3x no cartão"
        (processCommand as any).mockResolvedValue({
            intent: 'REGISTER_SALE',
            message: 'Venda parcelada registrada',
            data: {
                clientName: 'Maria',
                service: 'Procedimento',
                amount: 300,
                installments: 3,
                installmentValue: 100,
                paymentMethod: 'Cartão de Crédito',
                status: 'paid', // Credit card usually treated as paid/approved
                dueDate: '2024-01-01'
            }
        });

        act(() => {
            result.current.setInput('Venda 300 3x cartão Maria');
        });

        await act(async () => {
            await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
        });

        // Should call addTransaction 3 times
        expect(DataManager.addTransaction).toHaveBeenCalledTimes(3);

        // Verify first installment
        expect(DataManager.addTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({
            amount: 100,
            description: 'Procedimento (1/3)',
            payment_method: 'Cartão de Crédito',
            status: 'paid'
        }));
    });

    it('should register a sale with down payment + installments', async () => {
        const { result } = renderHook(() => useCommandCenterLogic());

        // Mock AI response for "300 total, 100 entrada + 2x"
        (processCommand as any).mockResolvedValue({
            intent: 'REGISTER_SALE',
            message: 'Venda com entrada registrada',
            data: {
                clientName: 'Maria',
                service: 'Pacote',
                amount: 300,
                downPayment: 100,
                installments: 3, // Total installments (1 entry + 2 future)
                installmentValue: 100, // (300-100)/2 = 100
                paymentMethod: 'Pix', // Entry method
                status: 'paid',
                dueDate: '2024-01-01'
            }
        });

        act(() => {
            result.current.setInput('Venda 300 entrada 100 resto 2x');
        });

        await act(async () => {
            await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
        });

        // Should call addTransaction 3 times (1 entry + 2 installments)
        expect(DataManager.addTransaction).toHaveBeenCalledTimes(3);

        // 1. Entry
        expect(DataManager.addTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({
            amount: 100,
            description: 'Pacote (Entrada)',
            status: 'paid'
        }));

        // 2. First Installment (Pending)
        expect(DataManager.addTransaction).toHaveBeenNthCalledWith(2, expect.objectContaining({
            amount: 100,
            description: 'Pacote (2/3)',
            status: 'pending' // Future installments are pending
        }));
    });
});
