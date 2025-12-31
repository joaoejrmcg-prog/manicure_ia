'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'neomercadoia@gmail.com';

async function getSupabase() {
    const cookieStore = await cookies();
    return createServerClient(
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
}

async function checkAdmin() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== ADMIN_EMAIL) {
        throw new Error("Unauthorized");
    }
    return supabase;
}

export async function getSupportMessages() {
    try {
        const supabase = await checkAdmin();

        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
}

export async function markAsReplied(id: string, replyText?: string) {
    try {
        const supabase = await checkAdmin();

        const updateData: any = { status: 'replied' };
        if (replyText) {
            updateData.admin_reply = replyText;
            updateData.replied_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('support_messages')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error updating message:", error);
        return { success: false };
    }
}

export async function getPendingCount() {
    try {
        const supabase = await checkAdmin();

        const { count, error } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) throw error;
        return count || 0;
    } catch (error) {
        // Silent fail for non-admins (e.g. sidebar check)
        return 0;
    }
}
