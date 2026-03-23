import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

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
            const missingFieldIssue = result.error.issues.find((issue) =>
                issue.code === "invalid_type" && "received" in issue && issue.received === "undefined"
            );
            const missingFieldPath = missingFieldIssue?.path.join(".") || "unknown";
            const missingFieldName = missingFieldIssue?.path.at(-1) || missingFieldPath;

            res.status(400).json({
                success: false,
                error: missingFieldIssue
                    ? `Missing field: ${missingFieldName}`
                    : "Invalid request data",
                message: missingFieldIssue
                    ? `Missing field: ${missingFieldName}`
                    : "Invalid request data",
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                })),
                ...(missingFieldIssue
                    ? {
                        field: missingFieldPath,
                        missingField: missingFieldName,
                    }
                    : {}),
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
            const missingFieldIssue = result.error.issues.find((issue) =>
                issue.code === "invalid_type" && "received" in issue && issue.received === "undefined"
            );
            const missingFieldPath = missingFieldIssue?.path.join(".") || "unknown";
            const missingFieldName = missingFieldIssue?.path.at(-1) || missingFieldPath;

            res.status(400).json({
                success: false,
                error: missingFieldIssue
                    ? `Missing field: ${missingFieldName}`
                    : "Invalid URL parameters",
                message: missingFieldIssue
                    ? `Missing field: ${missingFieldName}`
                    : "Invalid URL parameters",
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                })),
                ...(missingFieldIssue
                    ? {
                        field: missingFieldPath,
                        missingField: missingFieldName,
                    }
                    : {}),
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

export const documentIdParamSchema = z.object({
    id: z.string().uuid("Invalid document ID format"),
});

export const uploadBodySchema = z.object({
    batchName: z.string().min(1, "Batch name is required").max(200),
    issuerName: z.string().min(1, "Issuer name is required").max(200),
    groupingCriterion: z.enum(['department', 'date', 'type', 'organization', 'none'], {
        errorMap: () => ({ message: "Invalid grouping criterion" }),
    }),
});

export const revokeBodySchema = z.object({
    batchId: z.string().uuid("Invalid batch ID format"),
});

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const sha256Regex = /^[a-fA-F0-9]{64}$/;
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const base64ImageDataUrlRegex = /^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/;

const createCertificateBatchItemSchema = z.object({
    name: z.string()
        .min(1, "Name is required")
        .max(200, "Name too long"),
    course: z.string()
        .min(1, "Course is required")
        .max(500, "Course too long"),
    issuer: z.string()
        .min(1, "Issuer is required")
        .max(200, "Issuer too long"),
    date: z.string()
        .refine(isValidDate, "Invalid date format (use YYYY-MM-DD)")
        .optional()
        .default(() => new Date().toISOString().split('T')[0]),
    certificateId: z.string()
        .min(1, "Certificate ID is required")
        .max(50, "Certificate ID too long")
        .regex(/^[A-Za-z0-9-]+$/, "Certificate ID can only contain letters, numbers, and hyphens"),
});

