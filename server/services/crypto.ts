import { createHash, createSign, createVerify } from "crypto";

export class CryptoService {
  private static instance: CryptoService;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    // For demo purposes, using a fixed keypair. In production, this should be generated securely
    this.privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wEiyhkIm2Vn4vgYx8+qF+kKqZHqnDsKXnsYF3eLRYwKDrRJr0IcAJGQQQs/FQP2z
Fmgr+uHKHBSDXNGAzGJ7gQ9XZtBR7hVqjBiCp7vQmKyq7CQeF0Mm5BzX/kw9tJG9
xJWwLqVOWo2s8XeXr9uWOYtM1xR7z2J4Ks+YJO6+mGbq1VYdKwpE+o5D8h1LK8m
vFQHgQXOyD8nHAx5qG5nGfY1P+X7KvK1qEKW+qr5LYqYk2U7W2ZrN6O5fVm8Q3V
6q9m0w8U7D8u+mKx2CnLZ+j1J2W1CnVY1K5mKY1Y8wQ8H7o4z1v3hQ5lX3P0zY
AgMBAAECggEAALdwJqdKs6MhZV+ZdVy4WQQYJqFZYnuE2u4rBCBJ2EfjOmnZpNdg
KxqYfzqvJLz6TqQjH9mHWWtJK8yCg8xjLYTZrwM9+1K+YKmUhLQp9vb1qgQrJl5t
VL7J8+aE1H8H3YtKNJ1KQt8+3c1V2x5L7T9t1v4sE8O6g8I9VJKz8wHQ9sMxbzuL
Ip3G1j9n5zU8Y5oOJB8O6O8Q7jKz8pLF2Jz8H1a+X1uY4WkJL5u4E9zLqwYm9uo
Z8m8xrJ+KzqM5YW4a9lxQz5v2s6vQwX8dMnO4h7pBKUARAOdJzQNRF4B1u7OFMU
nOmB8C4E0SrOkH1W+lD4AXkUt9k1j9pV8xQ==
-----END PRIVATE KEY-----`;

    this.publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1L7VLPHCAV JghIFOl
Z+L4GMfPqhfpCqmR6pw7Cl57GBd3i0WMCg60Sa9CHACRkEELPxUD9sxZoK/rhyh
wUg1zRgMxie4EPV2bQUe4VaowYgqe70JisquwkHhdDJuQc1/5MPbSRvcSVsC6l
TlqNrPF3l6/bljmLTNcUe89ieCrPmCTuvphm6tVWHSsKRPqOQ/IdSyvJrxUB4E
FzfFUKARAOdJzQNRF4B1u7OFMUnOmB8C4E0SrOkH1W+lD4AXkUt9k1j9pV8xQ
wIDAQAB
-----END PUBLIC KEY-----`;
  }

  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * Compute SHA-256 hash of data
   */
  public computeHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create digital signature for data
   */
  public signData(data: string): string {
    const sign = createSign('RSA-SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKey, 'hex');
  }

  /**
   * Verify digital signature
   */
  public verifySignature(data: string, signature: string): boolean {
    try {
      const verify = createVerify('RSA-SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(this.publicKey, signature, 'hex');
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Convert CSV row to standardized data string for hashing
   */
  public csvRowToDataString(row: Record<string, any>): string {
    // Sort keys to ensure consistent hashing
    const sortedKeys = Object.keys(row).sort();
    const normalizedData = sortedKeys.map(key => `${key}:${row[key]}`).join('|');
    return normalizedData;
  }

  /**
   * Process CSV data and return hashes with signatures
   */
  public processDocumentData(csvData: Record<string, any>[]): Array<{
    originalData: Record<string, any>;
    dataString: string;
    hash: string;
    signature: string;
  }> {
    return csvData.map(row => {
      const dataString = this.csvRowToDataString(row);
      const hash = this.computeHash(dataString);
      const signature = this.signData(dataString);

      return {
        originalData: row,
        dataString,
        hash,
        signature,
      };
    });
  }

  /**
   * Extract and normalize document fields for verification
   */
  public extractDocumentFields(documentContent: string, fileName: string): Record<string, any> {
    // This is a simplified implementation. In production, you'd use proper document parsing
    // libraries to extract structured data from various document formats
    
    const fields: Record<string, any> = {
      fileName: fileName,
      contentLength: documentContent.length,
      // Extract potential structured data patterns
    };

    // Look for common patterns in document content
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
    const idPattern = /\b(?:ID|id|Id):\s*([A-Za-z0-9]+)\b/g;

    const emails = documentContent.match(emailPattern);
    const dates = documentContent.match(datePattern);
    const ids = documentContent.match(idPattern);

    if (emails) fields.emails = emails;
    if (dates) fields.dates = dates;
    if (ids) fields.ids = ids;

    // Extract first few lines as potential header information
    const lines = documentContent.split('\n').slice(0, 5);
    fields.headerLines = lines.filter(line => line.trim().length > 0);

    return fields;
  }
}

export const cryptoService = CryptoService.getInstance();
