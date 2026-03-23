# 10 - Error Handling & Recovery

## Comprehensive Error Management

## Overview

DocuTrust implements multi-layered error handling with detailed logging, graceful degradation, and automatic recovery mechanisms. This document covers all error types, responses, and recovery strategies.

## Error Classification

### By Severity Level

```
CRITICAL
  ├─ Database connection loss
  ├─ Blockchain RPC unreachable
  └─ Private key compromise
  
HIGH
  ├─ Validation failures
  ├─ Authorization failures
  ├─ Blockchain transaction failures
  └─ Payment required
  
MEDIUM
  ├─ Rate limiting
  ├─ Temporary network timeouts
  ├─ Partial data availability
  └─ Cache miss
  
LOW
  ├─ Deprecated feature warning
  └─ Non-critical logging
```

### By Layer

| Layer | Category | Examples |
|-------|----------|----------|
| **Frontend** | UI/UX errors | Invalid form input, component errors |
| **API** | HTTP errors | 400, 401, 403, 404, 429, 500 |
| **Business Logic** | Application errors | Validation, authorization, state conflicts |
| **Database** | Data layer errors | Connection, query, constraint violations |
| **Blockchain** | Web3 errors | RPC timeout, transaction failure, reverts |

## Error Response Format

### Standard Error Response

All API errors follow consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-12345",
    "details": {}
  }
}
```

### Error Code Taxonomy

```
AUTH_*        → Authentication & authorization
CERT_*        → Certificate operations
BATCH_*       → Batch operations
BLOCKCHAIN_*  → Blockchain interactions
DB_*          → Database operations
VALIDATION_*  → Input validation
RATE_*        → Rate limiting
SYSTEM_*      → System-level errors
```

## HTTP Status Codes

### 4xx Client Errors

```
400 Bad Request
├─ Invalid JSON
├─ Missing required fields
├─ Malformed data
└─ Invalid request format

401 Unauthorized
├─ Missing authentication token
├─ Invalid or expired token
└─ Token tampering detected

403 Forbidden
├─ Insufficient permissions
├─ Role mismatch
└─ Resource access denied

404 Not Found
├─ Certificate not found
├─ Batch not found
└─ User not found

409 Conflict
├─ Certificate ID already exists
├─ Batch already issued
└─ State transition not allowed

429 Too Many Requests
├─ Rate limit exceeded
├─ Quota exhausted
└─ Try again after X seconds
```

### 5xx Server Errors

```
500 Internal Error
├─ Unexpected exception
├─ Logic error
└─ Unknown state

502 Bad Gateway
├─ Database connection failure
├─ Blockchain RPC unreachable
└─ Upstream service failure

503 Service Unavailable
├─ Maintenance mode
├─ All workers busy
└─ Cascading failure
```

## Common Error Scenarios

### Authentication Errors

```typescript
// 1. Missing token
if (!req.headers.authorization) {
  return res.status(401).json({
    error: {
      code: 'AUTH_MISSING_TOKEN',
      message: 'Authorization header required',
      statusCode: 401
    }
  });
}

// 2. Invalid token format
if (!req.headers.authorization.startsWith('Bearer ')) {
  return res.status(401).json({
    error: {
      code: 'AUTH_INVALID_FORMAT',
      message: 'Authorization must be Bearer token',
      statusCode: 401
    }
  });
}

// 3. Expired token
if (token.expiresAt < new Date()) {
  return res.status(401).json({
    error: {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Token has expired. Please login again',
      statusCode: 401
    }
  });
}

// 4. Invalid token signature
if (!verifyToken(token)) {
  return res.status(401).json({
    error: {
      code: 'AUTH_INVALID_TOKEN',
      message: 'Token is invalid or tampered',
      statusCode: 401
    }
  });
}

