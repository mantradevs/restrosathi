-- Database Schema for RestroSathi - Restaurant Management System
-- Paste this script into the Supabase SQL Editor to create all the required tables and indices.

-- 1. Create Roles & Users Table
CREATE TABLE IF NOT EXISTS restaurant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Plain text for simple restaurant environment auth (can be hashed in production)
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Accounts:
-- Owner: username: owner / pass: owner123
-- Admin: username: admin / pass: admin123
-- Staff: username: staff / pass: staff123
INSERT INTO restaurant_users (username, password, role, name)
VALUES 
    ('owner', 'owner123', 'owner', 'Restaurant Owner'),
    ('admin', 'admin123', 'admin', 'Restaurant Admin'),
    ('staff', 'staff123', 'staff', 'Staff Member')
ON CONFLICT (username) DO NOTHING;


-- 2. Create Tables Table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL,
    seating_capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed standard tables:
INSERT INTO restaurant_tables (table_number, seating_capacity, status)
VALUES 
    ('Table 1', 2, 'available'),
    ('Table 2', 4, 'available'),
    ('Table 3', 4, 'available'),
    ('Table 4', 6, 'available'),
    ('Table 5', 8, 'available')
ON CONFLICT (table_number) DO NOTHING;


-- 3. Create Menu Categories Table
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed standard categories:
INSERT INTO menu_categories (name)
VALUES 
    ('Starters'),
    ('Mains'),
    ('Desserts'),
    ('Beverages')
ON CONFLICT (name) DO NOTHING;


-- 4. Create Menu Items Table (price and image are optional)
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0, -- price optional, default 0
    image_url TEXT, -- image optional
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed some standard menu items:
INSERT INTO menu_items (name, price, category_id, description)
VALUES 
    ('Garlic Bread', 150, (SELECT id FROM menu_categories WHERE name = 'Starters'), 'Crispy baguette slices toasted with garlic butter and fresh herbs'),
    ('Chicken Wings', 320, (SELECT id FROM menu_categories WHERE name = 'Starters'), 'Spicy chicken wings served with hot buffalo sauce'),
    ('Veg Margherita Pizza', 450, (SELECT id FROM menu_categories WHERE name = 'Mains'), 'Classic tomato sauce, fresh mozzarella, and basil'),
    ('Grilled Chicken Breast', 550, (SELECT id FROM menu_categories WHERE name = 'Mains'), 'Served with mashed potatoes and garlic sautéed vegetables'),
    ('Chocolate Brownie', 180, (SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Warm chocolate brownie topped with chocolate syrup'),
    ('Fresh Lemonade', 100, (SELECT id FROM menu_categories WHERE name = 'Beverages'), 'Refreshing fresh lemon juice with mint and sugar syrup')
ON CONFLICT DO NOTHING;


-- 5. Create Table Sessions Table (NEW - groups all orders for a table visit)
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    started_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by TEXT
);

ALTER TABLE table_sessions DISABLE ROW LEVEL SECURITY;


-- 6. Create Orders Table (with session_id and payment_status)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    total_amount NUMERIC DEFAULT 0,
    created_by TEXT NOT NULL, -- username of creator
    confirmed_by TEXT, -- username of confirmer
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);


-- 7. Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_at_order NUMERIC NOT NULL DEFAULT 0, -- price of the item when ordered
    item_name TEXT NOT NULL, -- store item name to prevent breaking orders if menu item is deleted
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed')),
    created_at TIMESTAMPTZ DEFAULT now()
);


-- 8. Add trigger to update orders.updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at_column();


-- 9. Disable Row Level Security (RLS)
-- Disabling RLS allows the frontend client to query and modify tables directly via the public API key.
ALTER TABLE restaurant_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;


-- 10. Create KOT Settings Table
CREATE TABLE IF NOT EXISTS kot_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    restaurant_name TEXT NOT NULL DEFAULT 'RestroSathi',
    header_text TEXT NOT NULL DEFAULT 'KITCHEN ORDER TICKET',
    footer_text TEXT NOT NULL DEFAULT 'Thank you! Visit again.',
    show_price BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings:
INSERT INTO kot_settings (id, restaurant_name, header_text, footer_text, show_price)
VALUES ('default', 'RestroSathi', 'KITCHEN ORDER TICKET', 'Thank you! Visit again.', TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE kot_settings DISABLE ROW LEVEL SECURITY;
