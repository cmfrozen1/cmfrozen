// @ts-nocheck
import express, { Request, Response } from "express";
import Database from "better-sqlite3";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const db = new Database("./db.sqlite", { readonly: false });
db.pragma("foreign_keys = ON");

const router = express.Router();

// Helper: hash password
async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcryptjs.hash(password, saltRounds);
}

// Helper: generate JWT token
function generateToken(userId: number) {
  return jwt.sign(
    { userId, role: "ADMIN" },
    process.env.JWT_SECRET || "pos-system-secret-key",
    { expiresIn: "24h" }
  );
}

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    // Find user by email
    const userData = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!userData) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // Check password
    const validPassword = bcryptjs.compareSync(password, userData.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(userData.id);

    // Update last login
    db.prepare("UPDATE users SET lastLogin = ? WHERE id = ?").run(new Date(), userData.id);

    res.json({
      success: true,
      data: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        token
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register new user (Admin only)
router.post("/register", auth, (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }

    // Check if user already exists
    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ success: false, error: "Email already exists" });
    }

    const hashedPassword = hashPassword(password);

    const result = db.prepare(
      "INSERT INTO users (name, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(name, email, hashedPassword, role || "CASHIER", true, new Date(), new Date());

    res.status(201).json({
      success: true,
      data: {
        id: result.lastInsertRowid(),
        name,
        email,
        role: role || "CASHIER"
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user profile
router.get("/profile", auth, (req: Request, res: Response) => {
  try {
    // In production, get userId from JWT token
    // For now, return mock data
    res.json({
      success: true,
      data: {
        id: 1,
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN"
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout
router.post("/logout", auth, (req: Request, res: Response) => {
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;