"use client";

import { useEffect, useState } from "react";
import { DataManager } from "../lib/data-manager";
import { Appointment, FinancialRecord } from "../types";
import { CheckCircle2, Clock, DollarSign, Calendar } from "lucide-react";

type ActionItem = {
    type: 'appointment' | 'transaction';
    title: string;
    subtitle: string;
    displayDate: Date;
    createdAt: Date;
    amount?: number;
};

export default function ActionFeed() {
    const [lastAction, setLastAction] = useState<ActionItem | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [appointments, financials] = await Promise.all([
                DataManager.getAppointments(),
                DataManager.getFinancialSummary()
            ]);

            const items: ActionItem[] = [];

            // Process appointments
            appointments.forEach(app => {
                items.push({
                    type: 'appointment',
                    title: `Agendamento: ${app.description}`,
                    subtitle: app.client?.name || 'Cliente',
                    displayDate: new Date(app.date_time),
                    createdAt: new Date(app.created_at || app.date_time) // Fallback if created_at missing
                });
            });

            // Process financials
            financials.forEach(fin => {
                items.push({
                    type: 'transaction',
                    title: fin.type === 'income' ? 'Venda Registrada' : 'Despesa Registrada',
                    subtitle: `${fin.description} - ${fin.client?.name || ''}`,
                    displayDate: new Date(fin.created_at),
                    createdAt: new Date(fin.created_at),
                    amount: fin.amount
                });
            });

            // Sort by CREATED_AT desc (most recent action first)
            items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            if (items.length > 0) {
                setLastAction(items[0]);
            }
        } catch (error) {
            console.error("Error fetching actions:", error);
        } finally {
            setLoading(false);
        }
    };

    // Poll every 5 seconds to update the feed (simulating real-time)
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return null;
    if (!lastAction) return null;

    return (
        <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${lastAction.type === 'appointment' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-medium text-neutral-200">
                    Última Ação Confirmada
                </h4>
                <p className="text-xs text-neutral-400">
                    {lastAction.title} • {lastAction.subtitle}
                </p>
            </div>
            <div className="text-right">
                <span className="text-xs text-neutral-500 block">
                    {lastAction.displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {lastAction.amount && (
                    <span className="text-sm font-bold text-emerald-400">
                        R$ {lastAction.amount.toFixed(2)}
                    </span>
                )}
            </div>
        </div>
    );
}
