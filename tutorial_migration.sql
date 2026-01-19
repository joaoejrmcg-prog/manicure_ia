-- =============================================
-- TUTORIAL: Adicionar coluna para controle de nível
-- =============================================

-- Adiciona coluna tutorial_level na tabela profiles
-- 0 = Não fez nenhum tutorial
-- 1 = Completou Nível 1
-- 2 = Completou Nível 2
-- 3 = Completou todos os níveis

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tutorial_level INTEGER DEFAULT 0;

-- Adiciona coluna para contar interações (para esconder botão de tutorial)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('tutorial_level', 'interaction_count');
