import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    // 🔒 CRITICAL SECURITY: Validate webhook token
    const incomingToken = req.headers.get('asaas-access-token');
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    if (!expectedToken) {
        console.error('[WEBHOOK SECURITY] ASAAS_WEBHOOK_TOKEN not configured!');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!incomingToken || incomingToken !== expectedToken) {
        console.error('[WEBHOOK SECURITY] Unauthorized webhook attempt detected!', {
            hasToken: !!incomingToken,
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString()
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WEBHOOK SECURITY] Token validated successfully ✓');

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    try {
        const body = await req.json();
        const { event, payment } = body;

        console.log(`Received Asaas Webhook: ${event}`, payment?.id);

        if (!payment || !payment.subscription) {
            // Not a subscription payment or invalid payload
            return NextResponse.json({ received: true });
        }

        const subscriptionId = payment.subscription;
        console.log(`Processing Webhook for Subscription ID: ${subscriptionId}`);

        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {

            // CHECK FOR PRO-RATA UPGRADE
            if (payment.externalReference && payment.externalReference.startsWith('UPGRADE|')) {
                console.log('[WEBHOOK] Pro-rata upgrade payment confirmed:', payment.externalReference);
                const parts = payment.externalReference.split('|');
                const userId = parts[1];
                const newPlan = parts[2];

                if (userId && newPlan) {
                    // 1. Get current subscription
                    const { data: currentSub } = await supabaseAdmin
                        .from('subscriptions')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (currentSub && currentSub.asaas_subscription_id) {
                        // 2. Update Asaas Subscription Value
                        const { updateAsaasSubscription } = await import('@/lib/asaas');
                        const PLANS = { 'light': 19.90, 'pro': 39.90 };
                        const newValue = PLANS[newPlan as keyof typeof PLANS];

                        if (newValue) {
                            await updateAsaasSubscription(currentSub.asaas_subscription_id, {
                                value: newValue,
                                description: `Assinatura Plano ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`,
                                updatePendingPayments: true
                            });
                            console.log('[WEBHOOK] Asaas subscription updated to new plan value.');
                        }

                        // 3. Update DB
                        const { error: updateError } = await supabaseAdmin
                            .from('subscriptions')
                            .update({
                                plan: newPlan,
                                status: 'active'
                            })
                            .eq('user_id', userId);

                        if (updateError) console.error('Failed to update DB for upgrade:', updateError);
                        else console.log('[WEBHOOK] DB updated to new plan.');

                        return NextResponse.json({ received: true, message: 'Upgrade processed' });
                    }
                }
            }

            if (!payment.subscription) {
                // Not a subscription payment (and not a handled upgrade)
                return NextResponse.json({ received: true });
            }

            const subscriptionId = payment.subscription;

            // 1. Fetch current subscription to determine base date
            const { data: currentSub, error: fetchError } = await supabaseAdmin
                .from('subscriptions')
                .select('current_period_end, status')
                .eq('asaas_subscription_id', subscriptionId)
                .single();

            if (fetchError || !currentSub) {
                console.error(`Subscription not found in DB for Asaas ID: ${subscriptionId}`);
                return NextResponse.json({ received: true, warning: 'Subscription not found' });
            }

            // 2. Calculate new period end
            // Logic: New End = MAX(Current End, Now) + 1 Month
            const now = new Date();
            const currentEnd = currentSub.current_period_end ? new Date(currentSub.current_period_end) : new Date(0);

            // If subscription is expired (end < now), start from now. If active (end > now), start from end.
            const baseDate = currentEnd > now ? currentEnd : now;

            const newPeriodEnd = new Date(baseDate);
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

            console.log('--- WEBHOOK DATE DEBUG ---');
            console.log('Now:', now.toISOString());
            console.log('Current End (DB):', currentEnd.toISOString());
            console.log('Base Date (Selected):', baseDate.toISOString());
            console.log('New Period End (Calculated):', newPeriodEnd.toISOString());
            console.log('--------------------------');

            console.log(`[WEBHOOK] Extending subscription. Base: ${baseDate.toISOString()}, New End: ${newPeriodEnd.toISOString()}`);

            // Determine plan based on payment value
            let planName = undefined;
            if (payment.value) {
                if (payment.value === 19.90) planName = 'light';
                else if (payment.value === 39.90) planName = 'pro';
            }

            // 3. Update subscription
            const updateData: any = {
                status: 'active',
                current_period_end: newPeriodEnd.toISOString()
            };

            if (planName) {
                updateData.plan = planName;
                console.log(`[WEBHOOK] Updating plan to ${planName} based on payment value ${payment.value}`);
            }

            const { error } = await supabaseAdmin
                .from('subscriptions')
                .update(updateData)
                .eq('asaas_subscription_id', subscriptionId);

            if (error) {
                console.error('Error updating subscription:', error);
                return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
            }
            console.log('Subscription updated successfully.');
        } else if (event === 'PAYMENT_OVERDUE') {
            await supabaseAdmin
                .from('subscriptions')
                .update({ status: 'overdue' })
                .eq('asaas_subscription_id', subscriptionId);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            stack: error.stack
        }, { status: 500 });
    }
}
