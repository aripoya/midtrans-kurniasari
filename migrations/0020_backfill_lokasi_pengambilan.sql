-- 0020_backfill_lokasi_pengambilan.sql
-- Purpose: Backfill orders.lokasi_pengambilan from legacy pickup_outlet where needed.
-- Safe to run multiple times.

BEGIN TRANSACTION;

UPDATE orders
SET lokasi_pengambilan = COALESCE(lokasi_pengambilan, pickup_outlet)
WHERE (lokasi_pengambilan IS NULL OR TRIM(lokasi_pengambilan) = '')
  AND pickup_outlet IS NOT NULL
  AND TRIM(pickup_outlet) <> '';

COMMIT;
