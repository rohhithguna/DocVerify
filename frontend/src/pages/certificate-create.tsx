import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { ArrowRight, Award, AlertCircle } from "lucide-react";
import IssuerNavbar from "@/components/issuer-navbar";
import CertificateTemplate from "@/components/certificate-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIssuerCertificateDraft } from "@/context/issuer-certificate-draft";

type ValidationErrors = Partial<Record<string, string>>;

export default function CertificateCreatePage() {
  const navigate = useNavigate();
  const { draft, updateDraft, generateCertificateId } = useIssuerCertificateDraft();
  const { toast } = useToast();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const requiredFields = useMemo(
    () => [
      ["recipientName", draft.recipientName.trim(), "Recipient name is required"],
      ["studentId", draft.studentId.trim(), "Student ID is required"],
      ["eventName", draft.eventName.trim(), "Event or course name is required"],
      ["issueDate", draft.issueDate, "Issue date is required"],
      ["expiryDate", draft.expiryDate, "Expiry date is required"],
      ["issuerName", draft.issuerName.trim(), "Issuer name is required"],
      ["issuerWallet", draft.issuerWallet.trim(), "Issuer wallet is required"],
    ] as Array<[string, string, string]>,
    [draft]
  );

  const validate = () => {
    const nextErrors: ValidationErrors = {};

    for (const [key, value, message] of requiredFields) {
      if (!value) {
        nextErrors[key] = message;
      }
    }

    if (
      draft.issueDate &&
      draft.expiryDate &&
      new Date(draft.expiryDate).getTime() <= new Date(draft.issueDate).getTime()
    ) {
      nextErrors.expiryDate = "Expiry date must be after issue date";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) {
      toast({
        title: "Please fix form errors",
        description: "Complete all required fields before continuing.",
        variant: "destructive",
      });
      return;
    }

    setIsPreparing(true);

    const certId = draft.certificateId.trim() || generateCertificateId();
    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 220, margin: 1 });
      updateDraft({ certificateId: certId, qrCodeDataUrl });

      await new Promise((resolve) => setTimeout(resolve, 300));

      if (certificateRef.current) {
        const canvas = await html2canvas(certificateRef.current, {
          backgroundColor: "#F9F7F3",
          scale: 2,
          logging: false,
          allowTaint: true,
          useCORS: true,
          windowWidth: 820,
        });

        updateDraft({
          generatedCertificateImage: canvas.toDataURL("image/png"),
          hasPreview: true,
          issuedDocumentId: "",
          issuedAt: "",
        });
      }

      navigate("/certificate/sign");
    } catch (error) {
      toast({
        title: "Preview preparation failed",
        description: error instanceof Error ? error.message : "Could not generate certificate preview.",
        variant: "destructive",
      });
    } finally {
      setIsPreparing(false);
    }
  };

  const fieldError = (key: string) => errors[key] || "";

  const certificateData = {
    name: draft.recipientName,
    email: draft.recipientEmail,
    studentId: draft.studentId,
    course: draft.eventName,
    issuer: draft.issuerName,
    date: draft.issueDate,
    certificateId: draft.certificateId,
    network: "Sepolia",
    signature: draft.signatureDataUrl || undefined,
    qrCode: draft.qrCodeDataUrl || undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <IssuerNavbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Certificate Details</h1>
            <p className="text-muted-foreground">Step 1 of 3: enter recipient and issuer information.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              New Certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipientName">Recipient Name *</Label>
                <Input
                  id="recipientName"
                  value={draft.recipientName}
                  onChange={(e) => updateDraft({ recipientName: e.target.value })}
                  placeholder="Enter recipient full name"
                />
                {fieldError("recipientName") && <p className="text-sm text-destructive mt-1">{fieldError("recipientName")}</p>}
              </div>

              <div>
                <Label htmlFor="recipientEmail">Recipient Email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={draft.recipientEmail}
                  onChange={(e) => updateDraft({ recipientEmail: e.target.value })}
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <Label htmlFor="studentId">Student ID *</Label>
                <Input
                  id="studentId"
                  value={draft.studentId}
                  onChange={(e) => updateDraft({ studentId: e.target.value })}
                  placeholder="e.g., SID-2026-001"
                />
                {fieldError("studentId") && <p className="text-sm text-destructive mt-1">{fieldError("studentId")}</p>}
              </div>

              <div>
                <Label htmlFor="certificateTitle">Certificate Title</Label>
                <Input
                  id="certificateTitle"
                  value={draft.certificateTitle}
                  onChange={(e) => updateDraft({ certificateTitle: e.target.value })}
                  placeholder="of Achievement"
                />
              </div>

              <div>
                <Label htmlFor="eventName">Event or Course *</Label>
                <Input
                  id="eventName"
                  value={draft.eventName}
                  onChange={(e) => updateDraft({ eventName: e.target.value })}
                  placeholder="Smart India Hackathon 2024"
                />
                {fieldError("eventName") && <p className="text-sm text-destructive mt-1">{fieldError("eventName")}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="issueDate">Issue Date *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={draft.issueDate}
                  onChange={(e) => updateDraft({ issueDate: e.target.value })}
                />
                {fieldError("issueDate") && <p className="text-sm text-destructive mt-1">{fieldError("issueDate")}</p>}
              </div>

              <div>
                <Label htmlFor="expiryDate">Expiry Date *</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={draft.expiryDate}
                  onChange={(e) => updateDraft({ expiryDate: e.target.value })}
                />
                {fieldError("expiryDate") && <p className="text-sm text-destructive mt-1">{fieldError("expiryDate")}</p>}
              </div>

              <div>
                <Label htmlFor="issuerName">Issuer Name *</Label>
                <Input
                  id="issuerName"
                  value={draft.issuerName}
                  onChange={(e) => updateDraft({ issuerName: e.target.value })}
                  placeholder="Your organization name"
                />
                {fieldError("issuerName") && <p className="text-sm text-destructive mt-1">{fieldError("issuerName")}</p>}
              </div>

              <div>
                <Label htmlFor="issuerWallet">Issuer Wallet *</Label>
                <Input
                  id="issuerWallet"
                  value={draft.issuerWallet}
                  onChange={(e) => updateDraft({ issuerWallet: e.target.value })}
                  placeholder="0x..."
                />
                {fieldError("issuerWallet") && <p className="text-sm text-destructive mt-1">{fieldError("issuerWallet")}</p>}
              </div>

              <div>
                <Label htmlFor="certificateId">Certificate ID (optional)</Label>
                <Input
                  id="certificateId"
                  value={draft.certificateId}
                  onChange={(e) => updateDraft({ certificateId: e.target.value })}
                  placeholder="Auto-generated when empty"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                The certificate ID is immutable after issuance. Double-check before continuing.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleContinue} disabled={isPreparing} className="gap-2" data-testid="button-go-sign">
            {isPreparing ? "Preparing preview..." : "Continue to Signature"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '760px',
          pointerEvents: 'none',
        }}
      >
        <CertificateTemplate
          ref={certificateRef}
          data={certificateData}
        />
      </div>
    </div>
  );
}
