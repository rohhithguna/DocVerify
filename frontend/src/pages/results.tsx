import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

/* ─── Types ─── */
interface VerificationData {
  status?: "VALID" | "INVALID" | "REVOKED" | "NOT_FOUND" | "ORPHANED";
  message?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt?: string;
  verification?: any;
  results: {
    documentFound: boolean;
    isRevoked: boolean;
    digitalSignatureValid: boolean;
    merkleProofValid: boolean;
    blockchainVerified: boolean;
    confidenceScore: number;
    status?: "VALID" | "INVALID" | "REVOKED" | "NOT_FOUND" | "ORPHANED";
    documentHash?: string;
    matchedBatch?: {
      id: string;
      batchName: string;
      issuerName: string;
      createdAt: string;
      revoked?: boolean;
      revokedAt?: string;
    };
  };
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const data = location.state?.verification as VerificationData | undefined;

  useEffect(() => {
    if (!data) {
      navigate("/verify", { replace: true });
      return;
    }
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [data, navigate]);

  if (!data) return null;

  const { results } = data;
  const verificationStatus =
    data.status ||
    results.status ||
    (results.isRevoked ? "REVOKED" : results.confidenceScore >= 70 ? "VALID" : "INVALID");

  const isVerified = verificationStatus === "VALID";
  const confidence = verificationStatus === "NOT_FOUND" || verificationStatus === "ORPHANED"
    ? 0
    : results.confidenceScore;

  /* Confidence ring */
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (confidence / 100) * circumference;

  /* Shorten hash */
  const shortHash = results.documentHash
    ? `${results.documentHash.slice(0, 8)}…${results.documentHash.slice(-8)}`
    : "—";

  /* Checks array */
  const checks = [
    {
      label: "QR Metadata",
      passed: results.documentFound,
      passText: "Valid",
      failText: "Invalid",
    },
    {
      label: "Blockchain Match",
      passed: results.blockchainVerified,
      passText: "Found",
      failText: "Not Found",
    },
    {
      label: "Tampering Check",
      passed: results.digitalSignatureValid,
      passText: "Passed",
      failText: "Failed",
    },
    {
      label: "Merkle Proof",
      passed: results.merkleProofValid,
      passText: "Verified",
      failText: "Missing",
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)" }}
    >
      {/* ─── Floating Nav ─── */}
      <nav className="floating-nav">
        <button onClick={() => navigate("/verify")} data-testid="nav-verify">
          Verify
        </button>
        <button className="active" data-testid="nav-results">
          Results
        </button>
        <button onClick={() => navigate("/verify", { state: { view: "dashboard" } })} data-testid="nav-dashboard">
          Dashboard
        </button>
        <button onClick={() => navigate("/")} data-testid="nav-home">
          Home
        </button>
      </nav>

      {/* ─── Content ─── */}
      <div
        className={`page-transition ${visible ? "page-visible" : ""}`}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "112px 24px 80px",
        }}
      >
        {/* ═══ A. STATUS CARD ═══ */}
        <div className="result-card" style={{ marginBottom: 24 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}>
            {/* Confidence Ring */}
            <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
              <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                <circle
                  cx="50" cy="50" r={radius}
                  strokeWidth="5" fill="transparent"
                  stroke="var(--border)"
                />
                <circle
                  cx="50" cy="50" r={radius}
                  strokeWidth="5" fill="transparent"
                  stroke={isVerified ? "var(--valid)" : "var(--invalid)"}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="confidence-ring"
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontSize: 22, fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--foreground)",
                }}>
                  {confidence}%
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 28, fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: isVerified ? "var(--valid)" : "var(--invalid)",
                }}>
                  {isVerified ? "Verified" : "Failed"}
                </span>
                <span style={{ fontSize: 22 }}>
                  {isVerified ? "✅" : "❌"}
                </span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                Confidence Score
              </span>
            </div>
          </div>
        </div>

        {/* ═══ B. DOCUMENT DETAILS ═══ */}
        <div className="result-card" style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 20,
          }}>
            Document Details
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <DetailRow label="File Name" value={data.fileName || "—"} />
            <DetailRow label="Type" value={data.fileType || "Document"} />
            <DetailRow
              label="Uploaded"
              value={data.uploadedAt
                ? new Date(data.uploadedAt).toLocaleString()
                : new Date().toLocaleString()}
            />
            <DetailRow label="Hash ID" value={shortHash} mono />
          </div>
        </div>

        {/* ═══ C. VERIFICATION BREAKDOWN ═══ */}
        <div className="result-card" style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 20,
          }}>
            Verification Breakdown
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {checks.map((check, i) => (
              <div
                key={check.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: check.passed
                      ? "rgba(22, 163, 74, 0.08)"
                      : "rgba(220, 38, 38, 0.08)",
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontSize: 14,
                      color: check.passed ? "var(--valid)" : "var(--invalid)",
                    }}>
                      {check.passed ? "✓" : "✗"}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 500,
                    color: "var(--foreground)",
                  }}>
                    {check.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: check.passed ? "var(--valid)" : "var(--invalid)",
                }}>
                  {check.passed ? check.passText : check.failText}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ D. USER GUIDANCE ═══ */}
        <div className="result-card" style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 16,
          }}>
            {isVerified ? "Status" : "Recommended Actions"}
          </div>

          {isVerified ? (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "16px 20px",
              background: "rgba(22, 163, 74, 0.04)",
              borderRadius: 12,
              border: "1px solid rgba(22, 163, 74, 0.12)",
            }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>✅</span>
              <div>
                <p style={{
                  fontSize: 14, fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: 4,
                }}>
                  This document is authentic.
                </p>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  All verification checks passed. No further action needed.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{
                padding: "14px 20px",
                background: "rgba(220, 38, 38, 0.03)",
                borderRadius: 12,
                border: "1px solid rgba(220, 38, 38, 0.08)",
              }}>
                <p style={{
                  fontSize: 14, fontWeight: 500, color: "var(--foreground)",
                  marginBottom: 2,
                }}>
                  Verification could not be completed.
                </p>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Please try the following steps:
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
                <GuidanceStep number={1} text="Re-upload the original document file (not a screenshot or copy)." />
                <GuidanceStep number={2} text="Ensure the QR code on the certificate is clearly visible and undamaged." />
                <GuidanceStep number={3} text="Contact the certificate issuer to confirm the document's validity." />
              </div>
            </div>
          )}
        </div>

        {/* ═══ Issuer / Batch Info ═══ */}
        {results.matchedBatch && (
          <div className="result-card" style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 20,
            }}>
              Issuer Information
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DetailRow label="Issuer" value={results.matchedBatch.issuerName} />
              <DetailRow label="Batch" value={results.matchedBatch.batchName} mono />
              <DetailRow
                label="Issued"
                value={new Date(results.matchedBatch.createdAt).toLocaleDateString()}
              />
              {results.matchedBatch.revoked && results.matchedBatch.revokedAt && (
                <DetailRow
                  label="Revoked"
                  value={new Date(results.matchedBatch.revokedAt).toLocaleString()}
                  color="var(--invalid)"
                />
              )}
            </div>
          </div>
        )}

        {/* ═══ Actions ═══ */}
        <div style={{
          display: "flex", gap: 12,
          justifyContent: "center",
        }}>
          <button
            className="btn-primary"
            onClick={() => navigate("/verify")}
            data-testid="button-verify-another"
          >
            Verify Another
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate("/verify", { state: { view: "dashboard" } })}
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function DetailRow({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "baseline", gap: 24,
    }}>
      <span style={{ fontSize: 13, color: "var(--muted-foreground)", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: color || "var(--foreground)",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        textAlign: "right",
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}

function GuidanceStep({ number, text }: { number: number; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <span style={{
        width: 22, height: 22,
        borderRadius: "50%",
        background: "var(--secondary)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        color: "var(--muted-foreground)",
        flexShrink: 0,
        marginTop: 1,
      }}>
        {number}
      </span>
      <span style={{
        fontSize: 13, color: "var(--foreground)",
        lineHeight: 1.5,
      }}>
        {text}
      </span>
    </div>
  );
}
