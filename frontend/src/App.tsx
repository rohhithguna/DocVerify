import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { IssuerCertificateDraftProvider } from "@/context/issuer-certificate-draft";

// Pages
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import IssuerDashboard from "@/pages/issuer-dashboard";
import VerifierDashboard from "@/pages/verifier-dashboard";
import VerifyCertificatePage from "@/pages/verify-certificate";
import CertificateCreatePage from "@/pages/certificate-create";
import CertificateSignPage from "@/pages/certificate-sign";
import CertificatePreviewPage from "@/pages/certificate-preview";
import ResultsPage from "@/pages/results";
import NotFound from "@/pages/not-found";

/**
 * Protected route wrapper — redirects to /login if not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <IssuerDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/issuer/:issuerId" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/certificate/create"
        element={
          <ProtectedRoute>
            <CertificateCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificate/sign"
        element={
          <ProtectedRoute>
            <CertificateSignPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificate/preview"
        element={
          <ProtectedRoute>
            <CertificatePreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificate/preview/:id"
        element={
          <ProtectedRoute>
            <CertificatePreviewPage />
          </ProtectedRoute>
        }
      />

      <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />
      <Route path="/verify" element={<VerifierDashboard />} />
      <Route path="/verifier/:verifierId" element={<VerifierDashboard />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IssuerCertificateDraftProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <BrowserRouter>
                <Router />
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </IssuerCertificateDraftProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
