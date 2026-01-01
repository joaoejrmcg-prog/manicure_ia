-- ============================================
-- DIAGNOSTIC: Find Blocking Foreign Keys (Postgres System Catalogs)
-- ============================================
-- This query lists ALL tables that reference auth.users
-- and shows their ON DELETE behavior.
-- 'a' = NO ACTION / RESTRICT (Blocks deletion)
-- 'c' = CASCADE (Safe)
-- 'n' = SET NULL (Safe)

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION (BLOCKS DELETE)'
        WHEN 'r' THEN 'RESTRICT (BLOCKS DELETE)'
        WHEN 'c' THEN 'CASCADE (OK)'
        WHEN 'n' THEN 'SET NULL (OK)'
        WHEN 'd' THEN 'SET DEFAULT (OK)'
        ELSE confdeltype::text
    END AS on_delete_behavior
FROM
    pg_constraint
WHERE
    confrelid = 'auth.users'::regclass;