// 5. Invalid credentials
async function loginUser(email, password) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });
  
  if (!user || !bcrypt.compare(password, user.passwordHash)) {
    // Don't reveal if email exists (security best practice)
    return res.status(401).json({
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        statusCode: 401
      }
    });
  }
}
```

### Validation Errors

```typescript
function validateCertificateInput(data) {
  const errors = [];
  
  // Required field
  if (!data.name || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      code: 'VALIDATION_REQUIRED',
      message: 'Name is required'
    });
  }
  
  // Length constraint
  if (data.name && data.name.length > 255) {
    errors.push({
      field: 'name',
      code: 'VALIDATION_LENGTH',
      message: 'Name must be less than 255 characters',
      max: 255,
      actual: data.name.length
    });
  }
  
  // Format validation
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push({
      field: 'date',
      code: 'VALIDATION_FORMAT',
      message: 'Date must be YYYY-MM-DD format',
      expected: 'YYYY-MM-DD',
      actual: data.date
    });
  }
  
  // Uniqueness (database check)
  if (await isDuplicateCertId(data.batchId, data.certificateId)) {
    errors.push({
      field: 'certificateId',
      code: 'VALIDATION_DUPLICATE',
      message: 'Certificate ID already exists in this batch'
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Input validation failed',
        statusCode: 400,
        details: errors
      }
    });
  }
}
```

### State Conflict Errors

```typescript
// Attempt operation on wrong batch status
async function issueBatch(batchId) {
  const batch = await db.query.certificateBatches.findFirst({
    where: eq(certificateBatches.id, batchId)
  });
  
  if (batch.status !== 'signed') {
    return res.status(409).json({
      error: {
        code: 'BATCH_INVALID_STATE',
        message: 'Batch must be in signed status to issue',
        statusCode: 409,
        details: {
          currentStatus: batch.status,
          expectedStatus: 'signed',
          allowedTransitions: ['signed']
        }
      }
    });
  }
}

// Duplicate operation prevention
async function createCertificate(batchId, data) {
  const existing = await db.query.certificateDocuments.findFirst({
    where: and(
      eq(certificateDocuments.batchId, batchId),
      eq(certificateDocuments.certificateId, data.certificateId)
    )
  });
  
  if (existing) {
    return res.status(409).json({
      error: {
        code: 'CERT_ALREADY_EXISTS',
        message: 'Certificate ID already exists in batch',
        statusCode: 409,
        details: {
          certificateId: data.certificateId,
          existingId: existing.id,
          batchId
        }
      }
    });
  }
}
```

### Blockchain Errors

```typescript
// Blockchain service unavailable
async function verifyDocument(hash) {
  try {
    const result = await blockchainService.verify(hash);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        error: {
          code: 'BLOCKCHAIN_SERVICE_UNAVAILABLE',
          message: 'Blockchain service temporarily unavailable',
          statusCode: 502,
          retry: {
            after: 30,  // seconds
            attempts: 3,
            backoff: 'exponential'
          }
        }
      });
    }
  }
}

