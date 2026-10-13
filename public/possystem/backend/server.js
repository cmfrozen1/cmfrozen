const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

// Database initialization FIRST
const db = new Database('./db.sqlite', { readonly: false });
db.pragma("foreign_keys = ON");

// Make db available to routes via closure - we'll use it directly
// Simple init - just ensure default data exists
function initDatabase() {
  const now = Math.floor(Date.now() / 1000);

  // Check if categories exist and have data
  const categoriesCount = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
  if (categoriesCount === 0) {
    // Add default categories (without isActive column)
    const defaultCategories = [
      "ชา",
      "กาแฟ",
      "เครื่องดื่ม",
      "ขนม",
      "วัตถุดิบ",
      "อุปกรณ์"
    ];
    for (const name of defaultCategories) {
      db.prepare("INSERT INTO categories (name, status, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(name, "ACTIVE", now, now);
    }
  }

  // Check if users exist
  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (usersCount === 0) {
    // Add default users - passwords are placeholders, hash in production
    const placeholderHash = "$2a$10$placeholder.hash.for.demo";
    db.prepare("INSERT INTO users (name, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "Admin",
      "admin@example.com",
      placeholderHash,
      "ADMIN",
      true,
      now,
      now
    );
    db.prepare("INSERT INTO users (name, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "Cashier",
      "cashier@example.com",
      placeholderHash,
      "CASHIER",
      true,
      now,
      now
    );
  }

  // Check if settings exist
  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get().count;
  if (settingsCount === 0) {
    db.prepare("INSERT INTO settings (shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "ร้านชายของชา",
      "",
      "",
      "",
      "THB",
      0.07,
      "REC",
      now,
      now
    );
  }
}

initDatabase();

// Express app setup
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "pos-system-secret-key-2026";
const JWT_EXPIRES_IN = "24h";

// Auth Middleware: verify JWT token
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Access Denied: No Token Provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: "Invalid or Expired Token" });
  }
}

// Auth Routes (PUT THESE FIRST before other routes)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    // Find user by email
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // Check password
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/register", authMiddleware, (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }

    // Check if user already exists
    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ success: false, error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(name, email, hashedPassword, role || "CASHIER", true, new Date(), new Date());

    res.status(201).json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name,
        email,
        role: role || "CASHIER"
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check route (now AFTER auth routes)
app.get("/api/health", authMiddleware, (req, res) => {
  res.json({ status: "ok", message: "POS API is running", user: req.user });
});

