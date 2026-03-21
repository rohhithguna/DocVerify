interface VerificationResultsProps {
  verification: {
    status?: "VALID" | "INVALID" | "REVOKED" | "NOT_FOUND" | "ORPHANED";
    message?: string;
    verification: any;
    results: {
      documentFound: boolean;
      isRevoked: boolean;
      digitalSignatureValid: boolean;
      merkleProofValid: boolean;
      blockchainVerified: boolean;
      confidenceScore: number;
      status?: "VALID" | "INVALID" | "REVOKED" | "NOT_FOUND" | "ORPHANED";
      matchedBatch?: {
        id: string;
        batchName: string;
        issuerName: string;
        createdAt: string;
        revoked?: boolean;
        revokedAt?: string;
      };
    };
  };
}

export default function VerificationResults({ verification }: VerificationResultsProps) {
  const { results } = verification;
  const verificationStatus =
    verification.status ||
    results.status ||
    (results.isRevoked ? "REVOKED" : results.confidenceScore >= 70 ? "VALID" : "INVALID");

  const displayConfidence =
    verificationStatus === "NOT_FOUND" || verificationStatus === "ORPHANED"
      ? 0
      : results.confidenceScore;

  const isValid = verificationStatus === "VALID";
  const isRevoked = verificationStatus === "REVOKED";
  const isNotFound = verificationStatus === "NOT_FOUND";
  const isOrphaned = verificationStatus === "ORPHANED";

  // Confidence ring SVG values
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (displayConfidence / 100) * circumference;

  return (
    <div data-testid="card-verification-results" className="fade-in">

      {/* ─── Status Banner (revoked / not found / orphaned) ─── */}
      {(isRevoked || isNotFound || isOrphaned) && (
        <div
          style={{
            padding: '16px 0 24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 24,
          }}
        >
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--invalid)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}>
            {isRevoked && '⛔ Document Revoked'}
            {isNotFound && 'Certificate Not Found'}
            {isOrphaned && 'Orphaned Certificate'}
          </div>
          <p style={{
            fontSize: 13,
            color: 'var(--muted-foreground)',
            lineHeight: 1.5,
          }}>
            {isRevoked
              ? 'This document was found on the blockchain but has been revoked by the issuer.'
              : isOrphaned
                ? (verification.message || 'Certificate deleted from system but exists on blockchain.')
                : (verification.message || 'Certificate not found in the system.')}
          </p>
          {isRevoked && results.matchedBatch?.revokedAt && (
            <p style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              marginTop: 8,
            }}>
              Revoked: {new Date(results.matchedBatch.revokedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ─── VALID / INVALID — Large, Bold ─── */}
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: isValid ? 'var(--valid)' : 'var(--invalid)',
          }}
          data-testid="text-verification-status"
        >
          {isValid ? 'VALID' : 'INVALID'}
        </span>
      </div>

      {/* ─── Confidence ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        marginBottom: 36,
      }}>
        {/* SVG Ring */}
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="44"
              cy="44"
              r={radius}
              strokeWidth="5"
              fill="transparent"
              stroke="var(--border)"
            />
            <circle
              cx="44"
              cy="44"
              r={radius}
              strokeWidth="5"
              fill="transparent"
              stroke={isValid ? 'var(--valid)' : 'var(--invalid)'}
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="confidence-ring"
            />
          </svg>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                fontVariantNumeric: 'tabular-nums',
              }}
              data-testid="text-confidence-score"
            >
              {displayConfidence}%
            </span>
          </div>
        </div>

        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Confidence
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>
            {displayConfidence >= 80
              ? 'High confidence verification'
              : displayConfidence >= 60
                ? 'Moderate confidence'
                : 'Low confidence — manual review recommended'}
          </div>
        </div>
      </div>

      {/* ─── Checks Breakdown — NO cards, NO boxes ─── */}
      <div style={{ marginBottom: 32 }}>
        <div className="check-row">
          <span className="check-label">Signature</span>
          <span
            className={`check-icon ${results.digitalSignatureValid ? 'valid' : 'invalid'}`}
            data-testid="text-signature-status"
          >
            {results.digitalSignatureValid ? '✔' : '✖'}
          </span>
        </div>
        <div className="check-row">
          <span className="check-label">Blockchain</span>
          <span
            className={`check-icon ${results.blockchainVerified ? 'valid' : 'invalid'}`}
            data-testid="text-blockchain-status"
          >
            {results.blockchainVerified ? '✔' : '✖'}
          </span>
        </div>
        <div className="check-row">
          <span className="check-label">Merkle Proof</span>
          <span
            className={`check-icon ${results.merkleProofValid ? 'valid' : 'invalid'}`}
            data-testid="text-merkle-status"
          >
            {results.merkleProofValid ? '✔' : '✖'}
          </span>
        </div>
      </div>

      {/* ─── Document Info — Minimal ─── */}
      {results.matchedBatch && (
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}>
            Document Information
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Issuer</span>
              <span
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}
                data-testid="text-issuer-name"
              >
                {results.matchedBatch.issuerName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Batch</span>
              <span
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}
                data-testid="text-batch-name"
              >
                {results.matchedBatch.batchName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Issue Date</span>
              <span
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}
                data-testid="text-issue-date"
              >
                {new Date(results.matchedBatch.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── No Match ─── */}
      {!results.documentFound && !isRevoked && !isNotFound && !isOrphaned && (
        <div style={{
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
          color: 'var(--muted-foreground)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          This document could not be matched against any verified batches in the system.
        </div>
      )}
    </div>
  );
}
