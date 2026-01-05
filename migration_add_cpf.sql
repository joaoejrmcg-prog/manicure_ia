-- ============================================
-- Migration: Adicionar CPF à tabela profiles
-- ============================================
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna cpf
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Adicionar constraint UNIQUE para evitar CPFs duplicados
ALTER TABLE profiles
ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);

-- Adicionar constraint para validar formato (apenas números, 11 dígitos)
ALTER TABLE profiles
ADD CONSTRAINT profiles_cpf_format 
CHECK (cpf IS NULL OR (cpf ~ '^\d{11}$'));

-- Criar index para performance de busca
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf);

-- Comentário para documentação
COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário (apenas números, 11 dígitos). Imutável após cadastrado.';

-- ============================================
-- Verificação
-- ============================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'cpf';
