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

// Get all sales with filtering
router.get("/", auth, async (req: Request, res: Response) => {
  try {
    const {
      search,
      startDate,
      endDate,
      paymentMethod,
      status,
      page = "1",
      limit = "20"
    } = req.query;

    let condition = "1=1";
    const params: any[] = [];

    if (search) {
      condition = condition + " AND receiptNumber LIKE ?";
      params.push(`%${search}%`);
    }

    if (startDate && endDate) {
      condition = condition + " AND createdAt >= ? AND createdAt <= ?";
      params.push(startDate as string, endDate as string);
    }

    if (paymentMethod) {
      condition = condition + " AND paymentMethod = ?";
      params.push(paymentMethod as string);
    }

    if (status) {
      condition = condition + " AND status = ?";
      params.push(status as string);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const total = await new Promise<number>((resolve, reject) => {
      const countQuery = `SELECT COUNT(*) as count FROM sales WHERE ${condition}`;
      const row = db.prepare(countQuery).get(params.slice(0, -2));
      resolve(row ? row.count : 0);
    });

    const data = db.prepare(
      `SELECT s.*, u.name as userName FROM sales s LEFT JOIN users u ON s.userId = u.id WHERE ${condition} ORDER BY s.createdAt DESC LIMIT ? OFFSET ?`
    ).all([limitNum, offset].concat(params.slice(0, -2)));

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sale by ID with items
router.get("/:id", auth, (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id);

    // Get sale details
    const saleData = db.prepare(
      `SELECT s.*, u.name as userName FROM sales s LEFT JOIN users u ON s.userId = u.id WHERE s.id = ?`
    ).get(saleId);

    if (!saleData) {
      return res.status(404).json({ success: false, error: "Sale not found" });
    }

    // Get sale items with product info
    const itemsData = db.prepare(
      `SELECT si.*, p.name as productName, p.sku FROM saleItems si LEFT JOIN products p ON si.productId = p.id WHERE si.saleId = ?`
    ).all(saleId);

    res.json({
      success: true,
      sale: saleData,
      items: itemsData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new sale
router.post("/", auth, (req: Request, res: Response) => {
  try {
    const {
      userId,
      items, // [{ productId, quantity, discount }]
      paymentMethod,
      discountAmount = 0
    } = req.body;

    if (!userId || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: "User ID and items are required" });
    }

    // Calculate totals
    let totalAmount = 0;
    let discount = 0;

    const saleItemsData: any[] = [];

    for (const item of items) {
      const productId = item.productId;
      const quantity = item.quantity;
      const itemDiscount = item.discount || 0;

      // Get product info
      const productData = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);

      if (!productData) {
        return res.status(404).json({ success: false, error: `Product ID ${productId} not found` });
      }

      const product = productData;

      // Check stock
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          error: `สินค้าในสต๊อกไม่เพียงพอสำหรับ ${product.name} (เหลือ ${product.stock} ชิ้น)`
        });
      }

      const unitPrice = product.salePrice;
      const itemTotal = unitPrice * quantity;
      const itemDiscountValue = itemDiscount * quantity;

      totalAmount += itemTotal;
      discount += itemDiscountValue;

      saleItemsData.push({
        productId,
        quantity,
        unitPrice,
        discount: itemDiscount,
        totalPrice: itemTotal - itemDiscountValue
      });
    }

    const finalAmount = totalAmount - discount;

    // Create sale in a transaction
    const t = db.transaction();

    try {
      // 1. Create sale
      const receiptNumber = `REC-${Date.now()}`;
      const [newSale] = t(db.prepare(
        "INSERT INTO sales (receiptNumber, totalAmount, discountAmount, finalAmount, paymentMethod, status, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(receiptNumber, totalAmount, discountAmount, finalAmount, paymentMethod, "ACTIVE", userId, new Date()));

      // 2. Create sale items and update stock
      for (const item of saleItemsData) {
        // Create sale item
        t(db.prepare(
          "INSERT INTO saleItems (saleId, productId, quantity, unitPrice, discount, totalPrice) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(newSale.lastInsertRowid, item.productId, item.quantity, item.unitPrice, item.discount, item.totalPrice));

        // Decrease stock
        t(db.prepare(
          "UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ?"
        ).run(item.quantity, new Date(), item.productId));

        // Create stock movement
        t(db.prepare(
          "INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          item.productId,
          "SALE",
          0, // quantityBefore will be handled differently
          -item.quantity,
          0, // quantityAfter will be handled differently
          newSale.lastInsertRowid,
          "SALE",
          "Product sold",
          1,
          new Date()
        ));
      }

      // Commit transaction
      t.commit();

      res.status(201).json({
        success: true,
        data: {
          id: newSale.lastInsertRowid,
          receiptNumber,
          totalAmount,
          discountAmount,
          finalAmount,
          paymentMethod
        }
      });
    } catch (error: any) {
      t.rollback();
      res.status(500).json({ success: false, error: error.message });
    }

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update payment status
router.patch("/:id/payment", auth, (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id);
    const { paidAmount, change } = req.body;

    // Update payment
    const result = db.prepare(
      "UPDATE payments SET paidAmount = ?, change = ?, status = ? WHERE saleId = ?"
    ).run(paidAmount, change, paidAmount >= 0 ? "COMPLETED" : "PENDING", saleId);

    res.json({ success: true, message: "Payment updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel/void sale
router.post("/:id/cancel", auth, (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id);

    // Check if sale exists
    const saleData = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    if (!saleData) {
      return res.status(404).json({ success: false, error: "Sale not found" });
    }

    if (saleData.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "Sale is already cancelled or voided" });
    }

    // Get sale items to restore stock
    const itemsData = db.prepare("SELECT productId, quantity FROM saleItems WHERE saleId = ?").all(saleId);

    // Restore stock
    for (const item of itemsData) {
      db.prepare(
        "UPDATE products SET stock = stock + ?, updatedAt = ? WHERE id = ?"
      ).run(item.quantity, new Date(), item.productId);

      // Create stock movement for returning stock
      db.prepare(
        "INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        item.productId,
        "RETURN",
        0,
        item.quantity,
        0,
        saleId,
        "RETURN_SALE",
        "Stock returned after sale cancellation",
        1,
        new Date()
      );
    }

    // Update sale status to CANCELLED
    db.prepare("UPDATE sales SET status = ? WHERE id = ?").run("CANCELLED", saleId);

    res.json({ success: true, message: "Sale cancelled successfully, stock restored" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;