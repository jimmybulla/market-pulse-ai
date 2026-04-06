-- Migration 004: Add updated_at column to signals table
-- Required by pipeline.py which writes updated_at on every signal upsert
ALTER TABLE signals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
