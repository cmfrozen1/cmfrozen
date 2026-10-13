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

// Get all stock movements with filtering
router.get("/", auth, async (req: Request, res: Response) => {
  try {
    const {
      search,
      productId,
      type,
      startDate,
      endDate,
      userId,
      page = "1",
      limit = "20"
    } = req.query;

    let condition = "1=1";
    const params: any[] = [];

    if (search) {
      condition = condition + " AND (note LIKE ? OR CAST(id AS TEXT) LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (productId) {
      condition = condition + " AND productId = ?";
      params.push(Number(productId));
    }

    if (type) {
      condition = condition + " AND type = ?";
      params.push(type as string);
    }

    if (userId) {
      condition = condition + " AND userId = ?";
      params.push(Number(userId));
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const total = new Promise<number>((resolve, reject) => {
      const countQuery = `SELECT COUNT(*) as count FROM stock_movements WHERE ${condition}`;
      const row = db.prepare(countQuery).get(params.slice(0, -2));
      resolve(row ? row.count : 0);
    });

    const data = db.prepare(
      `SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE ${condition} ORDER BY sm.createdAt DESC LIMIT ? OFFSET ?`
    ).all([limitNum, offset].concat(params.slice(0, -2)));

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: (await total),
        pages: Math.ceil(((await total) as number) / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stock movement by ID
router.get("/:id", auth, (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);

    const data = db.prepare(
      "SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE sm.id = ?"
    ).get(movementId);

    if (!data) {
      return res.status(404).json({ success: false, error: "Stock movement not found" });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stock movements by product
router.get("/product/:productId", auth, (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId);

    const data = db.prepare(
      "SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE sm.productId = ? ORDER BY sm.createdAt DESC"
    ).all(productId);

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;