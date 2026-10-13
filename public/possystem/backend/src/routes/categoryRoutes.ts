// @ts-nocheck
import express, { Request, Response } from "express";
import Database from "better-sqlite3";

const db = new Database("./db.sqlite", { readonly: false });
db.pragma("foreign_keys = ON");

const router = express.Router();

// Middleware: authenticate user (mock for development)
function auth(req: Request, res: Response, next: any) {
  // In production, verify JWT token here
  next();
}

// Get all categories
router.get("/", auth, (req: Request, res: Response) => {
  try {
    const { search, status, sortBy = "name", sortOrder = "asc", page = "1", limit = "20" } = req.query;

    let condition = "1=1";
    const params: any[] = [];

    if (search) {
      condition = condition + " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    if (status) {
      condition = condition + " AND status = ?";
      params.push(status);
    }

    const sortColumn = sortOrder === "desc" ? "DESC" : "ASC";
    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 20);

    let query = `SELECT * FROM categories WHERE ${condition} ORDER BY ${sortColumn} LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 20, offset);

    const data = db.prepare(query).all(params);

    const countQuery = `SELECT COUNT(*) as count FROM categories WHERE ${condition}`;
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

// Get category by ID
router.get("/:id", auth, (req: Request, res: Response) => {
  try {
    const data = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create category
router.post("/", auth, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "Category name is required" });
    }

    // Check if category name already exists
    const existing = db.prepare("SELECT * FROM categories WHERE name = ?").get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: "Category name already exists" });
    }

    const result = db.prepare(
      "INSERT INTO categories (name, description, status, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, description || null, "ACTIVE", true, new Date(), new Date());

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid(), name, description: description || null, status: "ACTIVE", isActive: true }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update category
router.put("/:id", auth, (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);
    const { name, description } = req.body;

    // Check if category exists
    const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    // Check if name being updated already exists in another category
    if (name && name !== existing.name) {
      const duplicate = db.prepare("SELECT * FROM categories WHERE name = ?").get(name);
      if (duplicate) {
        return res.status(409).json({ success: false, error: "Category name already exists" });
      }
    }

    db.prepare(
      "UPDATE categories SET name = ?, description = ?, updatedAt = ? WHERE id = ?"
    ).run(name, description !== undefined ? description : existing.description, new Date(), categoryId);

    const [updated] = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Soft delete category
router.delete("/:id", auth, (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);

    // Check if category has products
    const hasProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE categoryId = ?").get(categoryId).count;

    if (hasProducts > 0) {
      // Soft delete
      db.prepare("UPDATE categories SET isActive = 0, status = ? WHERE id = ?").run("INACTIVE", categoryId);
      return res.json({ success: true, message: "Category deactivated (soft deleted)" });
    }

    // Permanent delete if no products
    db.prepare("DELETE FROM categories WHERE id = ?").run(categoryId);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;