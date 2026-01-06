require('dotenv').config({ path: '.env.local' });

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    console.error("Erro: Variáveis de ambiente não encontradas.");
    process.exit(1);
}

// ID do cliente no Asaas (você pode pegar isso no seu banco de dados ou no painel do Asaas)
// Se não souber, o script pode listar clientes pelo email.
const TARGET_EMAIL = 'jaimerodriguesjunior@hotmail.com';

async function cleanupSubscriptions() {
    console.log(`--- Iniciando limpeza para ${TARGET_EMAIL} ---`);

    try {
        // 1. Encontrar Cliente
        console.log(`Buscando cliente por email: ${TARGET_EMAIL}...`);
        const customerRes = await fetch(`${ASAAS_API_URL}/customers?email=${TARGET_EMAIL}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const customerData = await customerRes.json();

        if (!customerData.data || customerData.data.length === 0) {
            console.log("Cliente não encontrado.");
            return;
        }

        const customerId = customerData.data[0].id;
        console.log(`Cliente encontrado: ${customerId} (${customerData.data[0].name})`);

        // 2. Listar Assinaturas
        console.log("Listando assinaturas...");
        const subsRes = await fetch(`${ASAAS_API_URL}/subscriptions?customer=${customerId}&limit=100`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const subsData = await subsRes.json();

        if (!subsData.data || subsData.data.length === 0) {
            console.log("Nenhuma assinatura encontrada.");
            return;
        }

        console.log(`Encontradas ${subsData.data.length} assinaturas.`);

        // 3. Deletar Assinaturas (exceto a última/ativa se quiser manter)
        // Como o usuário quer limpar tudo para recomeçar, vamos deletar tudo.
        for (const sub of subsData.data) {
            console.log(`Deletando assinatura ${sub.id} (${sub.description} - ${sub.value})...`);
            const delRes = await fetch(`${ASAAS_API_URL}/subscriptions/${sub.id}`, {
                method: 'DELETE',
                headers: { 'access_token': ASAAS_API_KEY }
            });

            if (delRes.ok) {
                console.log(`✅ Assinatura ${sub.id} removida.`);
            } else {
                const err = await delRes.json();
                console.error(`❌ Erro ao remover ${sub.id}:`, err);
            }
        }

        console.log("--- Limpeza concluída ---");

    } catch (error) {
        console.error("Erro fatal:", error);
    }
}

cleanupSubscriptions();
