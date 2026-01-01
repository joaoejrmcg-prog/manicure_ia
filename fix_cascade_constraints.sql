-- ============================================
-- FIX: Add ON DELETE CASCADE to Business Tables
-- ============================================
-- This script fixes the "Database error deleting user" by ensuring
-- that all business tables automatically delete data when a user is deleted.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. CLIENTS
    -- Drop existing FKs
    FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'clients' AND constraint_type = 'FOREIGN KEY' LOOP
        EXECUTE 'ALTER TABLE clients DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    -- Add FK with CASCADE
    ALTER TABLE clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 2. APPOINTMENTS
    -- Drop existing FKs
    FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'appointments' AND constraint_type = 'FOREIGN KEY' LOOP
        EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    -- Add FK with CASCADE
    ALTER TABLE appointments ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 3. FINANCIAL_RECORDS
    -- Drop existing FKs
    FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'financial_records' AND constraint_type = 'FOREIGN KEY' LOOP
        EXECUTE 'ALTER TABLE financial_records DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    -- Add FK with CASCADE
    ALTER TABLE financial_records ADD CONSTRAINT financial_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 4. SUPPORT_MESSAGES
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'support_messages') THEN
        -- Drop existing FKs
        FOR r IN SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'support_messages' AND constraint_type = 'FOREIGN KEY' LOOP
            EXECUTE 'ALTER TABLE support_messages DROP CONSTRAINT ' || r.constraint_name;
        END LOOP;
        -- Add FK with CASCADE
        ALTER TABLE support_messages ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

END $$;
