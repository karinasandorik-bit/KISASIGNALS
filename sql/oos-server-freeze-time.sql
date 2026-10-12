-- Run once as database owner before deploying code that reads frozen_at.
-- This records DB-side INSERT time, not true transaction COMMIT time.
ALTER TABLE owl_internal.predictions
 ADD COLUMN IF NOT EXISTS frozen_at timestamptz;
ALTER TABLE owl_internal.predictions
 ALTER COLUMN frozen_at SET DEFAULT clock_timestamp();
-- Historical rows intentionally remain NULL: never backfill from user clocks.
