import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Gift, Users, CheckCircle2, Clock } from 'lucide-react';
import CopyButton from './CopyButton';
import { getReferralStats } from '../actions/referral';

export default async function IndiquePage() {
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

    // Fetch Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .single();

    // Fetch Stats usando nova função
    const stats = await getReferralStats();

    const referralCode = profile?.referral_code || '---';
    const referralCount = stats?.totalReferred || 0;
    const paidReferrals = stats?.paidReferred || 0;
    const earnedDays = stats?.earnedDays || 0;

    const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://manicure-ia.vercel.app'}/login?ref=${referralCode}`;


    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 p-6 text-white text-center relative">
                    <Link href="/agenda" className="absolute left-4 top-6 text-white/80 hover:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <Gift size={48} className="mx-auto mb-2 opacity-90" />
                    <h1 className="text-2xl font-bold">Indique e Ganhe</h1>
                    <p className="text-blue-100 text-sm mt-1">
                        Ganhe 30 dias de acesso VIP para cada amigo que assinar!
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 p-6 border-b border-gray-100">
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <Users className="mx-auto text-blue-500 mb-2" size={24} />
                        <div className="text-2xl font-bold text-gray-800">{referralCount}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Indicados</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                        <CheckCircle2 className="mx-auto text-green-500 mb-2" size={24} />
                        <div className="text-2xl font-bold text-gray-800">{paidReferrals}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Pagantes</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <Gift className="mx-auto text-blue-500 mb-2" size={24} />
                        <div className="text-2xl font-bold text-gray-800">{earnedDays}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Dias Ganhos</div>
                    </div>
                </div>

                {/* Link Section */}
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Seu Link de Indicação
                        </label>
                        <div className="space-y-3">
                            <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600 truncate font-mono border border-gray-200">
                                {referralLink}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <CopyButton text={referralLink} />
                                <a
                                    href={`https://wa.me/?text=${encodeURIComponent(`Olá! 👋\n\nEstou usando essa IA incrível para gerenciar meu negócio. 🚀\n\nSe cadastre usando meu link e ganhe benefícios:\n${referralLink}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-600 transition-all duration-200 active:scale-95"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    WhatsApp
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">?</span>
                            Como funciona?
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-2 pl-2">
                            <li>1. Copie seu link exclusivo acima.</li>
                            <li>2. Envie para seus amigos no WhatsApp.</li>
                            <li>3. Quando eles pagarem a 1ª mensalidade, você ganha <strong>30 dias grátis</strong> automaticamente!</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
