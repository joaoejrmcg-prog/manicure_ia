'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { getSupportMessages, markAsReplied } from '../actions/admin';
import { Shield, Mail, CheckCircle, Clock, Search, RefreshCw } from 'lucide-react';

const ADMIN_EMAIL = 'neomercadoia@gmail.com';

type Message = {
    id: string;
    user_email: string;
    subject: string;
    message: string;
    status: 'pending' | 'replied';
    created_at: string;
};

export default function AdminPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending'>('all');
    const router = useRouter();

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.email !== ADMIN_EMAIL) {
                router.push('/');
                return;
            }
            fetchMessages();
        };
        checkAuth();
    }, []);

    const [replies, setReplies] = useState<{ [key: string]: string }>({});

    const fetchMessages = async () => {
        setLoading(true);
        const data = await getSupportMessages();
        setMessages(data as Message[]);
        setLoading(false);
    };

    const handleMarkReplied = async (id: string) => {
        const replyText = replies[id];
        await markAsReplied(id, replyText);
        setReplies(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        fetchMessages(); // Refresh
    };

    const handleReplyChange = (id: string, text: string) => {
        setReplies(prev => ({ ...prev, [id]: text }));
    };

    const filteredMessages = filter === 'all'
        ? messages
        : messages.filter(m => m.status === 'pending');

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-neutral-500">Carregando painel...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
                    <Shield className="text-red-500" />
                    Painel Administrativo
                </h1>
                <button
                    onClick={fetchMessages}
                    className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                    <RefreshCw className="w-5 h-5 text-neutral-400" />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Total de Mensagens</p>
                    <p className="text-3xl font-bold text-white">{messages.length}</p>
                </div>
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Pendentes</p>
                    <p className="text-3xl font-bold text-yellow-500">
                        {messages.filter(m => m.status === 'pending').length}
                    </p>
                </div>
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Respondidas</p>
                    <p className="text-3xl font-bold text-green-500">
                        {messages.filter(m => m.status === 'replied').length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                        }`}
                >
                    Todas
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'text-neutral-400 hover:text-white'
                        }`}
                >
                    Pendentes
                </button>
            </div>

            {/* Messages List */}
            <div className="space-y-4">
                {filteredMessages.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                        Nenhuma mensagem encontrada.
                    </div>
                ) : (
                    filteredMessages.map((msg) => (
                        <div key={msg.id} className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-2 h-2 rounded-full ${msg.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                            {msg.status === 'pending' ? 'Pendente' : 'Respondido'}
                                        </span>
                                        <span className="text-xs text-neutral-600">•</span>
                                        <span className="text-xs text-neutral-500">
                                            {new Date(msg.created_at).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-neutral-200">{msg.subject}</h3>
                                    <p className="text-sm text-blue-400 font-mono mt-1">{msg.user_email}</p>
                                </div>
                                {msg.status === 'pending' && (
                                    <button
                                        onClick={() => handleMarkReplied(msg.id)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Marcar como Respondido
                                    </button>
                                )}
                            </div>

                            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 text-neutral-300 whitespace-pre-wrap">
                                {msg.message}
                            </div>

                            {msg.status === 'pending' && (
                                <div className="mt-4 space-y-2">
                                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sua Resposta (In-App)</label>
                                    <textarea
                                        value={replies[msg.id] || ''}
                                        onChange={(e) => handleReplyChange(msg.id, e.target.value)}
                                        placeholder="Digite sua resposta aqui..."
                                        className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-600 min-h-[100px] text-sm"
                                    />
                                    <div className="flex justify-end gap-3">
                                        <a
                                            href={`mailto:${msg.user_email}?subject=Re: ${msg.subject}`}
                                            className="text-sm text-neutral-500 hover:text-white flex items-center gap-1 transition-colors px-3 py-1.5"
                                        >
                                            <Mail className="w-4 h-4" />
                                            Responder via Email
                                        </a>
                                        <button
                                            onClick={() => handleMarkReplied(msg.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Enviar Resposta In-App
                                        </button>
                                    </div>
                                </div>
                            )}

                            {msg.status === 'replied' && (
                                <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                    <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">Sua Resposta</p>
                                    <p className="text-sm text-neutral-300">{(msg as any).admin_reply || 'Marcado como respondido sem texto.'}</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
