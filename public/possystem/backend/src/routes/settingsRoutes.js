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
// Get settings
router.get("/", auth, (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update settings
router.put("/", auth, (req, res) => {
    try {
        const { shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix } = req.body;
        // Check if settings exist
        const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
        if (!existing) {
            const result = db.prepare("INSERT INTO settings (shopName, shopAddress, shopPhone, taxId, currency, taxRate, receiptPrefix, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(shopName || "ร้านชายของชา", shopAddress || "", shopPhone || "", taxId || "", currency || "THB", taxRate || 0.07, receiptPrefix || "REC", new Date(), new Date());
            res.status(201).json({
                success: true,
                data: { id: result.lastInsertRowid, ...req.body }
            });
        }
        else {
            db.prepare("UPDATE settings SET shopName = ?, shopAddress = ?, shopPhone = ?, taxId = ?, currency = ?, taxRate = ?, receiptPrefix = ?, updatedAt = ? WHERE id = 1").run(shopName !== undefined ? shopName : existing.shopName, shopAddress !== undefined ? shopAddress : existing.shopAddress, shopPhone !== undefined ? shopPhone : existing.shopPhone, taxId !== undefined ? taxId : existing.taxId, currency !== undefined ? currency : existing.currency, taxRate !== undefined ? taxRate : existing.taxRate, receiptPrefix !== undefined ? receiptPrefix : existing.receiptPrefix, new Date());
            const [updated] = db.prepare("SELECT * FROM settings WHERE id = 1").get();
            res.json({ success: true, data: updated });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=settingsRoutes.js.map