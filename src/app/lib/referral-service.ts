import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Processa a recompensa de indicação usando um cliente Supabase com privilégios de admin.
 * Esta função é projetada para ser usada em webhooks ou contextos de servidor seguro.
 * 
 * @param supabaseAdmin Cliente Supabase com service_role key
 * @param userId ID do usuário que acabou de realizar um pagamento qualificado
 */
export async function processReferralRewardAdmin(supabaseAdmin: SupabaseClient, userId: string) {
    console.log(`[REFERRAL SERVICE] Processing referral reward for user: ${userId}`);

    try {
        // A. Get Referrer
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('referred_by')
            .eq('user_id', userId)
            .single();

        if (profileError) {
            console.error('[REFERRAL SERVICE] Error fetching profile:', profileError);
            return { success: false, error: profileError };
        }

        if (profile?.referred_by) {
            const referrerId = profile.referred_by;

            // B. Check if already granted
            const { data: existing, error: existingError } = await supabaseAdmin
                .from('referral_rewards')
                .select('id')
                .eq('referrer_id', referrerId)
                .eq('referred_user_id', userId)
                .single();

            if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error('[REFERRAL SERVICE] Error checking existing rewards:', existingError);
                return { success: false, error: existingError };
            }

            if (!existing) {
                console.log(`[REFERRAL SERVICE] Granting reward to referrer ${referrerId}`);

                // C. Add 30 days to referrer subscription
                const { data: refSub, error: subError } = await supabaseAdmin
                    .from('subscriptions')
                    .select('current_period_end')
                    .eq('user_id', referrerId)
                    .single();

                if (subError) {
                    console.error('[REFERRAL SERVICE] Error fetching referrer subscription:', subError);
                    return { success: false, error: subError };
                }

                const currentEnd = new Date(refSub?.current_period_end || new Date());
                // If expired, start from now. If active, add to end.
                const now = new Date();
                const baseDate = currentEnd > now ? currentEnd : now;

                const newEnd = new Date(baseDate);
                newEnd.setDate(newEnd.getDate() + 30);

                const { error: updateError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({ current_period_end: newEnd.toISOString(), status: 'active' }) // Ensure active
                    .eq('user_id', referrerId);

                if (updateError) {
                    console.error('[REFERRAL SERVICE] Error updating subscription:', updateError);
                    return { success: false, error: updateError };
                }

                // D. Record Reward
                const { error: insertError } = await supabaseAdmin
                    .from('referral_rewards')
                    .insert({
                        referrer_id: referrerId,
                        referred_user_id: userId,
                        reward_days: 30,
                        reward_granted: true,
                        payment_confirmed_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error('[REFERRAL SERVICE] Error recording reward:', insertError);
                    return { success: false, error: insertError };
                }

                console.log('[REFERRAL SERVICE] Referral reward granted successfully.');
                return { success: true, granted: true };
            } else {
                console.log('[REFERRAL SERVICE] Reward already granted for this referral.');
                return { success: true, granted: false, reason: 'already_granted' };
            }
        } else {
            console.log('[REFERRAL SERVICE] User was not referred by anyone.');
            return { success: true, granted: false, reason: 'no_referrer' };
        }
    } catch (error) {
        console.error('[REFERRAL SERVICE] Unexpected error:', error);
        return { success: false, error };
    }
}
