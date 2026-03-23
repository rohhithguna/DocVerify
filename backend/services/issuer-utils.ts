/**
 * Utility functions for issuer data normalization and validation.
 */

/**
 * Normalizes issuer data from various formats into a standardized string.
 * Handles both string and object formats with common property names.
 * 
 * @param issuerValue - The issuer value in various possible formats
 * @returns The normalized issuer string, trimmed and empty if invalid
 */
export function normalizeIssuer(issuerValue: unknown): string {
  // If it's already a string, just trim it
  if (typeof issuerValue === "string") {
    return issuerValue.trim();
  }

  // If it's an object, try common property names
  if (typeof issuerValue === "object" && issuerValue !== null) {
    const issuerObj = issuerValue as Record<string, unknown>;
    
    // Try 'name' property first
    if (typeof issuerObj.name === "string") {
      return issuerObj.name.trim();
    }
    
    // Try 'issuerName' property
    if (typeof issuerObj.issuerName === "string") {
      return issuerObj.issuerName.trim();
    }

    // Try 'issuer' property as fallback
    if (typeof issuerObj.issuer === "string") {
      return issuerObj.issuer.trim();
    }
  }

  // Return empty string if unable to normalize
  return "";
}

/**
 * Validates that the issuer has been properly normalized.
 * 
 * @param normalizedIssuer - The normalized issuer string
 * @returns true if the issuer is valid, false otherwise
 */
export function isValidNormalizedIssuer(normalizedIssuer: unknown): boolean {
  return typeof normalizedIssuer === "string" && normalizedIssuer.length > 0;
}

/**
 * Normalizes and validates issuer in one operation.
 * Throws an error with a descriptive message if invalid.
 * 
 * @param issuerValue - The issuer value to normalize
 * @param errorMessage - Custom error message (optional)
 * @returns The validated normalized issuer string
 * @throws BadRequestError if the issuer cannot be normalized or is empty
 */
export function normalizeAndValidateIssuer(
  issuerValue: unknown,
  errorMessage: string = "Invalid issuer format"
): string {
  const normalized = normalizeIssuer(issuerValue);
  
  if (!isValidNormalizedIssuer(normalized)) {
    throw new Error(errorMessage);
  }

  return normalized;
}
