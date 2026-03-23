import { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";

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

// Strict JWT secret validation - reject any weak or default values
const forbiddenPatterns = [
  /^default$/i,
  /docutrust.*dev|dev.*secret/i,
  /change.*production|replace.*with/i,
  /^[a-z]+$/i, // All lowercase letters
  /^[A-Z]+$/i, // All uppercase letters
  /^[0-9]+$/, // All digits
];

if (JWT_SECRET_RAW.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters (use strong random value)");
}

for (const pattern of forbiddenPatterns) {
  if (pattern.test(JWT_SECRET_RAW)) {
    throw new Error("JWT_SECRET contains forbidden pattern - use strong random value");
  }
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

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
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
    if (!safeEqual(signature, expectedSignature)) return null;

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
  return safeEqual(computed, hash);
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

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOriginHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * Basic CSRF mitigation for browser-based requests:
 * - mutating methods must come from same host or configured trusted origin
 * - non-browser clients without Origin header are allowed
 */
export function requireTrustedOriginForMutations(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const originHost = parseOriginHost(req.headers.origin);
  if (!originHost) {
    next();
    return;
  }

  const trustedHosts = new Set<string>();
  if (req.headers.host) trustedHosts.add(req.headers.host);

  const configuredOrigins = [process.env.FRONTEND_ORIGIN, process.env.APP_ORIGIN]
    .map((value) => parseOriginHost(value))
    .filter((value): value is string => Boolean(value));

  configuredOrigins.forEach((host) => trustedHosts.add(host));

  if (!trustedHosts.has(originHost)) {
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }

  next();
}

