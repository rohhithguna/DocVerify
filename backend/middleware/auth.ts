import { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, pbkdf2Sync } from "crypto";

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ──────────────────────────────────────────────
//  Simple JWT Implementation (no external deps)
// ──────────────────────────────────────────────

const JWT_SECRET_RAW = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_EXPIRY_HOURS = 24;

if (!JWT_SECRET_RAW) {
  throw new Error("JWT_SECRET is required and must be provided via environment variables");
}

if (JWT_SECRET_RAW === "default" || JWT_SECRET_RAW === "docutrust-dev-secret") {
  throw new Error("JWT_SECRET must not use a default or development value");
}

const normalizedSecret = JWT_SECRET_RAW.toLowerCase();
if (
  JWT_SECRET_RAW.length < 32 ||
  normalizedSecret.includes("change-in-production") ||
  normalizedSecret.includes("replace-with") ||
  normalizedSecret.includes("dev-secret")
) {
  throw new Error("JWT_SECRET is too weak. Use a strong random value (minimum 32 characters).");
}

const JWT_SECRET: string = JWT_SECRET_RAW;

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Create a JWT token from user data.
 */
export function createToken(payload: JwtPayload): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = base64url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + JWT_EXPIRY_HOURS * 3600,
    })
  );

  const signature = sign(`${header}.${tokenPayload}`, JWT_SECRET);
  return `${header}.${tokenPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    // Verify signature
    const expectedSignature = sign(`${header}.${payload}`, JWT_SECRET);
    if (signature !== expectedSignature) return null;

    // Decode payload
    const decoded = JSON.parse(base64urlDecode(payload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) return null;

    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
//  Password Hashing (using Node.js crypto — no bcrypt needed)
// ──────────────────────────────────────────────

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

/**
 * Hash a password with a random salt using PBKDF2.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computed = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512").toString("hex");
  return computed === hash;
}

// ──────────────────────────────────────────────
//  Express Middleware
// ──────────────────────────────────────────────

/**
 * Middleware: Require valid JWT token.
 * Attaches user payload to req.user.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = payload;
  next();
}

