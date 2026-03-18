import { createHash, createSign, createVerify } from "crypto";

export class CryptoService {
  private static instance: CryptoService;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    // Load keys from environment variables - SECURITY FIX for BUG #2
    const privateKey = process.env.SIGNING_PRIVATE_KEY;
    const publicKey = process.env.SIGNING_PUBLIC_KEY;

    if (!privateKey || !publicKey) {
      throw new Error(
        'Missing required environment variables:\n' +
        '  - SIGNING_PRIVATE_KEY (RSA private key in PEM format)\n' +
        '  - SIGNING_PUBLIC_KEY (RSA public key in PEM format)\n' +
        'Please set these environment variables with valid RSA keys.'
      );
    }

    // Validate key format (basic check)
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !publicKey.includes('BEGIN PUBLIC KEY')) {
      throw new Error(
        'Invalid key format:\n' +
        '  - SIGNING_PRIVATE_KEY must be in PEM format (BEGIN PRIVATE KEY)\n' +
        '  - SIGNING_PUBLIC_KEY must be in PEM format (BEGIN PUBLIC KEY)'
      );
    }

    this.privateKey = privateKey;
    this.publicKey = publicKey;

    console.log('✓ Cryptographic keys loaded from environment variables');
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
