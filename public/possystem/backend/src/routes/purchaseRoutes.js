"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const db = new better_sqlite3_1.default("./db.sqlite", { readonly: false });
db.pragma("foreign_keys = ON");
const router = express_1.default.Router();
// Middleware: authenticate user (mock for development)
function auth(req, res, next) {
    next();
}
// Get all purchases with filtering
router.get("/", auth, async (req, res) => {
    try {
        const { search, supplierId, startDate, endDate, status, page = "1", limit = "20" } = req.query;
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
        if (startDate && endDate) {
            condition = condition + " AND createdAt >= ? AND createdAt <= ?";
            params.push(startDate, endDate);
        }
        if (status) {
            condition = condition + " AND status = ?";
            params.push(status);
        }
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Math.min(100, Number(limit)));
        const offset = (pageNum - 1) * limitNum;
        const total = new Promise((resolve, reject) => {
            const countQuery = `SELECT COUNT(*) as count FROM purchases WHERE ${condition}`;
            const row = db.prepare(countQuery).get(params.slice(0, -2));
            resolve(row ? row.count : 0);
        });
        const data = db.prepare(`SELECT p.*, s.name as supplierName, u.name as userName FROM purchases p LEFT JOIN suppliers s ON p.supplierId = s.id LEFT JOIN users u ON p.userId = u.id WHERE ${condition} ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`).all([limitNum, offset].concat(params.slice(0, -2)));
        res.json({
            success: true,
            data,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: (await total),
                pages: Math.ceil((await total) / limitNum)
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get purchase by ID with items
router.get("/:id", auth, (req, res) => {
    try {
        const purchaseId = Number(req.params.id);
        // Get purchase details
        const purchaseData = db.prepare(`SELECT p.*, s.name as supplierName, u.name as userName FROM purchases p LEFT JOIN suppliers s ON p.supplierId = s.id LEFT JOIN users u ON p.userId = u.id WHERE p.id = ?`).get(purchaseId);
        if (!purchaseData) {
            return res.status(404).json({ success: false, error: "Purchase not found" });
        }
        // Get purchase items with product info
        const itemsData = db.prepare("SELECT pi.*, p.name as productName, p.sku FROM purchaseItems pi LEFT JOIN products p ON pi.productId = p.id WHERE pi.purchaseId = ?").all(purchaseId);
        res.json({
            success: true,
            purchase: purchaseData,
            items: itemsData
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Create new purchase (รับสินค้าเข้า)
router.post("/", auth, async (req, res) => {
    try {
        const { userId, supplierId, items, // [{ productId, quantity, unitCost }]
        receiptNumber } = req.body;
        if (!userId || !supplierId || !items || items.length === 0) {
            return res.status(400).json({ success: false, error: "User ID, supplier ID, and items are required" });
        }
        // Start a transaction
        const t = db.transaction();
        try {
            // 1. Create purchase
            const receiptNum = receiptNumber || `PO-${Date.now()}`;
            const [newPurchase] = t(db.prepare("INSERT INTO purchases (receiptNumber, supplierId, totalAmount, status, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(receiptNum, supplierId, 0, "COMPLETED", userId, new Date()));
            // 2. Create purchase items and increase stock
            let totalAmount = 0;
            for (const item of items) {
                const productId = item.productId;
                const quantity = item.quantity;
                const unitCost = item.unitCost || 0;
                // Get product info
                const productData = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
                if (!productData) {
                    t.rollback();
                    return res.status(404).json({ success: false, error: `Product ID ${productId} not found` });
                }
                const product = productData;
                const itemTotal = unitCost * quantity;
                totalAmount += itemTotal;
                // Create purchase item
                t(db.prepare("INSERT INTO purchaseItems (purchaseId, productId, quantity, unitCost, totalCost) VALUES (?, ?, ?, ?, ?)").run(newPurchase.lastInsertRowid, productId, quantity, unitCost, itemTotal));
                // Increase stock
                t(db.prepare("UPDATE products SET stock = stock + ?, updatedAt = ? WHERE id = ?").run(quantity, new Date(), productId));
                // Create stock movement for purchase
                t(db.prepare("INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(productId, "PURCHASE", 0, quantity, 0, newPurchase.lastInsertRowid, "PURCHASE", "Product received from supplier", 1, new Date()));
            }
            // Update purchase total amount
            t(db.prepare("UPDATE purchases SET totalAmount = ? WHERE id = ?").run(totalAmount, newPurchase.lastInsertRowid));
            await t.commit();
            res.status(201).json({
                success: true,
                data: {
                    id: newPurchase.lastInsertRowid,
                    receiptNumber: newPurchase.firstValue,
                    totalAmount
                }
            });
        }
        catch (error) {
            t.rollback();
            res.status(500).json({ success: false, error: error.message });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Cancel purchase
router.post("/:id/cancel", auth, async (req, res) => {
    try {
        const purchaseId = Number(req.params.id);
        // Check if purchase exists
        const purchaseData = db.prepare("SELECT * FROM purchases WHERE id = ?").get(purchaseId);
        if (!purchaseData) {
            return res.status(404).json({ success: false, error: "Purchase not found" });
        }
        if (purchaseData.status !== "COMPLETED") {
            return res.status(400).json({ success: false, error: "Purchase is already cancelled" });
        }
        // Start transaction to rollback stock
        const t = db.transaction();
        try {
            // Get purchase items to reduce stock
            const itemsData = db.prepare("SELECT productId, quantity FROM purchaseItems WHERE purchaseId = ?").all(purchaseId);
            // Reduce stock
            for (const item of itemsData) {
                const productData = db.prepare("SELECT * FROM products WHERE id = ?").get(item.productId);
                if (productData) {
                    const product = productData;
                    // Check if stock will go negative
                    if (product.stock < item.quantity) {
                        t.rollback();
                        return res.status(400).json({ success: false, error: "Cannot cancel: stock would go negative" });
                    }
                    t(db.prepare("UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ?").run(item.quantity, new Date(), item.productId));
                    // Create stock movement for returning to supplier
                    t(db.prepare("INSERT INTO stock_movements (productId, type, quantityBefore, quantityChange, quantityAfter, referenceId, referenceType, note, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(item.productId, "RETURN", product.stock, -item.quantity, 0, purchaseId, "PURCHASE_CANCEL", "Stock returned after purchase cancellation", 1, new Date()));
                }
            }
            // Update purchase status to CANCELLED
            t(db.prepare("UPDATE purchases SET status = ? WHERE id = ?").run("CANCELLED", purchaseId));
            await t.commit();
        }
        catch (error) {
            t.rollback();
            res.status(500).json({ success: false, error: error.message });
        }
        res.json({ success: true, message: "Purchase cancelled successfully, stock restored" });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=purchaseRoutes.js.map