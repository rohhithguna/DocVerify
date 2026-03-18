import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";

// Custom error classes
export class AppError extends Error {
    public statusCode: number;
    public code: string;
    public isOperational: boolean;

    constructor(message: string, statusCode: number, code: string = "ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = "Resource") {
        super(`${resource} not found`, 404, "NOT_FOUND");
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized access") {
        super(message, 403, "UNAUTHORIZED");
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = "Invalid request") {
        super(message, 400, "BAD_REQUEST");
    }
}

export class ConflictError extends AppError {
    constructor(message: string = "Resource conflict") {
        super(message, 409, "CONFLICT");
    }
}

export class InternalError extends AppError {
    constructor(message: string = "Internal server error") {
        super(message, 500, "INTERNAL_ERROR");
    }
}

// Centralized error handler middleware
export const errorHandler: ErrorRequestHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Log error
    console.error(`[ERROR] ${new Date().toISOString()}:`, {
        path: req.path,
        method: req.method,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    // Handle known operational errors
    if (err instanceof AppError && err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
        });
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: (err as any).issues,
        });
    }

    // Handle multer errors (file upload)
    if (err.name === 'MulterError') {
        return res.status(400).json({
            error: "FILE_UPLOAD_ERROR",
            message: err.message,
        });
    }

    // Handle unknown/programming errors
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production'
        ? "An unexpected error occurred"
        : err.message;

    return res.status(500).json({
        error: "INTERNAL_ERROR",
        message,
    });
};

// 404 handler for unknown routes
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        error: "NOT_FOUND",
        message: `Route ${req.method} ${req.path} not found`,
    });
};

// Async wrapper to catch errors in async route handlers
export const asyncHandler = <T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
