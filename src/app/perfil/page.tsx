import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Zap, LogOut, CreditCard, Gift } from 'lucide-react';
import { getUserProfile, getSubscriptionDetails } from '../actions/profile';
import { getPlanDisplayName } from '../utils/plans';
import SubscriptionBadge from '../components/SubscriptionBadge';
import CancelSubscription from './CancelSubscription';

export default async function PerfilPage() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const profile = await getUserProfile();
    const subscription = await getSubscriptionDetails();

    if (!profile || !subscription) {
        return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
    }

    const handleLogout = async () => {
        'use server';
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) { }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) { }
                    },
                },
            }
        );
        await supabase.auth.signOut();
        redirect('/login');
    };

    return (
        <div className="min-h-screen bg-neutral-950 p-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/" className="text-neutral-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-neutral-100">Meu Perfil</h1>
                </div>

                {/* Card Principal - Assinatura */}
                <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
                    <h2 className="text-lg font-semibold text-neutral-200 mb-4">Assinatura</h2>

                    <SubscriptionBadge plan={profile.plan} status={profile.status} />

                    <div className="mt-6 space-y-4">
                        {/* Vencimento */}
                        <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-500" size={20} />
                                <div>
                                    <p className="text-sm text-neutral-400">Vencimento</p>
                                    <p className="font-semibold text-neutral-200">
                                        {subscription.isLifetime
                                            ? '♾️ Vitalício'
                                            : new Date(subscription.currentPeriodEnd!).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                            {!subscription.isLifetime && subscription.daysRemaining !== null && (
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-blue-500">{subscription.daysRemaining}</p>
                                    <p className="text-xs text-neutral-400">dias restantes</p>
                                </div>
                            )}
                        </div>

                        {/* Limite IA */}
                        <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl">
                            <Zap className="text-yellow-500" size={20} />
                            <div>
                                <p className="text-sm text-neutral-400">Uso da IA</p>
                                <p className="font-semibold text-neutral-200">{subscription.aiLimit}</p>
                            </div>
                        </div>
                    </div>


                    {/* Cancelamento (apenas se não for trial/vitalício e estiver ativo) */}
                    {!subscription.isLifetime && profile.plan !== 'trial' && subscription.isActive && (
                        <div className="mt-4 pt-4 border-t border-neutral-800 flex justify-center">
                            <CancelSubscription currentPeriodEnd={subscription.currentPeriodEnd} />
                        </div>
                    )}
                </div>

                {/* Grid de Ações */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Link
                        href="/planos"
                        className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 hover:border-blue-500/50 transition-all duration-200 flex flex-col items-center gap-2 text-center group"
                    >
                        <CreditCard className="text-blue-500 group-hover:scale-110 transition-transform" size={32} />
                        <span className="font-semibold text-neutral-200">Mudar Plano</span>
                    </Link>

                    <Link
                        href="/indique"
                        className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 transition-all duration-200 flex flex-col items-center gap-2 text-center text-white group"
                    >
                        <Gift className="group-hover:scale-110 transition-transform" size={32} />
                        <span className="font-semibold">Indicar Amigos</span>
                    </Link>
                </div>

                {/* Informações do Usuário */}
                {profile.whatsapp && (
                    <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
                        <h2 className="text-lg font-semibold text-neutral-200 mb-4">Informações</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-neutral-400">WhatsApp</p>
                                <p className="font-medium text-neutral-200">{profile.whatsapp}</p>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}
