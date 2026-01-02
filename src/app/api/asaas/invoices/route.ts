import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

        // 2. Get User Profile to find Asaas Customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('asaas_customer_id')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile?.asaas_customer_id) {
            // User has no Asaas customer ID, so no invoices
            return NextResponse.json({ invoices: [] });
        }

        // 3. Fetch Pending and Overdue Invoices from Asaas
        // Asaas allows filtering by multiple statuses
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

        return NextResponse.json({ invoices });

    } catch (error: any) {
        console.error('Invoices API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
