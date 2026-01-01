-- ============================================
-- FIX: Add ON DELETE CASCADE to Remaining Tables
-- ============================================
-- This script fixes the remaining blocking tables identified by the diagnostic:
-- 1. daily_usage
-- 2. subscriptions

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. DAILY_USAGE
    -- Drop existing FKs
    FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'daily_usage' AND constraint_type = 'FOREIGN KEY' LOOP
        EXECUTE 'ALTER TABLE daily_usage DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    -- Add FK with CASCADE
    ALTER TABLE daily_usage ADD CONSTRAINT daily_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 2. SUBSCRIPTIONS
    -- Drop existing FKs
    FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'subscriptions' AND constraint_type = 'FOREIGN KEY' LOOP
        EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    -- Add FK with CASCADE
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

END $$;
