-- Safe cleanup of legacy locations artifacts
-- This migration is idempotent and safe to run multiple times

PRAGMA foreign_keys = OFF;

-- Drop legacy view used for backward compatibility
DROP VIEW IF EXISTS locations_view;

-- Drop legacy locations table if present
DROP TABLE IF EXISTS locations;

PRAGMA foreign_keys = ON;
