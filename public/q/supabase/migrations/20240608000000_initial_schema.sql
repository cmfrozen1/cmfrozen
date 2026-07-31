-- Initial Schema for Pixel Queue Management System

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE queue_status AS ENUM ('waiting', 'called', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Shops Table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Characters Table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sprite_url TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{
        "rows": 4,
        "cols": 4,
        "speed": 0.1,
        "scale": 1.0,
        "filter_css": ""
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Queues Table
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    line_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    status queue_status DEFAULT 'waiting',
    queue_number SERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 5. Props (Decorations) Table
CREATE TABLE IF NOT EXISTS props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    collision_radius FLOAT DEFAULT 1.0,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS Policies (Row Level Security)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE props ENABLE ROW LEVEL SECURITY;

-- Public Read access
DO $$ BEGIN
    CREATE POLICY "Public Read Access" ON shops FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public Read Access" ON characters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public Read Access" ON queues FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public Read Access" ON props FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Queues: Public Insert
DO $$ BEGIN
    CREATE POLICY "Public Insert Queues" ON queues FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Admin All Access
DO $$ BEGIN
    CREATE POLICY "Admin All Access" ON shops FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin All Access" ON characters FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin All Access" ON queues FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin All Access" ON props FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shops;
ALTER PUBLICATION supabase_realtime ADD TABLE characters;
ALTER PUBLICATION supabase_realtime ADD TABLE queues;
ALTER PUBLICATION supabase_realtime ADD TABLE props;
