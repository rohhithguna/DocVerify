import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowRight, ArrowLeft, Check, User, FileText, Building2, Eye, AlertCircle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import IssuerNavbar from "@/components/issuer-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIssuerCertificateDraft } from "@/context/issuer-certificate-draft";

const STEPS = [
  { id: 1, title: "Recipient", icon: User },
  { id: 2, title: "Certificate", icon: FileText },
  { id: 3, title: "Issuer", icon: Building2 },
  { id: 4, title: "Review", icon: Eye },
];

export default function CertificateCreatePage() {
  const navigate = useNavigate();
  const { draft, updateDraft, generateCertificateId } = useIssuerCertificateDraft();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isPreparing, setIsPreparing] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const finalizeLockRef = useRef(false);

  const validateField = (key: string, value: string) => {
    if (key === 'recipientName' && !value.trim()) return "Recipient name is required";
    if (key === 'studentId' && !value.trim()) return "Student ID is required";
    if (key === 'recipientEmail' && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return "Invalid email format";
    }
    if (key === 'eventName' && !value.trim()) return "Event name is required";
    if (key === 'issueDate' && !value) return "Issue date is required";
    if (key === 'expiryDate') {
      if (!value) return "Expiry date is required";
      if (draft.issueDate && new Date(value).getTime() <= new Date(draft.issueDate).getTime()) {
        return "Expiry must be after issue date";
      }
    }
    if (key === 'issuerName' && !value.trim()) return "Issuer name is required";
    if (key === 'issuerWallet') {
      if (!value.trim()) return "Wallet address is required";
      if (!/^0x[a-fA-F0-9]{40}$/.test(value.trim())) return "Invalid Ethereum address format (0x...)";
    }
    return "";
  };

  const isCurrentStepValid = () => {
    if (currentStep === 1) return !validateField("recipientName", draft.recipientName) && !validateField("studentId", draft.studentId) && !validateField("recipientEmail", draft.recipientEmail);
    if (currentStep === 2) return !validateField("eventName", draft.eventName) && !validateField("issueDate", draft.issueDate) && !validateField("expiryDate", draft.expiryDate);
    if (currentStep === 3) return !validateField("issuerName", draft.issuerName) && !validateField("issuerWallet", draft.issuerWallet);
    return true; 
  };

  const handleNext = () => {
    if (isCurrentStepValid()) {
      setCurrentStep(s => Math.min(STEPS.length, s + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setCurrentStep(s => Math.max(1, s - 1));
  };

  const handleFinalize = async () => {
    if (finalizeLockRef.current || isPreparing) {
      return;
    }

    finalizeLockRef.current = true;
    setIsPreparing(true);

    const rawCertId = (draft.certificateId?.trim() || generateCertificateId()).slice(0, 64);
    const certId = rawCertId.replace(/[^A-Za-z0-9-]/g, "");
    if (!certId) {
      toast({
        title: "Invalid certificate ID",
        description: "Certificate ID must contain letters, numbers, or hyphens.",
        variant: "destructive",
      });
      setIsPreparing(false);
      finalizeLockRef.current = false;
      return;
    }

    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;

    try {
      const qrCodeDataUrl = await Promise.race([
        QRCode.toDataURL(verificationUrl, { width: 220, margin: 1 }),
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error("QR generation timed out. Please retry.")), 8000);
        }),
      ]);
      
      updateDraft({ 
        certificateId: certId, 
        qrCodeDataUrl,
        hasPreview: true,
        issuedDocumentId: "",
        issuedAt: "",
      });

      // Navigate fully without attempting dangerous canvas rendering on this page.
      navigate("/certificate/sign");
    } catch (error) {
      toast({
        title: "Preparation failed",
        description: error instanceof Error ? error.message : "Could not safely verify payload constraints.",
        variant: "destructive",
      });
      setIsPreparing(false);
    } finally {
      finalizeLockRef.current = false;
    }
  };

  const renderInput = (
    id: keyof typeof draft,
    label: string,
    placeholder: string,
    required: boolean,
    helperText: string,
    type: string = "text"
  ) => {
    const value = String(draft[id] || "");
    const error = validateField(id, value);
    const showErr = touched[id] && error;
    const showValid = !error && value && (required || (!required && value.length > 0));

    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="font-semibold text-[#111827]">
          {label} {required && <span className="text-red-500">*</span>}
          {!required && <span className="text-[#9ca3af] font-normal ml-1">(Optional)</span>}
        </Label>
        <div className="relative group">
          <Input
            id={id}
            type={type}
            value={value}
            onChange={(e) => updateDraft({ [id]: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, [id]: true }))}
            placeholder={placeholder}
            className={`h-11 rounded-[8px] bg-[#ffffff] transition-all duration-300 outline-none pr-10 text-[14px] ${
              showErr 
                ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-4 focus-visible:ring-red-500/10 shadow-[0_2px_8px_rgba(239,68,68,0.06)] bg-red-50/20' 
                : showValid
                  ? 'border-green-300 focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-500/10 shadow-[0_2px_8px_rgba(34,197,94,0.06)]'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db] focus-visible:border-[#111827] focus-visible:ring-4 focus-visible:ring-[#111827]/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]'
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300">
            {showValid && !showErr && <CheckCircle className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />}
            {showErr && <XCircle className="w-5 h-5 text-red-500 animate-in zoom-in duration-300" />}
          </div>
        </div>
        <div className="min-h-[20px] pt-1">
          {showErr ? (
            <p className="text-[13px] text-red-500 font-medium animate-in slide-in-from-top-1 duration-300">{error}</p>
          ) : (
            <p className="text-[13px] text-[#6b7280]">{helperText}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-[#111827] pb-24 overflow-x-hidden">
      <IssuerNavbar />
      
      <main className="max-w-[840px] w-full mx-auto px-6 py-12 relative z-10">
        <div className="mb-10 w-full animate-in fade-in duration-500">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6 -ml-4 text-[#6b7280] hover:text-[#111827] hover:bg-transparent px-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] mb-2">Issue New Certificate</h1>
          <p className="text-[#6b7280]">Complete the steps below to securely generate and sign a verifiable credential.</p>
        </div>

        <div className="flex flex-col space-y-8 min-w-0 w-full animate-in slide-in-from-bottom-4 duration-500">
          {/* STEPPER PROGRESS */}
          <div className="px-4">
            <div className="relative flex items-center justify-between w-full">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#e5e7eb] -mt-px -z-10" />
              <div 
                className="absolute top-1/2 left-0 h-[2px] bg-[#111827] -mt-px -z-10 transition-all duration-700 ease-in-out" 
                style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} 
              />
              
              {STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div key={step.id} className="flex flex-col items-center gap-3 bg-[#f8fafc] px-4 -mx-4 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                      isCompleted 
                        ? 'bg-[#111827] border-[#111827] text-white shadow-md' 
                        : isActive 
                          ? 'bg-white border-[#111827] text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.12)] scale-110' 
                          : 'bg-white border-[#e5e7eb] text-[#9ca3af]'
                    }`}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${
                      isActive || isCompleted ? 'text-[#111827]' : 'text-[#9ca3af]'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORM CARD */}
          <Card className="rounded-[12px] border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-[#ffffff] overflow-hidden transition-all duration-300">
            <CardContent className="p-8 sm:p-10 min-h-[460px] flex flex-col justify-between relative">
              <div className="w-full">
                {/* STEP 1: RECIPIENT */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Recipient Details</h2>
                      <p className="text-[15px] text-[#6b7280] mt-1.5 leading-relaxed">Who is receiving this credential?</p>
                    </div>
                    
                    <div className="space-y-4">
                      {renderInput("recipientName", "Full Name", "e.g. John Doe", true, "The legal name of the individual receiving the certificate.")}
                      {renderInput("studentId", "Student / Academic ID", "e.g. SID-2026-001", true, "Unique identifier connecting the recipient to your institution.")}
                      {renderInput("recipientEmail", "Email Address", "john@example.com", false, "Standard communication format, will not be embedded on-chain.", "email")}
                    </div>
                  </div>
                )}

                {/* STEP 2: CERTIFICATE */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Certificate Info</h2>
                      <p className="text-[15px] text-[#6b7280] mt-1.5 leading-relaxed">Details about the achievement or event.</p>
                    </div>
                    
                    <div className="space-y-4">
                      {renderInput("certificateTitle", "Certificate Title", "e.g. of Achievement", false, "Appears prominently under the main generic heading.")}
                      {renderInput("eventName", "Event or Course Name", "e.g. Smart India Hackathon 2024", true, "The primary reason for issuing this certificate.")}
                      
                      <div className="grid grid-cols-2 gap-6 pt-2">
                        {renderInput("issueDate", "Issue Date", "", true, "The date this certificate becomes valid.", "date")}
                        {renderInput("expiryDate", "Expiry Date", "", true, "The date validity expires. Must be after issue.", "date")}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: ISSUER */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Issuer Details</h2>
                      <p className="text-[15px] text-[#6b7280] mt-1.5 leading-relaxed">Configure your issuing identity and cryptographic IDs.</p>
                    </div>
                    
                    <div className="space-y-4">
                      {renderInput("issuerName", "Organization / Issuer Name", "Your organization name", true, "The authorized entity providing this credential.")}
                      {renderInput("issuerWallet", "Issuer Wallet Address", "0x...", true, "The Ethereum address used to deploy the registry.")}
                      {renderInput("certificateId", "Custom Certificate ID", "Auto-generated if empty", false, "Leave blank to automatically generate a secure UUID.")}
                      
                      <div className="mt-8 rounded-[12px] border border-amber-200/60 bg-amber-50/50 p-5 flex items-start gap-4 shadow-sm transition-all duration-300 hover:bg-amber-50 hover:border-amber-200">
                        <div className="p-2 bg-amber-100/50 rounded-full shrink-0 mt-0.5">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <h4 className="text-[14px] font-bold text-amber-900 tracking-tight">Immutable On-Chain Registry</h4>
                          <p className="text-[13px] text-amber-800/80 leading-relaxed">
                            Certificate IDs map directly to Blockchain state hashes. They are mathematically frozen and permanent after issuance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Review & Verify</h2>
                      <p className="text-[15px] text-[#6b7280] mt-1.5 leading-relaxed">Ensure all details are cryptographically correct before generating the payload.</p>
                    </div>
                    
                    <div className="space-y-5">
                      <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-6 transition-all hover:border-[#d1d5db]">
                        <div className="flex items-center justify-between mb-5 border-b border-[#e5e7eb] pb-3">
                          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#111827]">Recipient Information</h3>
                          <button onClick={() => setCurrentStep(1)} className="text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] underline-offset-4 hover:underline">Edit</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Full Name</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.recipientName}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Student ID</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.studentId}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Email Address</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.recipientEmail || "Not specified"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-6 transition-all hover:border-[#d1d5db]">
                        <div className="flex items-center justify-between mb-5 border-b border-[#e5e7eb] pb-3">
                          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#111827]">Certificate Info</h3>
                          <button onClick={() => setCurrentStep(2)} className="text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] underline-offset-4 hover:underline">Edit</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
                          <div className="sm:col-span-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Course / Event Name</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.eventName}</p>
                            <p className="text-[13px] text-[#6b7280] mt-0.5">{draft.certificateTitle || "Standard Certificate"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Issue Date</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.issueDate}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Expiry Date</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.expiryDate}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-6 transition-all hover:border-[#d1d5db]">
                        <div className="flex items-center justify-between mb-5 border-b border-[#e5e7eb] pb-3">
                          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#111827]">Issuer Configuration</h3>
                          <button onClick={() => setCurrentStep(3)} className="text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] underline-offset-4 hover:underline">Edit</button>
                        </div>
                        <div className="space-y-5">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Issuing Organization</p>
                            <p className="text-[15px] font-semibold text-[#111827]">{draft.issuerName}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Issuer Wallet / Endpoint</p>
                            <p className="text-[15px] font-mono tracking-tight text-[#111827] bg-white border border-[#e5e7eb] px-2.5 py-1.5 rounded-[6px] inline-block">{draft.issuerWallet}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* NAVIGATION FOOTER */}
              <div className={`mt-10 pt-6 border-t border-[#e5e7eb] flex items-center ${currentStep === 1 ? 'justify-end' : 'justify-between'} w-full`}>
                {currentStep > 1 && (
                  <Button 
                    onClick={handleBack} 
                    variant="outline" 
                    className="h-11 px-6 rounded-[8px] font-semibold border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    Back
                  </Button>
                )}
                
                {currentStep < STEPS.length ? (
                  <Button 
                    onClick={handleNext} 
                    disabled={!isCurrentStepValid()}
                    className="h-11 px-8 rounded-[8px] font-semibold bg-[#111827] text-white hover:bg-[#000000] shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-[2px] ml-auto disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button 
                    onClick={handleFinalize} 
                    disabled={isPreparing} 
                    className="h-11 px-8 rounded-[8px] font-semibold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-[0_4px_14px_rgba(22,163,74,0.15)] hover:shadow-[0_8px_30px_rgba(22,163,74,0.25)] transition-all duration-200 hover:-translate-y-[2px] flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none ml-auto"
                  >
                    {isPreparing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin mr-1" /> Generating Vault...
                      </>
                    ) : (
                      <>
                        Verify & Generate <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
