const Database = require('better-sqlite3');
const db = new Database('./db.sqlite', { readonly: false });
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'ADMIN',
    isActive BOOLEAN DEFAULT 1,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
    lastLogin INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    categoryId INTEGER,
    unit TEXT DEFAULT 'ชิ้น',
    costPrice REAL DEFAULT 0,
    salePrice REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    minStock INTEGER DEFAULT 0,
    imageUrl TEXT,
    status TEXT DEFAULT 'ACTIVE',
    isActive BOOLEAN DEFAULT 1,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantityBefore INTEGER NOT NULL,
    quantityChange INTEGER NOT NULL,
    quantityAfter INTEGER NOT NULL,
    referenceId INTEGER,
    referenceType TEXT NOT NULL,
    note TEXT,
    userId INTEGER,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    note TEXT,
    status TEXT DEFAULT 'ACTIVE',
    isActive BOOLEAN DEFAULT 1,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receiptNumber TEXT UNIQUE NOT NULL,
    supplierId INTEGER,
    totalAmount REAL DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    userId INTEGER,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (supplierId) REFERENCES suppliers(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchaseId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unitCost REAL DEFAULT 0,
    totalCost REAL DEFAULT 0,
    FOREIGN KEY (purchaseId) REFERENCES purchases(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receiptNumber TEXT UNIQUE NOT NULL,
    totalAmount REAL NOT NULL,
    discountAmount REAL DEFAULT 0,
    finalAmount REAL NOT NULL,
    paymentMethod TEXT NOT NULL,
    paymentStatus TEXT DEFAULT 'PAID',
    status TEXT DEFAULT 'ACTIVE',
    userId INTEGER NOT NULL,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unitPrice REAL NOT NULL,
    discount REAL DEFAULT 0,
    totalPrice REAL NOT NULL,
    FOREIGN KEY (saleId) REFERENCES sales(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER UNIQUE NOT NULL,
    amount REAL NOT NULL,
    paidAmount REAL,
    change REAL,
    paymentMethod TEXT NOT NULL,
    status TEXT DEFAULT 'COMPLETED',
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (saleId) REFERENCES sales(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopName TEXT,
    shopAddress TEXT,
    shopPhone TEXT,
    taxId TEXT,
    currency TEXT DEFAULT 'THB',
    taxRate REAL DEFAULT 0.07,
    receiptPrefix TEXT DEFAULT 'REC',
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
  CREATE INDEX IF NOT EXISTS idx_stockMovements_productId ON stock_movements(productId);
  CREATE INDEX IF NOT EXISTS idx_stockMovements_type ON stock_movements(type);
  CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId);
  CREATE INDEX IF NOT EXISTS idx_sales_createdAt ON sales(createdAt);
  CREATE INDEX IF NOT EXISTS idx_saleItems_saleId ON sale_items(saleId);
  CREATE INDEX IF NOT EXISTS idx_purchases_supplierId ON purchases(supplierId);
  CREATE INDEX IF NOT EXISTS idx_purchaseItems_productId ON purchase_items(productId);
`);

console.log("Database initialized successfully");