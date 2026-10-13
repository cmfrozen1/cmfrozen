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
// Get all stock movements with filtering
router.get("/", auth, async (req, res) => {
    try {
        const { search, productId, type, startDate, endDate, userId, page = "1", limit = "20" } = req.query;
        let condition = "1=1";
        const params = [];
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
            params.push(type);
        }
        if (userId) {
            condition = condition + " AND userId = ?";
            params.push(Number(userId));
        }
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Math.min(100, Number(limit)));
        const offset = (pageNum - 1) * limitNum;
        const total = new Promise((resolve, reject) => {
            const countQuery = `SELECT COUNT(*) as count FROM stock_movements WHERE ${condition}`;
            const row = db.prepare(countQuery).get(params.slice(0, -2));
            resolve(row ? row.count : 0);
        });
        const data = db.prepare(`SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE ${condition} ORDER BY sm.createdAt DESC LIMIT ? OFFSET ?`).all([limitNum, offset].concat(params.slice(0, -2)));
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
// Get stock movement by ID
router.get("/:id", auth, (req, res) => {
    try {
        const movementId = Number(req.params.id);
        const data = db.prepare("SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE sm.id = ?").get(movementId);
        if (!data) {
            return res.status(404).json({ success: false, error: "Stock movement not found" });
        }
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get stock movements by product
router.get("/product/:productId", auth, (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const data = db.prepare("SELECT sm.*, p.name as productName, p.sku, u.name as userName FROM stock_movements sm LEFT JOIN products p ON sm.productId = p.id LEFT JOIN users u ON sm.userId = u.id WHERE sm.productId = ? ORDER BY sm.createdAt DESC").all(productId);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=stockMovementRoutes.js.map