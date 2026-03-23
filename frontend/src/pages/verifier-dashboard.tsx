import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";
import type { VerificationWithDetails } from "@shared/schema";
import FileUpload from "@/components/file-upload";

type ActiveView = "verify" | "dashboard";
const DEMO_VERIFIER_ID = "demo-verifier";

type VerificationHistoryResponse = {
  verifications: VerificationWithDetails[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export default function VerifierDashboard() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const params = useParams();
  const verifierId = params.verifierId || DEMO_VERIFIER_ID;

  // Allow deep-linking to dashboard via location.state
  const initialView: ActiveView =
    routeLocation.state?.view === "dashboard" ? "dashboard" : "verify";

  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "complete">("idle");
  const [scanFileName, setScanFileName] = useState("");
  const [lastVerification, setLastVerification] = useState<any>(null);
  const pendingVerification = useRef<any>(null);

  // Keep view in sync if state changes
  useEffect(() => {
    if (routeLocation.state?.view === "dashboard") setActiveView("dashboard");
  }, [routeLocation.state]);

  // Fetch verifier statistics
  const { data: stats } = useQuery<{
    totalVerifications: number;
    averageScore: number;
    failedVerifications: number;
    recentCount: number;
  }>({
    queryKey: ['/api/verifier', verifierId, 'stats'],
  });

  // Fetch verification history
  const { data: historyResponse, refetch: refetchHistory } = useQuery<VerificationHistoryResponse>({
    queryKey: ['/api/verifier', verifierId, 'history'],
  });
  const history = historyResponse?.verifications || [];

  /* ─── Scanning Flow ─── */
  const handleVerificationComplete = useCallback((verification: any) => {
    pendingVerification.current = verification;
    setLastVerification(verification);
    // Show scanning animation for 2 seconds, then navigate
    setScanPhase("scanning");
    setTimeout(() => {
      setScanPhase("complete");
      setTimeout(() => {
        // Navigate to results page with verification data
        navigate("/results", {
          state: {
            verification: {
              ...verification,
              fileName: scanFileName,
              uploadedAt: new Date().toISOString(),
            },
          },
        });
        // Reset state after navigation
        setScanPhase("idle");
        setScanFileName("");
        pendingVerification.current = null;
      }, 400);
    }, 2000);
    refetchHistory();
  }, [navigate, refetchHistory, scanFileName]);

  const handleFilePreview = useCallback((url: string | null) => {
    setPreviewUrl(url);
  }, []);

  const handleUploadStart = useCallback(() => {
    setScanPhase("idle");
    pendingVerification.current = null;
  }, []);

  const handleFileSelected = useCallback((name: string) => {
    setScanFileName(name);
  }, []);

  const totalVerified = stats?.totalVerifications
    ? stats.totalVerifications - (stats?.failedVerifications || 0)
    : 0;
  const successRate = stats?.totalVerifications
    ? Math.round((totalVerified / stats.totalVerifications) * 100)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ─── Floating Glass Nav ─── */}
      <nav className="floating-nav">
        <button
          className={activeView === "verify" ? "active" : ""}
          onClick={() => setActiveView("verify")}
          data-testid="nav-verify"
        >
          Verify
        </button>
        <button
          onClick={() => {
            if (!lastVerification) return;
            navigate("/results", { state: { verification: lastVerification } });
          }}
          disabled={!lastVerification}
          data-testid="nav-results"
        >
          Results
        </button>
        <button
          className={activeView === "dashboard" ? "active" : ""}
          onClick={() => setActiveView("dashboard")}
          data-testid="nav-dashboard"
        >
          Dashboard
        </button>
        <button
          onClick={() => navigate("/")}
          data-testid="nav-home"
        >
          Home
        </button>
      </nav>

      {/* ─── SCANNING OVERLAY ─── */}
      {scanPhase !== "idle" && (
        <div className={`scan-overlay ${scanPhase === "complete" ? "scan-exit" : ""}`}>
          <div className="scan-content">
            {/* Scanning animation */}
            <div className="scan-ring-wrapper">
              <div className="scan-ring" />
              <div className="scan-ring-inner" />
              <svg
                width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="var(--foreground)" strokeWidth="1.5"
                style={{ position: 'relative', zIndex: 2 }}
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div style={{ marginTop: 28, textAlign: 'center' }}>
              <p style={{
                fontSize: 16, fontWeight: 600,
                color: 'var(--foreground)',
                letterSpacing: '-0.02em',
                marginBottom: 6,
              }}>
                Verifying authenticity…
              </p>
              <p style={{
                fontSize: 13,
                color: 'var(--muted-foreground)',
              }}>
                Checking blockchain records and signatures
              </p>
            </div>

            {/* Scan line animation */}
            <div className="scan-line-track">
              <div className="scan-line" />
            </div>
          </div>
        </div>
      )}

      {/* ─── VERIFY VIEW ─── */}
      {activeView === "verify" && (
        <div
          className="fade-in split-layout"
          style={{
            display: 'flex',
            minHeight: '100vh',
            paddingTop: 88,
          }}
        >
          {/* LEFT — Certificate Preview (65%) */}
          <div
            className="split-left"
            style={{
              width: '65%',
              padding: '40px 40px 40px 64px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div className="preview-area">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Certificate preview"
                  className="fade-in-scale"
                  data-testid="img-certificate-preview"
                />
              ) : (
                <div className="preview-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    Upload a document to preview
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Upload Controls (35%) */}
          <div
            className="split-right"
            style={{
              width: '35%',
              padding: '40px 64px 40px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 40,
            }}
          >
            <div>
              <h1 style={{
                fontSize: 28, fontWeight: 700,
                letterSpacing: '-0.03em', lineHeight: 1.2,
                color: 'var(--foreground)',
              }}>
                Verify Document
              </h1>
              <p style={{
                fontSize: 14, color: 'var(--muted-foreground)',
                marginTop: 8, lineHeight: 1.5,
              }}>
                Upload a certificate to verify its authenticity against the blockchain.
              </p>
            </div>

            <FileUpload
              verifierId={verifierId}
              onVerificationComplete={handleVerificationComplete}
              onUploadStart={handleUploadStart}
              onFilePreview={handleFilePreview}
              onFileSelected={handleFileSelected}
            />
          </div>
        </div>
      )}

      {/* ─── DASHBOARD VIEW ─── */}
      {activeView === "dashboard" && (
        <div
          className="fade-in"
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '112px 32px 80px',
          }}
        >
          {/* Title */}
          <h1 style={{
            fontSize: 36, fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--foreground)',
            marginBottom: 40,
          }}>
            Dashboard
          </h1>

          {/* ═══ STAT CARDS ═══ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 48,
          }}>
            <StatCard
              value={totalVerified}
              label="Total Verified"
              testId="text-total-verifications"
            />
            <StatCard
              value={stats?.failedVerifications || 0}
              label="Failed"
              color={stats?.failedVerifications ? "var(--invalid)" : undefined}
              testId="text-failed-verifications"
            />
            <StatCard
              value={`${successRate}%`}
              label="Success Rate"
              testId="text-average-score"
            />
            <StatCard
              value={stats?.recentCount || 0}
              label="Last 24 Hours"
              testId="text-recent-count"
            />
          </div>

          {/* ═══ ACTIVITY SECTION ═══ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}>
            {/* Left: Recent Activity Timeline */}
            <div className="result-card">
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 20,
              }}>
                Recent Activity
              </div>

              {history && history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {history.slice(0, 8).map((v, i) => (
                    <div
                      key={v.id}
                      className="history-item"
                      data-testid={`card-verification-${v.id}`}
                      style={{
                        paddingLeft: 24,
                        position: 'relative',
                      }}
                    >
                      {/* Timeline line */}
                      {i < Math.min((history?.length || 0), 8) - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: 5,
                          top: 24,
                          bottom: 0,
                          width: 1,
                          background: 'var(--border)',
                        }} />
                      )}
                      {/* Dot */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 18,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: v.status === 'verified'
                          ? 'var(--valid)'
                          : v.status === 'failed'
                            ? 'var(--invalid)'
                            : 'var(--muted-foreground)',
                        background: 'var(--background)',
                      }} />

                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%',
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 500,
                            color: 'var(--foreground)',
                            display: 'block',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {v.fileName}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: v.status === 'verified'
                            ? 'var(--valid)'
                            : v.status === 'failed'
                              ? 'var(--invalid)'
                              : 'var(--muted-foreground)',
                          flexShrink: 0,
                          marginLeft: 12,
                        }}>
                          {v.confidenceScore !== null ? `${v.confidenceScore}%` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </div>

            {/* Right: Success Rate Visual + Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Mini chart placeholder */}
              <div className="result-card">
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 20,
                }}>
                  Success Rate
                </div>

                {/* Bar visualization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Verified</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--valid)' }}>
                        {totalVerified}
                      </span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: 'var(--secondary)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'var(--valid)',
                        width: `${successRate}%`,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>

                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Failed</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--invalid)' }}>
                        {stats?.failedVerifications || 0}
                      </span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: 'var(--secondary)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'var(--invalid)',
                        width: `${stats?.totalVerifications
                          ? Math.round(((stats?.failedVerifications || 0) / stats.totalVerifications) * 100)
                          : 0}%`,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'center', paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}>
                    <span style={{
                      fontSize: 28, fontWeight: 700,
                      letterSpacing: '-0.03em',
                      color: 'var(--foreground)',
                    }}>
                      {successRate}%
                    </span>
                    <span style={{
                      display: 'block',
                      fontSize: 11, fontWeight: 500,
                      color: 'var(--muted-foreground)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginTop: 2,
                    }}>
                      Overall Success
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="result-card">
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 16,
                }}>
                  Quick Actions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '12px 20px' }}
                    onClick={() => setActiveView("verify")}
                  >
                    Verify New Document
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', padding: '10px 20px' }}
                    onClick={() => navigate("/")}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  value,
  label,
  color,
  testId,
}: {
  value: string | number;
  label: string;
  color?: string;
  testId?: string;
}) {
  return (
    <div className="result-card" style={{ padding: '24px 20px' }}>
      <span
        className="stat-value"
        style={{ color, fontSize: 28, marginBottom: 4, display: 'block' }}
        data-testid={testId}
      >
        {value}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 0',
      color: 'var(--muted-foreground)',
    }}>
      <svg
        width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5"
        style={{ margin: '0 auto 12px', opacity: 0.3 }}
      >
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p style={{ fontSize: 13 }}>No verifications yet.</p>
      <p style={{ fontSize: 12, marginTop: 4 }}>Upload a document to get started.</p>
    </div>
  );
}
