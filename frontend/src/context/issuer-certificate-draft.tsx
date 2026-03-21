import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface CertificatePayload {
  holder: {
    name: string;
    studentId: string;
    email?: string;
  };
  certificateDetails: {
    certificateId: string;
    course: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    duration: string;
  };
  issuer: {
    issuerName: string;
    issuerId: string;
    issuerWallet: string;
  };
  validity: {
    issueDate: string;
    expiryDate: string;
    status: "ACTIVE";
  };
  security: {
    txHash?: string;
    merkleRoot?: string;
  };
  signature: {
    signature: string;
    signedBy: string;
  };
  verification: {
    qrCodeUrl: string;
  };
}

export interface CertificateDraft {
  recipientName: string;
  recipientEmail: string;
  studentId: string;
  certificateTitle: string;
  eventName: string;
  issueDate: string;
  expiryDate: string;
  issuerName: string;
  issuerWallet: string;
  certificateId: string;
  qrCodeDataUrl: string;
  signatureDataUrl: string;
  generatedCertificateImage: string;
  hasPreview: boolean;
  issuedDocumentId: string;
  issuedAt: string;
}

interface CertificateDraftContextValue {
  draft: CertificateDraft;
  updateDraft: (updates: Partial<CertificateDraft>) => void;
  resetDraft: () => void;
  generateCertificateId: () => string;
  buildPayload: (issuerId: string) => CertificatePayload;
}

const getDefaultIssueDate = () => new Date().toISOString().split("T")[0];

const getDefaultExpiryDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split("T")[0];
};

const createInitialDraft = (): CertificateDraft => ({
  recipientName: "",
  recipientEmail: "",
  studentId: "",
  certificateTitle: "of Achievement",
  eventName: "",
  issueDate: getDefaultIssueDate(),
  expiryDate: getDefaultExpiryDate(),
  issuerName: "",
  issuerWallet: "0x1234567890abcdef1234567890ABCDEF12345678",
  certificateId: "",
  qrCodeDataUrl: "",
  signatureDataUrl: "",
  generatedCertificateImage: "",
  hasPreview: false,
  issuedDocumentId: "",
  issuedAt: "",
});

const CertificateDraftContext = createContext<CertificateDraftContextValue | null>(null);

export function IssuerCertificateDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<CertificateDraft>(() => createInitialDraft());

  const updateDraft = useCallback((updates: Partial<CertificateDraft>) => {
    setDraft((previous) => ({ ...previous, ...updates }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(createInitialDraft());
  }, []);

  const generateCertificateId = useCallback(() => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CERT-${timestamp}-${random}`;
  }, []);

  const buildPayload = useCallback((issuerId: string): CertificatePayload => {
    const certId = draft.certificateId.trim();
    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;
    const signaturePayload = btoa(
      JSON.stringify({
        name: draft.recipientName,
        studentId: draft.studentId,
        course: draft.eventName,
        issuerName: draft.issuerName,
        issueDate: draft.issueDate,
        certificateId: certId,
      })
    );

    return {
      holder: {
        name: draft.recipientName,
        studentId: draft.studentId,
        ...(draft.recipientEmail ? { email: draft.recipientEmail } : {}),
      },
      certificateDetails: {
        certificateId: certId,
        course: draft.eventName,
        level: "Advanced",
        duration: "12 weeks",
      },
      issuer: {
        issuerName: draft.issuerName,
        issuerId,
        issuerWallet: draft.issuerWallet,
      },
      validity: {
        issueDate: draft.issueDate,
        expiryDate: draft.expiryDate,
        status: "ACTIVE",
      },
      security: {
        txHash: "",
        merkleRoot: "",
      },
      signature: {
        signature: draft.signatureDataUrl || signaturePayload,
        signedBy: draft.issuerName,
      },
      verification: {
        qrCodeUrl: verificationUrl,
      },
    };
  }, [draft]);

  const value = useMemo(
    () => ({ draft, updateDraft, resetDraft, generateCertificateId, buildPayload }),
    [buildPayload, draft, generateCertificateId, resetDraft, updateDraft]
  );

  return (
    <CertificateDraftContext.Provider value={value}>{children}</CertificateDraftContext.Provider>
  );
}

export function useIssuerCertificateDraft() {
  const context = useContext(CertificateDraftContext);
  if (!context) {
    throw new Error("useIssuerCertificateDraft must be used within IssuerCertificateDraftProvider");
  }

  return context;
}
