require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifyKeys() {
    console.log("🔍 Iniciando verificação de chaves...\n");

    // 1. Verificar Supabase Service Role Key
    console.log("1️⃣  Testando Supabase Service Role Key...");
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SERVICE_KEY) {
        console.error("❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local");
    } else {
        try {
            const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
            // Tenta buscar um usuário qualquer apenas para testar permissão de admin
            const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

            if (error) {
                console.error("❌ Erro no Supabase:", error.message);
            } else {
                console.log("✅ Supabase Service Role Key: FUNCIONANDO!");
            }
        } catch (e) {
            console.error("❌ Erro ao conectar Supabase:", e.message);
        }
    }

    console.log("\n---------------------------------------------------\n");

    // 2. Verificar Asaas API Key
    console.log("2️⃣  Testando Asaas API Key...");
    const ASAAS_URL = process.env.ASAAS_API_URL;
    const ASAAS_KEY = process.env.ASAAS_API_KEY;

    if (!ASAAS_KEY) {
        console.error("❌ ASAAS_API_KEY não encontrada no .env.local");
    } else {
        try {
            const response = await fetch(`${ASAAS_URL}/customers?limit=1`, {
                headers: {
                    'access_token': ASAAS_KEY
                }
            });

            if (response.ok) {
                console.log("✅ Asaas API Key: FUNCIONANDO!");
            } else {
                const err = await response.json();
                console.error("❌ Erro no Asaas:", JSON.stringify(err));
            }
        } catch (e) {
            console.error("❌ Erro ao conectar Asaas:", e.message);
        }
    }
}

verifyKeys();
