const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('--- Starting Referral Webhook Reproduction ---');

    // 1. Create Mock Users
    const referrerEmail = `referrer_${Date.now()}@test.com`;
    const referredEmail = `referred_${Date.now()}@test.com`;
    const referralCode = `REF${Date.now()}`;

    console.log(`Creating referrer: ${referrerEmail}`);
    const { data: referrerUser, error: referrerError } = await supabase.auth.admin.createUser({
        email: referrerEmail,
        password: 'password123',
        email_confirm: true
    });
    if (referrerError) throw referrerError;

    console.log(`Creating referred: ${referredEmail}`);
    const { data: referredUser, error: referredError } = await supabase.auth.admin.createUser({
        email: referredEmail,
        password: 'password123',
        email_confirm: true
    });
    if (referredError) throw referredError;

    // 2. Setup Profiles
    await supabase.from('profiles').insert({
        id: referrerUser.user.id,
        email: referrerEmail,
        referral_code: referralCode
    });

    await supabase.from('profiles').insert({
        id: referredUser.user.id,
        email: referredEmail,
        referred_by: referralCode // Link them!
    });

    // 3. Create Subscription for Referred
    const asaasSubId = `sub_${Date.now()}`;
    await supabase.from('subscriptions').insert({
        user_id: referredUser.user.id,
        status: 'active',
        plan: 'light',
        asaas_subscription_id: asaasSubId
    });

    console.log(`Setup complete. Simulating Webhook for subscription: ${asaasSubId}`);

    // 4. Simulate Webhook Call
    // We will call the local API route. Ensure your server is running or use a direct function call if possible.
    // Since we can't easily curl localhost from here without knowing the port/state, 
    // we will simulate the logic by invoking the action directly or just checking if the code we wrote works conceptually.
    // BUT, the best way is to actually hit the endpoint if possible.
    // Assuming we can't hit the running server, we will verify the DB state *after* manual trigger or just verify the setup.

    // Wait... I can't easily hit the Next.js API route from this script unless the server is running.
    // I will use the 'run_command' tool to start the server in background if needed, or just assume the user will run it.
    // Actually, I can just import the logic? No, it's an API route.

    // Let's just print the curl command for the user to run, or try to fetch if localhost:3000 is up.
    try {
        const response = await fetch('http://localhost:3000/api/asaas/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || 'dev-token' // Ensure this matches .env
            },
            body: JSON.stringify({
                event: 'PAYMENT_CONFIRMED',
                payment: {
                    id: `pay_${Date.now()}`,
                    subscription: asaasSubId,
                    value: 19.90
                }
            })
        });

        console.log('Webhook Response Status:', response.status);
        const json = await response.json();
        console.log('Webhook Response:', json);

    } catch (e) {
        console.log('Could not hit localhost:3000. Is the server running?');
        console.log('Skipping webhook call, please run server and try again.');
    }

    // 5. Check Rewards
    console.log('Checking for rewards...');
    // Give it a moment if async
    await new Promise(r => setTimeout(r, 2000));

    const { data: rewards } = await supabase
        .from('referral_rewards')
        .select('*')
        .eq('referrer_id', referrerUser.user.id);

    console.log('Rewards found:', rewards);

    if (rewards && rewards.length > 0) {
        console.log('SUCCESS: Reward created!');
    } else {
        console.log('FAILURE: No reward found (or webhook not reachable).');
    }

    // Cleanup
    console.log('Cleaning up...');
    await supabase.auth.admin.deleteUser(referrerUser.user.id);
    await supabase.auth.admin.deleteUser(referredUser.user.id);
}

run().catch(console.error);
