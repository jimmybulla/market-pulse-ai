-- backend/migrations/006_signal_lifecycle.sql
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_move      NUMERIC,
  ADD COLUMN IF NOT EXISTS was_correct      BOOLEAN,
  ADD COLUMN IF NOT EXISTS resolved_verdict TEXT,
  ADD COLUMN IF NOT EXISTS accuracy_notes   TEXT;

ALTER TABLE signals ADD COLUMN IF NOT EXISTS price_at_signal NUMERIC;
