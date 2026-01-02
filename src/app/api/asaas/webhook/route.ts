import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
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

        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            // Calculate new period end (30 days from now or from payment date)
            const paymentDate = new Date(payment.paymentDate || payment.dateCreated);
            const newPeriodEnd = new Date(paymentDate);
            newPeriodEnd.setDate(newPeriodEnd.getDate() + 30); // Add 30 days

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
