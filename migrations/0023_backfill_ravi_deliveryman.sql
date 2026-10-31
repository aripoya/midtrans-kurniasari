-- Backfill assigned_deliveryman_id for orders assigned to courier "Ravi".
-- Context: the admin dropdown was renamed Fendi -> Ravi (commit ecc51af), but the
-- backend courier->deliveryman mapping still only knew 'rudi' and 'fendi', so every
-- order saved with courier_service='ravi' got assigned_deliveryman_id=NULL and never
-- appeared in Ravi's delivery dashboard.
-- The EXISTS guard makes this a no-op if no deliveryman user named "ravi" exists.
UPDATE orders
SET assigned_deliveryman_id = (
      SELECT id FROM users
      WHERE role = 'deliveryman'
        AND (LOWER(username) = 'ravi' OR LOWER(name) = 'ravi')
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(COALESCE(courier_service, '')) = 'ravi'
  AND EXISTS (
      SELECT 1 FROM users
      WHERE role = 'deliveryman'
        AND (LOWER(username) = 'ravi' OR LOWER(name) = 'ravi')
  );
