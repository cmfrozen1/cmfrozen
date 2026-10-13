// @ts-nocheck
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Import routes
import productRoutes from "./routes/productRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import userRoutes from "./routes/userRoutes";
import supplierRoutes from "./routes/supplierRoutes";
import salesRoutes from "./routes/salesRoutes";
import purchaseRoutes from "./routes/purchaseRoutes";
import stockMovementRoutes from "./routes/stockMovementRoutes";
import settingsRoutes from "./routes/settingsRoutes";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/stock-movements", stockMovementRoutes);
app.use("/api/settings", settingsRoutes);

// Health check route
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "POS API is running" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

// 404 route
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Not Found"
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;