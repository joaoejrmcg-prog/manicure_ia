import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAsaasSubscription } from '@/lib/asaas';

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

export async function GET(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get User Profile and Subscription
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('asaas_customer_id')
            .eq('user_id', user.id)
            .single();

        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile?.asaas_customer_id) {
            return NextResponse.json({ invoices: [] });
        }

        // 3. SYNC LOGIC: Check Asaas Subscription Status
        if (subscription?.asaas_subscription_id) {
            try {
                const asaasSub = await getAsaasSubscription(subscription.asaas_subscription_id);

                if (asaasSub && asaasSub.status === 'ACTIVE' && subscription.status !== 'active') {
                    console.log(`[SYNC] Updating subscription ${subscription.id} to ACTIVE based on Asaas status.`);

                    // Calculate period end (30 days from nextDueDate or today)
                    const nextDue = new Date(asaasSub.nextDueDate);
                    // If active, usually nextDueDate is in the future. 
                    // But if it just activated, nextDueDate might be next month.
                    // Let's rely on nextDueDate as the end of the current paid period? 
                    // Actually, nextDueDate is when the NEXT payment is due. So the current period ends there.

                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            status: 'active',
                            current_period_end: nextDue.toISOString()
                        })
                        .eq('id', subscription.id);
                }
            } catch (syncError) {
                console.error('[SYNC] Error syncing subscription:', syncError);
            }
        }

        // 4. Fetch Pending and Overdue Invoices from Asaas
        const response = await fetch(`${ASAAS_API_URL}/payments?customer=${profile.asaas_customer_id}&status=PENDING,OVERDUE&limit=10`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY!
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch invoices from Asaas:', await response.text());
            return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
        }

        const data = await response.json();

        // Return simplified invoice data
        const invoices = data.data.map((invoice: any) => ({
            id: invoice.id,
            value: invoice.value,
            description: invoice.description,
            dueDate: invoice.dueDate,
            invoiceUrl: invoice.invoiceUrl,
            billingType: invoice.billingType,
            status: invoice.status
        }));

        // Fetch the potentially updated subscription to return its status
        const { data: updatedSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('status')
            .eq('user_id', user.id)
            .single();

        return NextResponse.json({
            invoices,
            subscriptionStatus: updatedSubscription?.status
        });

    } catch (error: any) {
        console.error('Invoices API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
