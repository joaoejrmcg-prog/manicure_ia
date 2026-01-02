require('dotenv').config({ path: '.env.local' });

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    console.error("Erro: Variáveis de ambiente ASAAS_API_URL ou ASAAS_API_KEY não encontradas em .env.local");
    process.exit(1);
}

async function createTestCustomer() {
    console.log("Tentando criar cliente de teste no Asaas...");
    console.log("URL:", ASAAS_API_URL);

    const customerData = {
        name: "Cliente Teste Script",
        email: "teste_script@example.com",
        mobilePhone: "11987654321", // Asaas validates phone format
        cpfCnpj: "12345678909", // CPF fictício válido para sandbox
        externalReference: "test_script_01"
    };

    try {
        const response = await fetch(`${ASAAS_API_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            },
            body: JSON.stringify(customerData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ Sucesso! Cliente criado.");
            console.log("ID do Cliente:", data.id);
            console.log("Nome:", data.name);
            console.log("\nAgora você pode verificar no painel do Asaas que a etapa de 'Criar Cliente' foi concluída.");
        } else {
            console.error("\n❌ Erro ao criar cliente:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("\n❌ Erro na requisição:", error.message);
    }
}

createTestCustomer();
