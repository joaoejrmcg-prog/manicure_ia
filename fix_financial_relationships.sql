-- ============================================
-- FIX: Establish Relationship between Financial Records and Clients
-- ============================================

-- This script forces the creation of the foreign key relationship
-- which is required for the join query (client:clients) to work.
-- This was likely removed by the previous cascade fix script.

DO $$
BEGIN
    -- 1. Ensure client_id column exists in financial_records
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'financial_records' AND column_name = 'client_id') THEN
        ALTER TABLE financial_records ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    ELSE
        -- 2. If column exists, check if the Foreign Key constraint exists
        -- We try to drop it first to ensure we have the correct one
        BEGIN
            ALTER TABLE financial_records DROP CONSTRAINT IF EXISTS financial_records_client_id_fkey;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if constraint doesn't exist
        END;

        -- Add the constraint explicitly
        -- For financial records, we usually want SET NULL or CASCADE depending on business logic.
        -- If a client is deleted, we might want to keep the financial record but lose the client link (SET NULL),
        -- or delete the record (CASCADE). Given the previous "fix_remaining_cascades" context, 
        -- the user seems to prefer CASCADE to avoid blocking deletion, but for financial data SET NULL is often safer.
        -- However, to be consistent with "clean up everything when user is deleted", 
        -- and if the client is deleted, maybe we should keep the record? 
        -- Let's use SET NULL for client deletion to preserve financial history if possible, 
        -- BUT if the requirement is "allow deletion without errors", SET NULL works fine too.
        
        ALTER TABLE financial_records 
        ADD CONSTRAINT financial_records_client_id_fkey 
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON DELETE SET NULL;
    END IF;

    -- 3. Ensure index exists for performance
    CREATE INDEX IF NOT EXISTS idx_financial_records_client_id ON financial_records(client_id);

END $$;