// RPC timeout during verification
async function verifyWithTimeout(hash, timeoutMs = 30000) {
  try {
    return await Promise.race([
      blockchainService.verify(hash),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  } catch (error) {
    if (error.message === 'Timeout') {
      return res.status(504).json({
        error: {
          code: 'BLOCKCHAIN_TIMEOUT',
          message: 'Blockchain verification took too long',
          statusCode: 504,
          details: {
            timeout: timeoutMs,
            recommendation: 'Try again in a few moments'
          }
        }
      });
    }
  }
}

// Transaction reverted on-chain
async function handleBlockchainError(receipt) {
  if (receipt.status === 0) {  // Reverted transaction
    return res.status(400).json({
      error: {
        code: 'BLOCKCHAIN_REVERTED',
        message: 'Blockchain transaction was reverted',
        statusCode: 400,
        details: {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          reason: receipt.revertReason || 'Unknown reason'
        }
      }
    });
  }
}

// Insufficient gas
async function handleInsufficientGas() {
  return res.status(402).json({
    error: {
      code: 'BLOCKCHAIN_INSUFFICIENT_GAS',
      message: 'Insufficient gas to process transaction',
      statusCode: 402,
      details: {
        required: 'Calculate based on operation',
        available: 'Wallet balance'
      }
    }
  });
}
```

### Database Errors

```typescript
// Connection error
db.on('error', (error) => {
  console.error('Database connection error:', error);
  
  res.status(503).json({
    error: {
      code: 'DB_CONNECTION_ERROR',
      message: 'Database connection failed',
      statusCode: 503,
      retry: {
        after: 5,
        exponentialBackoff: true
      }
    }
  });
});

// Query timeout
db.query(...).timeout(5000)
  .catch(error => {
    if (error.code === 'QUERY_TIMEOUT') {
      return res.status(504).json({
        error: {
          code: 'DB_QUERY_TIMEOUT',
          message: 'Database query took too long',
          statusCode: 504
        }
      });
    }
  });

// Unique constraint violation
async function createCertificate(data) {
  try {
    await db.insert(certificateDocuments).values(data);
  } catch (error) {
    if (error.code === '23505') {  // PostgreSQL unique violation
      return res.status(409).json({
        error: {
          code: 'DB_UNIQUE_VIOLATION',
          message: 'Certificate ID already exists',
          statusCode: 409,
          details: {
            field: 'certificate_id',
            constraint: 'idx_cert_id_per_batch'
          }
        }
      });
    }
  }
}
```

## Error Handling Middleware

### Global Error Handler

**File**: [backend/middleware/error-handler.ts](backend/middleware/error-handler.ts)

```typescript
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.id || generateId();
  
  // Log error with context
  logger.error({
    requestId,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    statusCode: error.statusCode || 500
  });
  
  // Handle different error types
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 400,
        details: error.details,
        requestId
      }
    });
  }
  
  if (error instanceof AuthenticationError) {
    return res.status(401).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 401,
        requestId
      }
    });
  }
  
  if (error instanceof AuthorizationError) {
    return res.status(403).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 403,
        requestId
      }
    });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 404,
        requestId
      }
    });
  }
  
  if (error instanceof ConflictError) {
    return res.status(409).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 409,
        details: error.details,
        requestId
      }
    });
  }
  
  if (error instanceof BlockchainError) {
    return res.status(502).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 502,
        retry: error.retry,
        requestId
      }
    });
  }
  
  // Unknown error
  return res.status(500).json({
    error: {
      code: 'SYSTEM_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      requestId
    }
  });
}
```

## Retry Strategies

### Exponential Backoff

```typescript
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5,
  initialDelayMs: number = 100
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;  // Last attempt failed
      }
      
      // Calculate delay with exponential backoff
      // Delay = min(initialDelay * 2^attempt, maxDelay)
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        30000  // Max 30 second delay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * delay * 0.1;
      const totalDelay = delay + jitter;
      
      console.log(
        `Attempt ${attempt} failed. Retrying in ${totalDelay}ms...`
      );
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

