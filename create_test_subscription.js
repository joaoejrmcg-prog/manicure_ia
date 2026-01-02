require('dotenv').config({ path: '.env.local' });

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
// ID do cliente criado no passo anterior
const CUSTOMER_ID = 'cus_000007360004';

if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    console.error("Erro: Variáveis de ambiente não encontradas.");
    process.exit(1);
}

async function createTestSubscription() {
    console.log("Tentando criar assinatura de teste (Cobrança) no Asaas...");

    // Dados da assinatura (Simulando um Plano PRO)
    const subscriptionData = {
        customer: CUSTOMER_ID,
        billingType: "PIX", // Preferência do usuário
        value: 39.90,
        nextDueDate: new Date().toISOString().split('T')[0], // Vence hoje
        cycle: "MONTHLY",
        description: "Assinatura Teste Manicure IA - Plano PRO"
    };

    try {
        const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            },
            body: JSON.stringify(subscriptionData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ Sucesso! Assinatura (Cobrança) criada.");
            console.log("ID da Assinatura:", data.id);
            console.log("Valor:", data.value);
            console.log("Ciclo:", data.cycle);
            console.log("\nAgora verifique no painel do Asaas se a etapa 'Criar cobrança' foi concluída.");
        } else {
            console.error("\n❌ Erro ao criar assinatura:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("\n❌ Erro na requisição:", error.message);
    }
}

createTestSubscription();
