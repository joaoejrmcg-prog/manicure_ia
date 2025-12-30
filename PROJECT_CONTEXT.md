# PROJETO: SaaS Gestor de Serviços via IA (AI-First)

## 🎯 OBJETIVO DO PROJETO
Criar uma aplicação SaaS B2C/B2B (Self-Service) para pequenos prestadores de serviço (manicures, eletricistas, pedreiros).
A interface principal é um **Chat via IA** que atua como uma secretária eficiente. O sistema deve ser extremamente simples, mobile-first (PWA) e gerido por comandos de voz/texto.

---

## 🛠️ TECH STACK (IMUTÁVEL)
- **Frontend:** Next.js (Foco em PWA/Mobile).
- **Voz (Input):** Web Speech API (Nativa do navegador via `window.webkitSpeechRecognition`) - **CUSTO ZERO**.
- **Backend/DB:** Supabase (Postgres, Auth, RLS, Edge Functions).
- **Pagamentos:** Integração Asaas (Pix/Assinatura) via Webhooks.
- **AI Core:** Integração LLM (OpenAI/Gemini) para processamento de intenção e extração de JSON.

---

## 🧠 FILOSOFIA DE DESENVOLVIMENTO
1.  **Backend Manda, Frontend Obedece:** Regras de negócio ficam no banco (RLS) ou Edge Functions, nunca no client-side.
2.  **Simplicidade Radical:** O usuário não quer configurar nada. Ele quer falar "Marquei a Maria" e pronto.
3.  **Segurança Silenciosa:** Multi-tenancy rigoroso. Um usuário NUNCA pode ver dados de outro.
4.  **Implementação em Camadas:** Não reescrever o que funciona. Adicionar funcionalidades (Pagamento, Confirmação) como "wrappers" ao redor do núcleo existente.

---

## 📱 FRONTEND & UX RULES
1.  **Voice-First (Custo Zero):**
    - Implementar um Hook React customizado (`useSpeechRecognition`).
    - Usar estritamente a API nativa do navegador.
    - O fluxo deve ser: Clicar Mic -> Falar -> Texto aparece no Input -> Usuário Confirma -> Envia.
    - Se o navegador não suportar, esconder o botão graciosamente.

---

## 🔒 REGRAS DE BANCO DE DADOS & SEGURANÇA (CRÍTICO)
1.  **Multi-Tenancy:**
    - TODAS as tabelas de dados do usuário (`services`, `clients`, etc.) DEVEM ter uma coluna `user_id`.
    - TODAS as queries e Policies RLS devem filtrar por `auth.uid()`.
2.  **Tabelas Core:**
    - `profiles`: Dados cadastrais (`whatsapp`, `referred_by`).
    - `subscriptions`: Controle de acesso (`status`, `current_period_end`, `access_level`).
    - `services`: Onde a IA grava os agendamentos.

---

## 🤖 COMPORTAMENTO DA IA (SYSTEM PROMPT RULES)
**Persona:** Secretária eficiente, educada, mas objetiva.
1.  **Validação de Ação (CONFIRMATION LOOP):**
    - Antes de executar qualquer `INSERT`, `UPDATE` ou `DELETE` no banco, a IA deve resumir a intenção e **pedir confirmação explícita**.
    - Exemplo: *"Entendi. Agendar [Serviço] para [Cliente] às [Horário]. Confirma?"*
    - Só executa após receber "Sim/Ok".
2.  **Zero Alucinação:**
    - Se faltar dado (ex: valor), PERGUNTE. Não invente.
    - Se o cliente não existe, pergunte se deve cadastrar.
3.  **Contexto Limitado:**
    - A IA foca em gestão. Se o usuário fugir do assunto (futebol, novela), traga de volta gentilmente para o trabalho.

---

## 💳 REGRAS DE NEGÓCIO: PLANOS & LIMITES

1.  **Tipos de Plano (`plan`):**
    -   `vip`: Amigos/Parceiros. Acesso Vitalício. **IA Ilimitada**.
    -   `pro`: Assinatura Premium. **IA Ilimitada**.
    -   `light`: Assinatura Básica. **IA Limitada (10/dia)**.
    -   `trial`: Período de testes (7 dias). **IA Ilimitada**.

2.  **Estados da Assinatura (`status`):**
    -   `active`: Pagamento em dia (ou VIP/Trial).
    -   `overdue`: Vencido. Bloqueio de novas ações após X dias.
    -   `canceled`: Cancelado. Acesso revogado.

3.  **Logica de Bloqueio (Tiered Blocking):**
    -   **1 dia atraso:** IA Bloqueada (Status: `overdue`).
    -   **> 7 dias atraso:** Bloqueio de Escrita (Read-Only).
    -   **Cancelado:** Bloqueio Total imediato.

4.  **Limites de Uso (IA):**
    -   `vip` / `pro` / `trial`: Ilimitado.
    -   `light`: 10 interações/dia.

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO (ORDEM DE EXECUÇÃO)

### FASE 1: Segurança & Auditoria ✅ COMPLETA
- [x] Auditar todas as funções existentes de DB para garantir `WHERE user_id = auth.uid()`.
- [x] Garantir que RLS esteja ativo no Supabase.

### FASE 2: Refinamento da IA (UX) ✅ COMPLETA
- [x] Implementar o "Confirmation Loop" no prompt do sistema (`CommandCenter.tsx` com `CONFIRMATION_REQUIRED`).
- [x] Criar Hook `useSpeechRecognition` (Web Speech API nativa do navegador).

### FASE 3: Camada de Pagamento (Sidecar) ✅ COMPLETA
- [x] Criar tabela `subscriptions` no Supabase.
- [x] Implementar lógica de verificação de planos e limites (`usage.ts`, `subscription.ts`).
- [x] Sistema de bloqueio baseado em status (overdue, canceled) e planos (vip, pro, light, trial).
- [ ] Implementar Webhook do Asaas (Edge Function) para renovar tempo automaticamente.

### FASE 4: Indicação (Growth) ✅ COMPLETA
- [x] Criar tabela `referral_rewards` para rastrear recompensas concedidas.
- [x] Implementar Server Actions para processar recompensas (`referral.ts`).
- [x] Atualizar UI da página `/indique` para mostrar indicados pagantes vs cadastrados.
- [x] Criar painel admin para confirmar primeiro pagamento manualmente (MVP).
- [ ] Implementar Webhook do Asaas para automação completa (Futuro).
