-- backend/migrations/002_add_price_at_signal.sql
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS price_at_signal FLOAT;
