import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Download, PlusCircle, LayoutDashboard, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import IssuerNavbar from "@/components/issuer-navbar";
import CertificateTemplate from "../components/certificate-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIssuerCertificateDraft } from "@/context/issuer-certificate-draft";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CertificateLookupResponse = {
  certificateId: string;
  holderName: string;
  course: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  status: "ACTIVE" | "REVOKED" | "DELETED";
  hash: string;
};

async function fetchCertificate(certificateId: string): Promise<CertificateLookupResponse> {
  const response = await fetch(`/api/certificate/${encodeURIComponent(certificateId)}`);

  if (!response.ok) {
    throw new Error("Certificate not found");
  }

  return response.json();
}

export default function CertificatePreviewPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const certificateIdFromRoute = params.id || "";
  const { draft, resetDraft, buildPayload } = useIssuerCertificateDraft();
  const { user } = useAuth();
  const { toast } = useToast();
  const issuerId = user?.id || "";
  const [isDownloading, setIsDownloading] = useState(false);

  const isCurrentDraft = !certificateIdFromRoute || draft.certificateId === certificateIdFromRoute;

  const { data, isLoading } = useQuery({
    queryKey: ["issuer-preview-certificate", certificateIdFromRoute],
    queryFn: () => fetchCertificate(certificateIdFromRoute),
    enabled: !!certificateIdFromRoute && !isCurrentDraft,
    retry: false,
  });

  const previewData = useMemo(() => {
    if (isCurrentDraft) {
      return {
        recipientName: draft.recipientName,
        email: draft.recipientEmail || "-",
        studentId: draft.studentId || "-",
        eventName: draft.eventName,
        issueDate: draft.issueDate,
        issuerName: draft.issuerName,
        certificateId: draft.certificateId,
        network: "Sepolia",
        qrCodeDataUrl: draft.qrCodeDataUrl,
        signatureDataUrl: draft.signatureDataUrl,
        imageDataUrl: draft.generatedCertificateImage,
      };
    }

    if (!data) {
      return null;
    }

    return {
      recipientName: data.holderName,
      eventName: data.course,
      issueDate: data.issueDate,
      issuerName: data.issuer,
      certificateId: data.certificateId,
      email: "-",
      studentId: "-",
      network: "Sepolia",
      qrCodeDataUrl: "",
      signatureDataUrl: "",
      imageDataUrl: "",
    };
  }, [data, draft, isCurrentDraft]);

  const downloadCertificate = async () => {
    const element = document.getElementById("certificate");
    if (!element) {
      toast({ title: "Error", description: "Certificate element not found", variant: "destructive" });
      return;
    }

    setIsDownloading(true);

    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 300));

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        width: 760,
        height: 900,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => {
          // Strip SVG url() filters that crash html2canvas
          const el = clonedDoc.getElementById("certificate");
          if (el) {
            el.querySelectorAll<HTMLElement>("*").forEach((node) => {
              const f = node.style?.filter;
              if (f && f.includes("url(")) {
                node.style.filter = "none";
              }
            });
            // Also strip filter from the main content div
            const contentDiv = el.querySelector<HTMLElement>('[style*="filter"]');
            if (contentDiv && contentDiv.style.filter.includes("url(")) {
              contentDiv.style.filter = "none";
            }
          }
        },
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas rendering failed — empty result");
      }

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      // PDF sized exactly to the certificate (760 x 900 px)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [760, 900],
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 760, 900);
      pdf.save("certificate.pdf");

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Download failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const issueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/issuer/${issuerId}/create-certificate`, buildPayload(issuerId));
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/issuer", issuerId, "batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/issuer", issuerId, "stats"] });
      toast({
        title: "Certificate issued",
        description: `Certificate for ${draft.recipientName} was signed and anchored successfully.`,
      });
      if (result?.documentId) {
        navigate(`/certificate/preview/${encodeURIComponent(draft.certificateId)}`);
      }
    },
    onError: (error: any) => {
      const message = String(error?.message || "");
      const isDuplicate = message.includes("DUPLICATE_CERTIFICATE") || message.includes("Certificate already exists");
      toast({
        title: isDuplicate ? "Certificate Already Exists" : "Issuance failed",
        description: isDuplicate
          ? "A certificate with this identifier already exists. Use a new ID and retry."
          : (error?.message || "Something went wrong"),
        variant: "destructive",
      });
    },
  });

  const handleIssueCertificate = () => {
    if (!draft.hasPreview || !draft.certificateId) {
      toast({
        title: "Complete previous steps first",
        description: "Please fill certificate details before issuing.",
        variant: "destructive",
      });
      navigate("/certificate/create");
      return;
    }

    if (!draft.signatureDataUrl) {
      toast({
        title: "Signature required",
        description: "Please complete signature step before issuing.",
        variant: "destructive",
      });
      navigate("/certificate/sign");
      return;
    }

    if (!issuerId || issueMutation.isPending) {
      return;
    }

    issueMutation.mutate();
  };

  const certificateData = previewData
    ? {
        name: previewData.recipientName,
        email: previewData.email,
        studentId: previewData.studentId,
        course: previewData.eventName,
        issuer: previewData.issuerName,
        date: previewData.issueDate,
        certificateId: previewData.certificateId,
        network: previewData.network,
        signature: previewData.signatureDataUrl || undefined,
        qrCode: previewData.qrCodeDataUrl || undefined,
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <IssuerNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Certificate Preview</h1>
            <p className="text-muted-foreground">Step 3 of 3: review, download, or issue another certificate.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadCertificate} disabled={isDownloading} className="gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Capturing..." : "Download"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetDraft();
                navigate("/certificate/create");
              }}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              New Certificate
            </Button>
            <Button onClick={() => navigate("/dashboard")} className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              onClick={handleIssueCertificate}
              className="gap-2"
              disabled={issueMutation.isPending || !!certificateIdFromRoute}
              data-testid="button-issue-certificate-final"
            >
              {issueMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Issuing...
                </>
              ) : (
                "Issue Certificate"
              )}
            </Button>
          </div>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Loading certificate preview...</CardContent>
          </Card>
        )}

        {!isLoading && !previewData && (
          <Card>
            <CardContent className="py-10 text-center text-destructive">Certificate not found for preview.</CardContent>
          </Card>
        )}

        {previewData && certificateData && (
          <div className="rounded-lg border bg-card p-4 overflow-x-auto">
            <div className="w-full bg-white flex justify-center" style={{ minWidth: "800px", padding: "20px" }}>
              <CertificateTemplate id="certificate" data={certificateData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
