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
            // Calculate new period end (same day next month)
            const paymentDate = new Date(payment.paymentDate || payment.dateCreated);
            const newPeriodEnd = new Date(paymentDate);
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1); // Add 1 month (keeps same day)

            // DEBUG: Check if subscription exists
            const { data: subCheck, error: checkError } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, status')
                .eq('asaas_subscription_id', subscriptionId)
                .single();

            console.log('DB Check Result:', subCheck, 'Error:', checkError);

            if (!subCheck) {
                console.error(`Subscription not found in DB for Asaas ID: ${subscriptionId}`);
                return NextResponse.json({ received: true, warning: 'Subscription not found' });
            }

            // Update subscription
            const { error } = await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'active',
                    current_period_end: newPeriodEnd.toISOString()
                })
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
