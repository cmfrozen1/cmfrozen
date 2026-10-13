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

// Get all suppliers
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

    let query = `SELECT * FROM suppliers WHERE ${condition} ORDER BY ${sortColumn} LIMIT ? OFFSET ?`;
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get supplier by ID
router.get("/:id", auth, (req: Request, res: Response) => {
  try {
    const data = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Supplier not found" });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create supplier
router.post("/", auth, (req: Request, res: Response) => {
  try {
    const { name, phone, email, address, note } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "Supplier name is required" });
    }

    // Check if supplier name already exists
    const existing = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: "Supplier name already exists" });
    }

    const result = db.prepare(
      "INSERT INTO suppliers (name, phone, email, address, note, status, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(name, phone || null, email || null, address || null, note || null, "ACTIVE", true, new Date(), new Date());

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid(), name, phone, email, address, note, status: "ACTIVE", isActive: true }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update supplier
router.put("/:id", auth, (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id);
    const { name, phone, email, address, note } = req.body;

    // Check if supplier exists
    const existing = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(supplierId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Supplier not found" });
    }

    // Check if name being updated already exists in another supplier
    if (name && name !== existing.name) {
      const duplicate = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(name);
      if (duplicate) {
        return res.status(409).json({ success: false, error: "Supplier name already exists" });
      }
    }

    db.prepare(
      "UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, note = ?, updatedAt = ? WHERE id = ?"
    ).run(name, phone !== undefined ? phone : existing.phone, email !== undefined ? email : existing.email, address !== undefined ? address : existing.address, note !== undefined ? note : existing.note, new Date(), supplierId);

    const [updated] = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(supplierId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Soft delete supplier
router.delete("/:id", auth, (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id);

    // Check if supplier has purchase history
    const hasPurchases = db.prepare("SELECT COUNT(*) as count FROM purchases WHERE supplierId = ?").get(supplierId).count;

    if (hasPurchases > 0) {
      // Soft delete
      db.prepare("UPDATE suppliers SET isActive = 0, status = ? WHERE id = ?").run("INACTIVE", supplierId);
      return res.json({ success: true, message: "Supplier deactivated (soft deleted)" });
    }

    // Permanent delete if no purchase history
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(supplierId);
    res.json({ success: true, message: "Supplier deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;