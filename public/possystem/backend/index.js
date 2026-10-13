"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import routes
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const supplierRoutes_1 = __importDefault(require("./routes/supplierRoutes"));
const salesRoutes_1 = __importDefault(require("./routes/salesRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const stockMovementRoutes_1 = __importDefault(require("./routes/stockMovementRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// API routes
app.use("/api/products", productRoutes_1.default);
app.use("/api/categories", categoryRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/suppliers", supplierRoutes_1.default);
app.use("/api/sales", salesRoutes_1.default);
app.use("/api/purchases", purchaseRoutes_1.default);
app.use("/api/stock-movements", stockMovementRoutes_1.default);
app.use("/api/settings", settingsRoutes_1.default);
// Health check route
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "POS API is running" });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || "Internal Server Error"
    });
});
// 404 route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Not Found"
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map