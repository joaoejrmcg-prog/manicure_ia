import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas';

const PLANS = {
    'light': { value: 19.90, name: 'Plano Light' },
    'pro': { value: 39.90, name: 'Plano Pro' },
};

export async function POST(req: NextRequest) {
    // Initialize Supabase Admin Client inside handler to avoid build errors if env is missing
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
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
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { plan, billingType } = body;

        if (!plan || !PLANS[plan as keyof typeof PLANS]) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const selectedPlan = PLANS[plan as keyof typeof PLANS];

        // 2. Get User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // 3. Create/Get Asaas Customer
        let asaasCustomerId = profile.asaas_customer_id;

        if (!asaasCustomerId) {
            console.log('Creating new Asaas customer...');
            const newCustomer = await createAsaasCustomer({
                name: profile.name || user.email || 'Cliente',
                email: user.email!,
                mobilePhone: profile.whatsapp,
                cpfCnpj: profile.cpf || '24971563792', // Test CPF if not provided
                externalReference: user.id
            });
            asaasCustomerId = newCustomer.id;

            // Update profile with Asaas ID
            await supabaseAdmin
                .from('profiles')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('user_id', user.id);
        } else {
            console.log('Reusing existing Asaas customer:', asaasCustomerId);
            // Update existing customer with CPF if needed
            try {
                await fetch(`${process.env.ASAAS_API_URL}/customers/${asaasCustomerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'access_token': process.env.ASAAS_API_KEY!
                    },
                    body: JSON.stringify({
                        cpfCnpj: profile.cpf || '24971563792'
                    })
                });
                console.log('Updated customer with CPF');
            } catch (err) {
                console.error('Error updating customer:', err);
            }
        }

        // 4. Create Subscription
        const today = new Date();
        const nextDueDate = today.toISOString().split('T')[0];

        const subscription = await createAsaasSubscription({
            customer: asaasCustomerId,
            billingType: billingType || 'UNDEFINED',
            value: selectedPlan.value,
            nextDueDate: nextDueDate,
            cycle: 'MONTHLY',
            description: `Assinatura ${selectedPlan.name}`,
            externalReference: user.id
        });

        // 5. Update Subscription in DB
        // Check if subscription exists
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (existingSub) {
            // If exists, update it. 
            // NOTE: In a real scenario, you might want to cancel the old Asaas subscription if the ID is different.
            // For now, we just update the record with the new subscription ID.
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    asaas_subscription_id: subscription.id,
                    plan: plan,
                    status: 'pending', // Reset status to pending until payment
                    current_period_end: null // Reset period
                })
                .eq('user_id', user.id);
        } else {
            await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    asaas_subscription_id: subscription.id,
                    plan: plan,
                    status: 'pending',
                });
        }

        return NextResponse.json({
            success: true,
            paymentUrl: subscription.invoiceUrl || subscription.bankSlipUrl
        });

    } catch (error: any) {
        console.error('Checkout Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
