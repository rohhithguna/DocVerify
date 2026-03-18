import rateLimit from "express-rate-limit";

// General API rate limiter
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: {
        error: "Too Many Requests",
        message: "You have exceeded the rate limit. Please try again later.",
        retryAfter: "15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for upload/creation endpoints
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each IP to 50 uploads per hour
    message: {
        error: "Too Many Uploads",
        message: "You have exceeded the upload rate limit. Please try again later.",
        retryAfter: "1 hour",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for verification endpoint (more lenient)
export const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 verifications per 15 min
    message: {
        error: "Too Many Verification Requests",
        message: "You have exceeded the verification rate limit. Please try again later.",
        retryAfter: "15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict limiter for blockchain status (expensive operation)
export const blockchainLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute
    message: {
        error: "Too Many Blockchain Requests",
        message: "Please wait before checking blockchain status again.",
        retryAfter: "1 minute",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
