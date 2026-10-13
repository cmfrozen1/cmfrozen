// @ts-nocheck
import express, { Request, Response } from "express";
import Database from "better-sqlite3";

const db = new Database("./db.sqlite", { readonly: false });
db.pragma("foreign_keys = ON");

const router = express.Router();

// Middleware: authenticate user (mock for development)
function auth(req: Request, res: Response, next: any) {
  next();
}

// Get all products with optional filtering
router.get("/", auth, (req: Request, res: Response) => {
  try {
    const {
      search,
      categoryId,
      status,
      minStock,
      sortBy = "name",
      sortOrder = "asc",
      page = "1",
      limit = "20"
    } = req.query;

    let condition = "1=1";
    const params: any[] = [];

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product by ID
router.get("/:id", auth, (req: Request, res: Response) => {
  try {
    const data = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create product
router.post("/", auth, (req: Request, res: Response) => {
  try {
    const {
      sku, barcode, name, description, categoryId,
      unit, costPrice, salePrice, stock, minStock,
      imageUrl, status, isActive
    } = req.body;

    // Validate required fields
    if (!sku || !name) {
      return res.status(400).json({ success: false, error: "SKU and name are required" });
    }

    // Check if SKU already exists
    const existingSku = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
    if (existingSku) {
      return res.status(409).json({ success: false, error: "SKU already exists" });
    }

    // Check if barcode already exists if provided
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
        id: result.lastInsertRowid(),
        sku, barcode, name, description, categoryId,
        unit, costPrice, salePrice, stock, minStock,
        imageUrl, status, isActive
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
router.put("/:id", auth, (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const {
      sku, barcode, name, description, categoryId,
      unit, costPrice, salePrice, stock, minStock,
      imageUrl, status, isActive
    } = req.body;

    // Check if product exists
    const existingProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    // If SKU is being updated, check for duplicates
    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
      if (duplicateSku) {
        return res.status(409).json({ success: false, error: "SKU already exists" });
      }
    }

    // If barcode is being updated, check for duplicates
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete/soft delete product
router.delete("/:id", auth, (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);

    // Check if product has sales history
    const hasSales = db.prepare("SELECT COUNT(*) as count FROM saleItems WHERE productId = ?").get(productId).count;

    if (hasSales > 0) {
      // Soft delete - just set isActive to false
      db.prepare("UPDATE products SET isActive = 0, status = ? WHERE id = ?").run("INACTIVE", productId);

      // Create stock movement for the "removal"
      db.prepare(
        "INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        productId,
        "OTHER",
        0,
        0,
        0,
        0,
        "SOFT_DELETE",
        "Product soft deleted due to sales history",
        1,
        new Date()
      );

      return res.json({ success: true, message: "Product deactivated (soft deleted)" });
    }

    // Permanent delete if no sales history
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product by barcode
router.get("/barcode/:barcode", auth, (req: Request, res: Response) => {
  try {
    const data = db.prepare("SELECT * FROM products WHERE barcode = ?").get(req.params.barcode);
    if (!data) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;