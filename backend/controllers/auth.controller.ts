import type { Request, Response } from "express";
import { compare, hash } from "bcryptjs";
import { storage } from "../storage";
import {
  createToken,
  type AuthRequest,
} from "../middleware/auth";

const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, organization } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password || !name) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["email", "password", "name"],
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    // Check if email already exists
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password and create user
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const user = await storage.createUser({
      email: normalizedEmail,
      passwordHash,
      name,
      organization: organization || null,
      role: "issuer",
    });

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Find user
    const user = await storage.getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const validPassword = await compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
}

/**
 * GET /api/auth/me — Get current user info
 */
export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      role: user.role,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({ error: "Failed to get user info" });
  }
}