export const createCertificateBodySchema = z.object({
    holder: z.object({
        name: z.string().trim().min(3, "holder.name must be at least 3 characters").max(200),
        studentId: z.string().trim().min(1, "holder.studentId is required").max(100),
        email: z.string()
          .email("holder.email must be a valid email address")
          .refine(e => /^[^@\s]{1,64}@[^@\s]{1,255}\.[a-zA-Z]{2,}$/.test(e), "Invalid email format")
          .optional(),
    }),
    certificateDetails: z.object({
        certificateId: z.string().trim().min(1, "certificateDetails.certificateId is required").max(100),
        course: z.string().trim().min(1, "certificateDetails.course is required").max(500),
        level: z.enum(["Beginner", "Intermediate", "Advanced"], {
            errorMap: () => ({ message: "certificateDetails.level must be Beginner, Intermediate, or Advanced" }),
        }),
        duration: z.string().trim().min(1, "certificateDetails.duration is required").max(120),
        grade: z.string().trim().max(40).optional(),
    }),
    issuer: z.object({
        issuerName: z.string().trim().min(1, "issuer.issuerName is required").max(200),
        issuerId: z.string().trim().min(1, "issuer.issuerId is required").max(100),
        issuerWallet: z.string()
          .trim()
          .regex(ethereumAddressRegex, "issuer.issuerWallet must be a valid Ethereum address")
          .refine(addr => {
            if (!/^0x[0-9a-f]{40}$/.test(addr)) return !/^0x[0-9A-F]{40}$/.test(addr);
            return true;
          }, "Ethereum address checksum may be invalid"),
    }),
    validity: z.object({
        issueDate: z.string().refine(isValidDate, "validity.issueDate must be a valid date (YYYY-MM-DD)"),
        expiryDate: z.string().refine(isValidDate, "validity.expiryDate must be a valid date (YYYY-MM-DD)"),
        status: z.enum(["ACTIVE", "REVOKED"], {
            errorMap: () => ({ message: "validity.status must be ACTIVE or REVOKED" }),
        }),
    }),
    security: z.object({
        hash: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
            z.string().regex(sha256Regex, "security.hash must be a valid SHA-256 hex digest").optional()
        ),
        txHash: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
            z.string().trim().optional()
        ),
        merkleRoot: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
            z.string().trim().optional()
        ),
    }),
    signature: z.object({
        signature: z.string()
            .trim()
            .min(1, "signature.signature is required")
            .refine(
                (value) => base64Regex.test(value) || base64ImageDataUrlRegex.test(value),
                "signature.signature must be a valid base64 string or data URL"
            ),
        signedBy: z.string().trim().min(1, "signature.signedBy is required").max(200),
    }),
    verification: z.object({
        qrCodeUrl: z.string().url("verification.qrCodeUrl must be a valid URL"),
    }),
}).superRefine((data, ctx) => {
    const issue = new Date(data.validity.issueDate);
    const expiry = new Date(data.validity.expiryDate);

    if (Number.isNaN(issue.getTime())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["validity", "issueDate"],
            message: "validity.issueDate is invalid",
        });
    }

    if (Number.isNaN(expiry.getTime())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["validity", "expiryDate"],
            message: "validity.expiryDate is invalid",
        });
    }

    if (!Number.isNaN(issue.getTime()) && !Number.isNaN(expiry.getTime()) && expiry <= issue) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["validity", "expiryDate"],
            message: "validity.expiryDate must be later than validity.issueDate",
        });
    }
});

    export const createCertificateBatchBodySchema = z.object({
        certificates: z.array(createCertificateBatchItemSchema)
        .min(1, "At least one certificate is required")
        .max(1000, "Maximum 1000 certificates per batch"),
    });

export async function validateCreateCertificateUniqueness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { holder, certificateDetails } = req.body as z.infer<typeof createCertificateBodySchema>;

        const [existingByCertificateId, existingByStudentId] = await Promise.all([
            storage.getCertificateByCertificateId(certificateDetails.certificateId),
            storage.getCertificateByStudentId(holder.studentId),
        ]);

        if (existingByCertificateId) {
            res.status(409).json({
                success: false,
                error: "DUPLICATE_CERTIFICATE",
                message: "Certificate already exists",
                details: [{ field: "certificateDetails.certificateId", message: "Certificate already exists" }],
            });
            return;
        }

        if (existingByStudentId) {
            res.status(409).json({
                success: false,
                error: "DUPLICATE_CERTIFICATE",
                message: "Certificate already exists",
                details: [{ field: "holder.studentId", message: "Certificate already exists" }],
            });
            return;
        }

        next();
    } catch (error) {
        next(error);
    }
}

// Verifier Schemas
export const verifierIdParamSchema = z.object({
    verifierId: z.string().min(1, "Verifier ID is required").max(100),
});

export const certificateIdParamSchema = z.object({
    certificateId: z.string()
        .min(1, "Certificate ID is required")
        .max(50, "Certificate ID too long")
        .regex(/^[A-Za-z0-9-]+$/, "Certificate ID can only contain letters, numbers, and hyphens"),
});

export const verifyBodySchema = z.object({
    verifierId: z.string().min(1, "Verifier ID is required").max(100),
});

export const verifyMetadataBodySchema = z.object({
    verifierId: z.string().min(1, "Verifier ID is required").max(100),
    name: z.string().min(1, "Name is required").max(200),
    course: z.string().min(1, "Course is required").max(500),
    issuer: z.string().min(1, "Issuer is required").max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (use YYYY-MM-DD)"),
    certificateId: z.string()
        .min(1, "Certificate ID is required")
        .max(50, "Certificate ID too long")
        .regex(/^[A-Za-z0-9-]+$/, "Certificate ID can only contain letters, numbers, and hyphens"),
});

// Type exports for use in controllers
export type UploadBody = z.infer<typeof uploadBodySchema>;
export type CreateCertificateBody = z.infer<typeof createCertificateBodySchema>;
export type CreateCertificateBatchBody = z.infer<typeof createCertificateBatchBodySchema>;
export type VerifyBody = z.infer<typeof verifyBodySchema>;
export type VerifyMetadataBody = z.infer<typeof verifyMetadataBodySchema>;