// Example: Retry blockchain verification
const result = await retryWithExponentialBackoff(
  () => blockchainService.verify(hash),
  3,    // Max 3 attempts
  100   // Start with 100ms delay
);
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  
  constructor(
    private fn: () => Promise<any>,
    private failureThreshold = 5,
    private resetTimeoutMs = 60000
  ) {}
  
  async execute(): Promise<any> {
    // OPEN state: reject immediately
    if (this.isOpen()) {
      throw new Error('Circuit breaker is OPEN');
    }
    
    try {
      const result = await this.fn();
      
      // Success: transition towards CLOSED
      this.successCount++;
      if (this.successCount >= 2) {
        this.reset();  // Back to CLOSED
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();
      
      if (this.failureCount >= this.failureThreshold) {
        // OPEN: stop calling service
        console.warn('Circuit breaker OPEN: too many failures');
      }
      
      throw error;
    }
  }
  
  private isOpen(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
    
    // Try HALF-OPEN after timeout
    if (timeSinceFailure > this.resetTimeoutMs) {
      return false;
    }
    
    return this.failureCount >= this.failureThreshold;
  }
  
  private reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

// Usage
const breaker = new CircuitBreaker(
  () => blockchainService.verify(hash),
  5,      // Open after 5 failures
  60000   // Try again after 60 seconds
);

try {
  const result = await breaker.execute();
} catch (error) {
  // Handle circuit breaker OPEN
}
```

## Logging & Monitoring

### Structured Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File output
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Log error with context
logger.error({
  message: 'Certificate creation failed',
  error: error.message,
  stack: error.stack,
  userId: req.user.id,
  batchId: batchId,
  timestamp: new Date(),
  requestId: req.id
});
```

### Error Metrics

```typescript
// Track error rates
const errorCounter = new Counter({
  name: 'api_errors_total',
  help: 'Total API errors',
  labelNames: ['code', 'statusCode', 'endpoint']
});

// Track error latencies
const errorLatency = new Histogram({
  name: 'error_resolution_time_ms',
  help: 'Time to resolve errors',
  labelNames: ['code']
});

// On error
errorCounter.inc({
  code: error.code,
  statusCode: error.statusCode,
  endpoint: req.path
});
```

## Recovery Procedures

### Partial Data Loss

```typescript
// If batch partially created before failure
async function recoverPartialBatch(batchId: UUID) {
  // Check what exists
  const batch = await db.query.certificateBatches.findFirst({
    where: eq(certificateBatches.id, batchId)
  });
  
  const certs = await db.query.certificateDocuments.findMany({
    where: eq(certificateDocuments.batchId, batchId)
  });
  
  // Log recovery
  logger.info({
    message: 'Recovering partial batch',
    batchId,
    certificateCount: certs.length,
    batchStatus: batch?.status
  });
  
  // Return to user for retry/manual recovery
  return {
    recovered: true,
    batchStatus: batch?.status,
    certificateCount: certs.length,
    action: 'Please review and retry'
  };
}
```

### Blockchain Confirmation Polling

```typescript
async function pollBlockchainConfirmation(
  batchId: UUID,
  txHash: string,
  maxAttempts: number = 120  // ~30 mins for Mainnet
) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const receipt = await blockchainService.getTransactionReceipt(txHash);
      
      if (receipt && receipt.blockNumber) {
        // Confirmed!
        await db.update(certificateBatches)
          .set({
            blockchainStatus: 'confirmed',
            blockchainBlockNumber: receipt.blockNumber,
            blockchainConfirmedAt: new Date()
          })
          .where(eq(certificateBatches.id, batchId));
        
        return { confirmed: true };
      }
      
    } catch (error) {
      logger.warn({
        message: 'Polling error',
        batchId,
        txHash,
        attempt: attempts,
        error: error.message
      });
    }
    
    // Wait before next poll (increasing intervals)
    const delay = Math.min(1000 + attempts * 500, 15000);
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  
  // Max attempts reached
  await db.update(certificateBatches)
    .set({
      blockchainStatus: 'failed',
      blockchainFailReason: 'Confirmation timeout'
    })
    .where(eq(certificateBatches.id, batchId));
  
  return { confirmed: false, reason: 'timeout' };
}
```

## Graceful Degradation

### Fallback Paths

```typescript
// If blockchain unavailable, still allow verification lookup from cache
async function verifyWithFallback(hash: string) {
  try {
    // Primary: Query blockchain
    return await blockchainService.verify(hash);
  } catch (error) {
    // Secondary: Check local cache
    const cached = await redis.get(`verification:${hash}`);
    if (cached) {
      logger.warn('Using cached verification (blockchain unavailable)');
      return JSON.parse(cached);
    }
    
    // Tertiary: Mark as unable to verify
    return {
      status: 'unable_to_verify',
      reason: 'Blockchain temporarily unavailable',
      cached: false
    };
  }
}
```

### Service Health Checks

```typescript
async function healthCheck(): Promise<HealthStatus> {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    services: {}
  };
  
  // Check database
  try {
    await db.raw('SELECT 1');
    health.services.database = 'up';
  } catch {
    health.services.database = 'down';
    health.status = 'degraded';
  }
  
  // Check blockchain
  try {
    const blockNumber = await blockchainService.getBlockNumber();
    health.services.blockchain = 'up';
  } catch {
    health.services.blockchain = 'down';
    health.status = 'degraded';
  }
  
  return health;
}
```

## Error Documentation

Document all error codes users might encounter:

```markdown
# Common Error Codes

## Authentication Errors

### AUTH_MISSING_TOKEN
- Status: 401
- Cause: No Authorization header provided
- Solution: Include `Authorization: Bearer <token>` header

### AUTH_INVALID_CREDENTIALS
- Status: 401
- Cause: Wrong email or password
- Solution: Verify credentials and try again

## Certificate Errors

### CERT_ALREADY_EXISTS
- Status: 409
- Cause: Certificate ID already exists in batch
- Solution: Use unique certificate ID for this batch
```
