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

// Get settings
router.get("/", auth, (req: Request, res: Response) => {
  try {
    const data = db.prepare("SELECT * FROM settings WHERE id = 1").get();

    if (!data) {
      // Return default settings if none exist
      const defaultSettings = {
        id: 0,
        shopName: "ร้านชายของชา",
        shopAddress: "",
        shopPhone: "",
        taxId: "",
        currency: "THB",
        taxRate: 0.07,
        receiptPrefix: "REC"
      };
      return res.json({ success: true, data: defaultSettings });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update settings
router.put("/", auth, (req: Request, res: Response) => {
  try {
    const {
      shopName,
      shopAddress,
      shopPhone,
      taxId,
      currency,
      taxRate,
      receiptPrefix
    } = req.body;

    // Check if settings exist
    const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();

    if (!existing) {
      const result = db.prepare(
        "INSERT INTO settings (shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
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

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid, ...(req.body as any) }
      });
    } else {
      db.prepare(
        "UPDATE settings SET shopName = ?, shopAddress = ?, shopPhone = ?, taxId = ?, currency = ?, taxRate = ?, receiptPrefix = ?, updatedAt = ? WHERE id = 1"
      ).run(
        shopName !== undefined ? shopName : existing.shopName,
        shopAddress !== undefined ? shopAddress : existing.shopAddress,
        shopPhone !== undefined ? shopPhone : existing.shopPhone,
        taxId !== undefined ? taxId : existing.taxId,
        currency !== undefined ? currency : existing.currency,
        taxRate !== undefined ? taxRate : existing.taxRate,
        receiptPrefix !== undefined ? receiptPrefix : existing.receiptPrefix,
        new Date()
      );

      const [updated] = db.prepare("SELECT * FROM settings WHERE id = 1").get();
      res.json({ success: true, data: updated });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;