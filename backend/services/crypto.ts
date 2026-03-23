import { createHash, createSign, createVerify } from "crypto";

export type CertificateHashInput = {
  name: string;
  course: string;
  issuer: string;
  date: string;
  certificateId: string;
};

// Secure key loader - prevents keys from being logged/exposed
function loadSigningKeys(): { privateKey: string; publicKey: string } {
  const privateKey = process.env.SIGNING_PRIVATE_KEY;
  const publicKey = process.env.SIGNING_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error('Missing required cryptographic keys');
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY') || !publicKey.includes('BEGIN PUBLIC KEY')) {
    throw new Error('Invalid cryptographic key format');
  }

  return { privateKey, publicKey };
}

export class CryptoService {
  private static instance: CryptoService;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    try {
      const keys = loadSigningKeys();
      this.privateKey = keys.privateKey;
      this.publicKey = keys.publicKey;
    } catch (error) {
      throw new Error('Failed to load cryptographic keys: check environment configuration');
    }

    console.log('✓ Cryptographic keys loaded from environment variables');
  }

  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  // OPTIMIZATION: Extract issuer normalization logic (used in multiple places)
  normalizeIssuer(issuerValue: unknown): string {
    if (typeof issuerValue === "string") {
      return issuerValue.trim();
    }
    if (typeof (issuerValue as { name?: unknown })?.name === "string") {
      return String((issuerValue as { name?: string }).name).trim();
    }
    if (typeof (issuerValue as { issuerName?: unknown })?.issuerName === "string") {
      return String((issuerValue as { issuerName?: string }).issuerName).trim();
    }
    return "";
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
   * Build canonical certificate data object used for both issuance and verification.
   * Supports legacy field names to keep backward compatibility.
   */
  public buildCanonicalCertificateData(input: Record<string, any>): CertificateHashInput {
    const name = String(input.name ?? input.recipientName ?? '').trim();
    const course = String(input.course ?? input.eventName ?? '').trim();
    const issuerSource = input.issuer ?? input.issuerName ?? '';
    const issuer = (() => {
      if (typeof issuerSource === 'string') {
        return issuerSource.trim();
      }

      if (issuerSource && typeof issuerSource === 'object') {
        const maybeName = (issuerSource as Record<string, unknown>).name;
        const maybeIssuerName = (issuerSource as Record<string, unknown>).issuerName;

        if (typeof maybeName === 'string') {
          return maybeName.trim();
        }

        if (typeof maybeIssuerName === 'string') {
          return maybeIssuerName.trim();
        }
      }

      return '';
    })();
    const date = String(input.date ?? input.issueDate ?? '').trim();
    const certificateId = String(input.certificateId ?? '').trim();

    return {
      name,
      course,
      issuer,
      date,
      certificateId,
    };
  }

  /**
   * Serialize certificate data for hashing/signing. This must stay identical everywhere.
   */
  public certificateDataToHashString(data: CertificateHashInput): string {
    return JSON.stringify(data);
  }

  /**
   * Compute certificate hash from canonical JSON data.
   */
  public computeCertificateHash(data: CertificateHashInput): string {
    return this.computeHash(this.certificateDataToHashString(data));
  }
}

export const cryptoService = CryptoService.getInstance();
