import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

type CertificateLookupResponse = {
  certificateId: string;
  holderName: string;
  course: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  status: "ACTIVE" | "REVOKED" | "DELETED";
  blockchainStatus?: "CONFIRMED" | "PENDING" | "FAILED";
  hash: string;
};

async function fetchCertificate(certificateId: string): Promise<CertificateLookupResponse> {
  const response = await fetch(`/api/certificate/${encodeURIComponent(certificateId)}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || payload?.message || "Certificate not found";
    throw new Error(message);
  }
  return response.json();
}

export default function VerifyCertificatePage() {
  const navigate = useNavigate();
  const params = useParams<{ certificateId: string }>();
  const certificateId = params.certificateId || "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificate-lookup", certificateId],
    queryFn: () => fetchCertificate(certificateId),
    enabled: !!certificateId,
    retry: false,
  });

  const isValid = data && data.status === "ACTIVE";
  const isRevoked = data && data.status === "REVOKED";

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      {/* Floating Nav */}
      <nav className="floating-nav">
        <button onClick={() => navigate("/verify")}>Verify</button>
        <button onClick={() => navigate("/")}>Home</button>
      </nav>

      <div style={{ maxWidth: 520, width: '100%' }} className="fade-in">

        {/* Status */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          {isLoading ? (
            <div data-testid="verify-loading">
              <div
                className="animate-spin"
                style={{
                  width: 28,
                  height: 28,
                  border: '2px solid var(--border)',
                  borderTopColor: 'var(--foreground)',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                Checking certificate…
              </span>
            </div>
          ) : isError || !data ? (
            <div data-testid="verify-not-found">
              <div style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--invalid)',
                marginBottom: 8,
              }}>
                NOT FOUND
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                Certificate does not exist in the system.
              </p>
            </div>
          ) : isRevoked ? (
            <div data-testid="verify-revoked">
              <div style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--invalid)',
                marginBottom: 8,
              }}>
                REVOKED
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                This certificate has been revoked by the issuer.
              </p>
            </div>
          ) : (
            <div data-testid="verify-valid">
              <div style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--valid)',
                marginBottom: 8,
              }}>
                VALID
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                Certificate is active and verified.
              </p>
            </div>
          )}
        </div>

        {/* Details */}
        <div data-testid="verify-details" style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 20,
          }}>
            Certificate Details
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DetailRow label="Certificate ID" value={certificateId} mono />
            {data && (
              <>
                <DetailRow label="Holder" value={data.holderName} />
                <DetailRow label="Course" value={data.course} />
                <DetailRow label="Issuer" value={data.issuer} />
                <DetailRow label="Issue Date" value={data.issueDate} />
                <DetailRow label="Expiry Date" value={data.expiryDate} />
                <DetailRow
                  label="Status"
                  value={data.status}
                  color={isValid ? 'var(--valid)' : 'var(--invalid)'}
                />
                <DetailRow label="Hash" value={data.hash} mono breakAll />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  breakAll,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
  color?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 24,
    }}>
      <span style={{ fontSize: 13, color: 'var(--muted-foreground)', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: color || 'var(--foreground)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        wordBreak: breakAll ? 'break-all' : undefined,
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}
