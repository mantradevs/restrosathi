-- Migration Script for RestroSathi v2 - Session-Based Table Management
-- Run this in the Supabase SQL Editor if you already have the base tables.

-- 1. Create table_sessions table
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    started_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by TEXT
);

ALTER TABLE table_sessions DISABLE ROW LEVEL SECURITY;

-- 2. Add session_id column to orders (nullable for backward compatibility)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE;

-- 3. Add payment_status column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid'));

-- 4. Add status column to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed'));
