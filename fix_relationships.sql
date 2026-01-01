-- ============================================
-- FIX: Establish Relationship between Appointments and Clients
-- ============================================

-- This script forces the creation of the foreign key relationship
-- which is required for the join query (client:clients) to work.

DO $$
BEGIN
    -- 1. Ensure client_id column exists in appointments
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'client_id') THEN
        ALTER TABLE appointments ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
    ELSE
        -- 2. If column exists, check if the Foreign Key constraint exists
        -- We try to drop it first to ensure we have the correct one (CASCADE)
        BEGIN
            ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if constraint doesn't exist
        END;

        -- Add the constraint explicitly
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_client_id_fkey 
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON DELETE CASCADE;
    END IF;

    -- 3. Ensure index exists for performance
    CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);

END $$;