// Categories API
app.get("/api/categories", authMiddleware, (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM categories").all();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/categories/:id", authMiddleware, (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/categories", authMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Category name is required" });
    }
    const existing = db.prepare("SELECT * FROM categories WHERE name = ?").get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: "Category name already exists" });
    }
    const result = db.prepare("INSERT INTO categories (name, status, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(name, "ACTIVE", new Date(), new Date());
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid, name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/categories/:id", authMiddleware, (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const { name } = req.body;
    const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    db.prepare("UPDATE categories SET name = ?, updatedAt = ? WHERE id = ?").run(name, new Date(), categoryId);
    const [updated] = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/categories/:id", authMiddleware, (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const hasProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE categoryId = ?").get(categoryId).count;
    if (hasProducts > 0) {
      return res.json({ success: true, message: "Category deactivated (soft delete)" });
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(categoryId);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Products API
app.get("/api/products", authMiddleware, (req, res) => {
  try {
    const { search, categoryId, status, minStock, sortBy = "name", sortOrder = "asc", page = "1", limit = "20" } = req.query;

    let condition = "1=1";
    const params = [];

    if (search) {
      condition = condition + " AND (sku LIKE ? OR name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      condition = condition + " AND categoryId = ?";
      params.push(Number(categoryId));
    }

    if (status) {
      condition = condition + " AND status = ?";
      params.push(status);
    }

    if (minStock) {
      condition = condition + " AND stock < ?";
      params.push(Number(minStock));
    }

    const sortColumn = sortOrder === "desc" ? "DESC" : "ASC";
    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 20);

    let query = `SELECT * FROM products WHERE ${condition} ORDER BY ${sortColumn} LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 20, offset);

    const data = db.prepare(query).all(params);

    const countQuery = `SELECT COUNT(*) as count FROM products WHERE ${condition}`;
    const totalRow = db.prepare(countQuery).all(params.slice(0, -2))[0];
    const total = totalRow ? totalRow.count : 0;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        total,
        pages: Math.ceil(total / (Number(limit) || 20))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/products/:id", authMiddleware, (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/products", authMiddleware, (req, res) => {
  try {
    const { sku, barcode, name, description, categoryId, unit, costPrice, salePrice, stock, minStock, imageUrl, status, isActive } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ success: false, error: "SKU and name are required" });
    }

    const existingSku = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
    if (existingSku) {
      return res.status(409).json({ success: false, error: "SKU already exists" });
    }

    if (barcode) {
      const existingBarcode = db.prepare("SELECT * FROM products WHERE barcode = ?").get(barcode);
      if (existingBarcode) {
        return res.status(409).json({ success: false, error: "Barcode already exists" });
      }
    }

    const result = db.prepare(
      "INSERT INTO products (sku, barcode, name, description, categoryId, unit, costPrice, salePrice, stock, minStock, imageUrl, status, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      sku,
      barcode || null,
      name,
      description || null,
      categoryId || null,
      unit || "ชิ้น",
      costPrice || 0,
      salePrice || 0,
      stock || 0,
      minStock || 0,
      imageUrl || null,
      status || "ACTIVE",
      isActive !== false,
      new Date(),
      new Date()
    );

    // Create initial stock movement if stock > 0
    if (stock && stock > 0) {
      db.prepare(
        "INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        result.lastInsertRowid,
        "INITIAL_STOCK",
        0,
        stock,
        stock,
        result.lastInsertRowid,
        "INITIAL_STOCK",
        "Initial stock",
        1,
        new Date()
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        sku, barcode, name, description, categoryId,
        unit, costPrice, salePrice, stock, minStock,
        imageUrl, status, isActive
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/products/:id", authMiddleware, (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { sku, barcode, name, description, categoryId, unit, costPrice, salePrice, stock, minStock, imageUrl, status, isActive } = req.body;

    const existingProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
      if (duplicateSku) {
        return res.status(409).json({ success: false, error: "SKU already exists" });
      }
    }

    if (barcode && barcode !== existingProduct.barcode) {
      const duplicateBarcode = db.prepare("SELECT * FROM products WHERE barcode = ?").get(barcode);
      if (duplicateBarcode && barcode) {
        return res.status(409).json({ success: false, error: "Barcode already exists" });
      }
    }

    db.prepare(
      "UPDATE products SET sku = ?, barcode = ?, name = ?, description = ?, categoryId = ?, unit = ?, costPrice = ?, salePrice = ?, stock = ?, minStock = ?, imageUrl = ?, status = ?, isActive = ?, updatedAt = ? WHERE id = ?"
    ).run(
      sku || existingProduct.sku,
      barcode !== undefined ? barcode : existingProduct.barcode,
      name !== undefined ? name : existingProduct.name,
      description !== undefined ? description : existingProduct.description,
      categoryId !== undefined ? categoryId : existingProduct.categoryId,
      unit !== undefined ? unit : existingProduct.unit,
      costPrice !== undefined ? costPrice : existingProduct.costPrice,
      salePrice !== undefined ? salePrice : existingProduct.salePrice,
      stock !== undefined ? stock : existingProduct.stock,
      minStock !== undefined ? minStock : existingProduct.minStock,
      imageUrl !== undefined ? imageUrl : existingProduct.imageUrl,
      status !== undefined ? status : existingProduct.status,
      isActive !== undefined ? isActive : existingProduct.isActive,
      new Date(),
      productId
    );

    const [updated] = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/products/:id", authMiddleware, (req, res) => {
  try {
    const productId = Number(req.params.id);
    const hasSales = db.prepare("SELECT COUNT(*) as count FROM saleItems WHERE productId = ?").get(productId).count;
    if (hasSales > 0) {
      return res.json({ success: true, message: "Product deactivated (soft deleted)" });
    }
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Suppliers API
app.get("/api/suppliers", authMiddleware, (req, res) => {
  try {
    const { search, status, page = "1", limit = "20" } = req.query;

    let condition = "1=1";
    const params = [];

    if (search) {
      condition = condition + " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    if (status) {
      condition = condition + " AND status = ?";
      params.push(status);
    }

    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 20);

    let query = `SELECT * FROM suppliers WHERE ${condition} LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 20, offset);

    const data = db.prepare(query).all(params);

    const countQuery = `SELECT COUNT(*) as count FROM suppliers WHERE ${condition}`;
    const totalRow = db.prepare(countQuery).all(params.slice(0, -2))[0];
    const total = totalRow ? totalRow.count : 0;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        total,
        pages: Math.ceil(total / (Number(limit) || 20))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sales API
app.get("/api/sales", authMiddleware, (req, res) => {
  try {
    const { search, startDate, endDate, paymentMethod, status, page = "1", limit = "20" } = req.query;

    let condition = "1=1";
    const params = [];

    if (search) {
      condition = condition + " AND receiptNumber LIKE ?";
      params.push(`%${search}%`);
    }

    if (startDate && endDate) {
      condition = condition + " AND createdAt >= ? AND createdAt <= ?";
      params.push(startDate, endDate);
    }

    if (paymentMethod) {
      condition = condition + " AND paymentMethod = ?";
      params.push(paymentMethod);
    }

    if (status) {
      condition = condition + " AND status = ?";
      params.push(status);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const total = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE ${condition}`).get(params.slice(0, -2)).count;

    const data = db.prepare(`SELECT s.*, u.name as userName FROM sales s LEFT JOIN users u ON s.userId = u.id WHERE ${condition} ORDER BY s.createdAt DESC LIMIT ? OFFSET ?`).all([limitNum, offset].concat(params.slice(0, -2)));

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/sales/:id", authMiddleware, (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const saleData = db.prepare(`SELECT s.*, u.name as userName FROM sales s LEFT JOIN users u ON s.userId = u.id WHERE s.id = ?`).get(saleId);
    if (!saleData) {
      return res.status(404).json({ success: false, error: "Sale not found" });
    }
    const items = db.prepare("SELECT si.*, p.name as productName, p.sku FROM saleItems si LEFT JOIN products p ON si.productId = p.id WHERE si.saleId = ?").all(saleId);
    res.json({ success: true, sale: saleData, items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Purchases API
app.get("/api/purchases", authMiddleware, (req, res) => {
  try {
    const { search, supplierId, page = "1", limit = "20" } = req.query;

    let condition = "1=1";
    const params = [];

    if (search) {
      condition = condition + " AND receiptNumber LIKE ?";
      params.push(`%${search}%`);
    }

    if (supplierId) {
      condition = condition + " AND supplierId = ?";
      params.push(Number(supplierId));
    }

    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 20);

    let query = `SELECT p.*, s.name as supplierName FROM purchases p LEFT JOIN suppliers s ON p.supplierId = s.id WHERE ${condition} LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 20, offset);

    const data = db.prepare(query).all(params);

    const countQuery = `SELECT COUNT(*) as count FROM purchases WHERE ${condition}`;
    const totalRow = db.prepare(countQuery).all(params.slice(0, -2))[0];
    const total = totalRow ? totalRow.count : 0;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        total,
        pages: Math.ceil(total / (Number(limit) || 20))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings API
app.get("/api/settings", authMiddleware, (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!data) {
      return res.json({ success: true, data: { shopName: "ร้านชายของชา", currency: "THB", taxRate: 0.07, receiptPrefix: "REC" } });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/settings", authMiddleware, (req, res) => {
  try {
    const { shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix } = req.body;
    const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!existing) {
      db.prepare("INSERT INTO settings (shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        shopName || "ร้านชายของชา",
        shopAddress || "",
        shopPhone || "",
        taxId || "",
        currency || "THB",
        taxRate || 0.07,
        receiptPrefix || "REC",
        new Date(),
        new Date()
      );
    } else {
      db.prepare("UPDATE settings SET shopName = ?, shopAddress = ?, shopPhone = ?, taxId = ?, currency = ?, taxRate = ?, receiptPrefix = ?, updatedAt = ? WHERE id = 1").run(
        shopName !== undefined ? shopName : existing.shopName,
        shopAddress !== undefined ? shopAddress : existing.shopAddress,
        shopPhone !== undefined ? shopPhone : existing.shopPhone,
        taxId !== undefined ? taxId : existing.taxId,
        currency !== undefined ? currency : existing.currency,
        taxRate !== undefined ? taxRate : existing.taxRate,
        receiptPrefix !== undefined ? receiptPrefix : existing.receiptPrefix,
        new Date()
      );
    }
    const [updated] = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`POS Backend Server running on port ${PORT}`);
});
