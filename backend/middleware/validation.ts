import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// Custom error class for validation errors
export class ValidationError extends Error {
    public statusCode = 400;
    public details: z.ZodIssue[];

    constructor(issues: z.ZodIssue[]) {
        const message = issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        super(message);
        this.name = 'ValidationError';
        this.details = issues;
    }
}

// Validation middleware factory
export function validateBody<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: "Validation Error",
                message: "Invalid request data",
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                })),
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            res.status(400).json({
                error: "Validation Error",
                message: "Invalid URL parameters",
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                })),
            });
            return;
        }
        req.params = result.data;
        next();
    };
}

// ============================================
// API Request Schemas
// ============================================

// Issuer Schemas
export const issuerIdParamSchema = z.object({
    issuerId: z.string().min(1, "Issuer ID is required").max(100),
});

export const batchIdParamSchema = z.object({
    issuerId: z.string().min(1, "Issuer ID is required").max(100),
    batchId: z.string().uuid("Invalid batch ID format"),
});

export const uploadBodySchema = z.object({
    batchName: z.string().min(1, "Batch name is required").max(200),
    issuerId: z.string().min(1, "Issuer ID is required").max(100),
    issuerName: z.string().min(1, "Issuer name is required").max(200),
    groupingCriterion: z.enum(['department', 'date', 'type', 'organization', 'none'], {
        errorMap: () => ({ message: "Invalid grouping criterion" }),
    }),
});

export const createCertificateBodySchema = z.object({
    recipientName: z.string()
        .min(1, "Recipient name is required")
        .max(200, "Recipient name too long"),
    certificateTitle: z.string()
        .max(200, "Certificate title too long")
        .optional()
        .default("of Achievement"),
    eventName: z.string()
        .min(1, "Event name is required")
        .max(500, "Event name too long"),
    issueDate: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (use YYYY-MM-DD)")
        .optional(),
    issuerName: z.string()
        .min(1, "Issuer name is required")
        .max(200, "Issuer name too long"),
    certificateId: z.string()
        .min(1, "Certificate ID is required")
        .max(50, "Certificate ID too long")
        .regex(/^[A-Za-z0-9-]+$/, "Certificate ID can only contain letters, numbers, and hyphens"),
    imageData: z.string()
        .min(1, "Image data is required")
        .refine(
            (val) => val.startsWith('data:image/') || val.length > 100,
            "Invalid image data format"
        ),
});

// Verifier Schemas
export const verifierIdParamSchema = z.object({
    verifierId: z.string().min(1, "Verifier ID is required").max(100),
});

export const verifyBodySchema = z.object({
    verifierId: z.string().min(1, "Verifier ID is required").max(100),
});

// Type exports for use in controllers
export type UploadBody = z.infer<typeof uploadBodySchema>;
export type CreateCertificateBody = z.infer<typeof createCertificateBodySchema>;
export type VerifyBody = z.infer<typeof verifyBodySchema>;
