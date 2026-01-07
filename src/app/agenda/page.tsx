"use client";

import { useState, useEffect } from "react";
import { DataManager } from "../lib/data-manager";
import { Appointment, Client } from "../types";
import { Plus, ChevronLeft, ChevronRight, X, Save, Clock, User, Calendar as CalendarIcon, Edit2, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function AgendaPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

    // Form State
    const [formData, setFormData] = useState<{
        client_id: string;
        date: string;
        time: string;
        description: string;
    }>({
        client_id: "",
        date: "",
        time: "",
        description: ""
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Get date range: 1 month before to 3 months ahead to include recurring appointments
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setDate(1);
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 3);
            endDate.setDate(0); // Last day of the month

            const [appointmentsData, clientsData] = await Promise.all([
                DataManager.getExpandedAppointments(startDate, endDate),
                DataManager.getClients()
            ]);
            setAppointments(appointmentsData);
            setClients(clientsData);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Calendar Logic
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        return { days, firstDay };
    };

    const { days, firstDay } = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDayClick = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDay(date);
        setIsModalOpen(true);
    };

    const getAppointmentsForDay = (day: number) => {
        return appointments.filter(app => {
            const appDate = new Date(app.date_time);
            return appDate.getDate() === day &&
                appDate.getMonth() === currentDate.getMonth() &&
                appDate.getFullYear() === currentDate.getFullYear();
        });
    };

    const getAppointmentsForPeriod = (dayAppointments: Appointment[], period: 'morning' | 'afternoon' | 'night') => {
        return dayAppointments.filter(app => {
            const hour = new Date(app.date_time).getHours();
            if (period === 'morning') return hour < 12;
            if (period === 'afternoon') return hour >= 12 && hour < 18;
            return hour >= 18;
        });
    };

    // Form Handlers
    const handleOpenForm = (appointment?: Appointment) => {
        if (appointment) {
            const dateObj = new Date(appointment.date_time);
            setEditingAppointment(appointment);
            setFormData({
                client_id: appointment.client_id,
                date: dateObj.toISOString().split('T')[0],
                time: dateObj.toTimeString().slice(0, 5),
                description: appointment.description
            });
        } else {
            setEditingAppointment(null);
            setFormData({
                client_id: "",
                date: selectedDay ? selectedDay.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                time: "09:00",
                description: ""
            });
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingAppointment(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dateTime = new Date(`${formData.date}T${formData.time}:00`);

            if (editingAppointment) {
                await DataManager.updateAppointment(editingAppointment.id, {
                    client_id: formData.client_id,
                    date_time: dateTime.toISOString(),
                    description: formData.description
                });
            } else {
                await DataManager.addAppointment(
                    formData.client_id,
                    dateTime,
                    formData.description
                );
            }
            await loadData();
            handleCloseForm();
        } catch (error) {
            console.error("Erro ao salvar agendamento:", error);
            alert("Erro ao salvar agendamento.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este agendamento?")) {
            try {
                await DataManager.cancelAppointment(id);
                await loadData();
                // If deleting from modal list, update list locally or re-fetch
                // loadData handles re-fetch
            } catch (error) {
                console.error("Erro ao excluir agendamento:", error);
                alert("Erro ao excluir agendamento.");
            }
        }
    };

    const selectedDayAppointments = selectedDay ? appointments.filter(app => {
        const appDate = new Date(app.date_time);
        return appDate.getDate() === selectedDay.getDate() &&
            appDate.getMonth() === selectedDay.getMonth() &&
            appDate.getFullYear() === selectedDay.getFullYear();
    }).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()) : [];

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-100">Agenda</h1>
                    <p className="text-neutral-400 text-sm">Gerencie seus compromissos</p>
                </div>
                <div className="flex items-center gap-4 bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-neutral-200 font-medium min-w-[150px] text-center capitalize">{monthName}</span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-950/50">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="py-3 text-center text-sm font-medium text-neutral-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 auto-rows-fr">
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[120px] bg-neutral-950/30 border-r border-b border-neutral-800/50" />
                    ))}

                    {Array.from({ length: days }).map((_, i) => {
                        const day = i + 1;
                        const dayApps = getAppointmentsForDay(day);
                        const morningApps = getAppointmentsForPeriod(dayApps, 'morning');
                        const afternoonApps = getAppointmentsForPeriod(dayApps, 'afternoon');
                        const nightApps = getAppointmentsForPeriod(dayApps, 'night');
                        const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

                        return (
                            <div
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={cn(
                                    "min-h-[120px] border-r border-b border-neutral-800 p-2 cursor-pointer transition-colors hover:bg-neutral-800/50 relative group",
                                    isToday && "bg-blue-900/10"
                                )}
                            >
                                <span className={cn(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-2",
                                    isToday ? "bg-blue-600 text-white" : "text-neutral-400 group-hover:text-neutral-200"
                                )}>
                                    {day}
                                </span>

                                <div className="space-y-1">
                                    {/* Morning Slot */}
                                    {morningApps.length > 0 && (
                                        <div className="h-6 rounded flex items-center justify-center px-1 bg-yellow-500/20 text-yellow-500">
                                            <span className="text-[10px] uppercase tracking-wide font-bold">Manhã</span>
                                        </div>
                                    )}

                                    {/* Afternoon Slot */}
                                    {afternoonApps.length > 0 && (
                                        <div className="h-6 rounded flex items-center justify-center px-1 bg-orange-500/20 text-orange-500">
                                            <span className="text-[10px] uppercase tracking-wide font-bold">Tarde</span>
                                        </div>
                                    )}

                                    {/* Night Slot */}
                                    {nightApps.length > 0 && (
                                        <div className="h-6 rounded flex items-center justify-center px-1 bg-indigo-500/20 text-indigo-400">
                                            <span className="text-[10px] uppercase tracking-wide font-bold">Noite</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day Details Modal */}
            {isModalOpen && selectedDay && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                            <div>
                                <h2 className="text-lg font-semibold text-neutral-200">
                                    {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h2>
                                <p className="text-sm text-neutral-500">{selectedDayAppointments.length} agendamentos</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                            {selectedDayAppointments.length === 0 ? (
                                <div className="text-center py-12 text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                                    Nenhum agendamento para este dia.
                                </div>
                            ) : (
                                selectedDayAppointments.map(app => (
                                    <div key={app.id} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-lg">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-neutral-200">
                                                    {new Date(app.date_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-sm text-neutral-400">{app.client?.name} - {app.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenForm(app)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-blue-400">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(app.id)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-400">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 rounded-b-2xl">
                            <button
                                onClick={() => handleOpenForm()}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Novo Agendamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                            <h2 className="text-lg font-semibold text-neutral-200">
                                {editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}
                            </h2>
                            <button onClick={handleCloseForm} className="text-neutral-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Cliente</label>
                                <select
                                    required
                                    value={formData.client_id}
                                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none"
                                >
                                    <option value="">Selecione...</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase">Data</label>
                                    <input
                                        required
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase">Hora</label>
                                    <input
                                        required
                                        type="time"
                                        value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-500 uppercase">Serviço / Descrição</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Corte de cabelo, Instalação elétrica"
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Agendamento
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
