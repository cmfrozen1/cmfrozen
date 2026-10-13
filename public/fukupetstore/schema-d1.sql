-- ====================================================================
-- Fukupet Store - D1 (SQLite) Database Schema
-- Converted from initdatabase.sql (MySQL) for Cloudflare D1
-- Safe to re-run: Uses CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE
-- ====================================================================

-- 1. Table: site_sections (Flexible JSON store for all CMS sections)
CREATE TABLE IF NOT EXISTS site_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT NOT NULL UNIQUE,
  section_name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

-- 2. Table: site_settings (General configs, SEO, contacts)
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

-- 3. Table: orders (Customer order submissions from storefront)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  product_title TEXT NOT NULL,
  size_name TEXT NOT NULL,
  bundle_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  upsell_included INTEGER NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','shipping','completed','cancelled')),
  tracking_number TEXT,
  notes TEXT,
  slip_path TEXT,
  shipping_carrier TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

-- 4. Table: media_files (Uploaded images catalog in R2)
CREATE TABLE IF NOT EXISTS media_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

-- 5. Table: admin_users (CMS Administrators)
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

-- 6. Table: sessions (Admin login sessions for Workers)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  expires_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Triggers to auto-update updated_at on site_sections/site_settings
CREATE TRIGGER IF NOT EXISTS trg_site_sections_updated
AFTER UPDATE ON site_sections
BEGIN
  UPDATE site_sections SET updated_at = strftime('%Y-%m-%d %H:%M:%S','now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_site_settings_updated
AFTER UPDATE ON site_settings
BEGIN
  UPDATE site_settings SET updated_at = strftime('%Y-%m-%d %H:%M:%S','now') WHERE id = NEW.id;
END;
