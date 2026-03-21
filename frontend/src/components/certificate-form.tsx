import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { Download, Award, Loader2, Undo2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CertificateTemplate from "./certificate-template";

interface CertificateFormProps {
    issuerId: string;
    onCertificateCreated?: () => void;
}

interface CertificatePayload {
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

interface PreviewData {
    name: string;
    course: string;
    issuerName: string;
    certificateId: string;
    issueDate: string;
    expiryDate: string;
    payload: CertificatePayload;
}

export default function CertificateForm({ issuerId, onCertificateCreated }: CertificateFormProps) {
    const [recipientName, setRecipientName] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [studentId, setStudentId] = useState("");
    const [certificateTitle, setCertificateTitle] = useState("of Achievement");
    const [eventName, setEventName] = useState("");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState(() => {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1);
        return date.toISOString().split('T')[0];
    });
    const [issuerName, setIssuerName] = useState("");
    const [issuerWallet, setIssuerWallet] = useState("0x1234567890abcdef1234567890ABCDEF12345678");
    const [certificateId, setCertificateId] = useState("");
    const [generatedCertificate, setGeneratedCertificate] = useState<string | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [isSigned, setIsSigned] = useState(false);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [currentStep, setCurrentStep] = useState<"details" | "preview" | "issued">("details");
    const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
    const [isDrawing, setIsDrawing] = useState(false);
    const [isSigningInProgress, setIsSigningInProgress] = useState(false);
    const [drawingMode, setDrawingMode] = useState(false); // Toggle mode: click to start/stop
    const [strokes, setStrokes] = useState<ImageData[]>([]); // Store strokes for undo
    const [uploadedSignature, setUploadedSignature] = useState<string>(""); // For uploaded images
    const [signatureMode, setSignatureMode] = useState<"draw" | "upload">("draw"); // Track signature source
    const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null); // For smooth line drawing

    const certificateRef = useRef<HTMLDivElement>(null);
    const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Generate unique certificate ID
    const generateCertificateId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CERT-${timestamp}-${random}`;
    };

    // Initialize signature canvas with DPI scaling
    const initializeSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        // Get DPI scaling factor
        const scale = window.devicePixelRatio || 1;

        // Set canvas resolution
        canvas.width = canvas.offsetWidth * scale;
        canvas.height = canvas.offsetHeight * scale;

        // Get context and apply scaling
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(scale, scale);

        // Set drawing properties for smooth lines
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
        ctx.globalCompositeOperation = "source-over";
    };

    // Initialize canvas when preview data becomes available
    useEffect(() => {
        if (previewData) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(initializeSignatureCanvas, 0);
            return () => clearTimeout(timer);
        }
    }, [previewData]);

    // Create certificate mutation — sends only lightweight metadata, no image
    const createCertificateMutation = useMutation({
        mutationFn: async (certificateData: CertificatePayload) => {
            const response = await apiRequest('POST', `/api/issuer/${issuerId}/create-certificate`, certificateData);
            return response.json();
        },
        onSuccess: (data) => {
            setIsSigningInProgress(false);
            setIsSigned(true);
            setCurrentStep("issued");
            toast({
                title: "Certificate Created!",
                description: `Certificate for ${recipientName} has been signed and stored on blockchain.`,
            });
            queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'batches'] });
            queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
            onCertificateCreated?.();
        },
        onError: (error: any) => {
            const errorText = String(error?.message || "");
            const isDuplicate = errorText.includes("DUPLICATE_CERTIFICATE") || errorText.includes("Certificate already exists");

            setIsSigningInProgress(false);
            toast({
                title: isDuplicate ? "Certificate Already Exists" : "Failed to Create Certificate",
                description: isDuplicate
                    ? "A certificate with this identifier already exists. Please regenerate and try again."
                    : (error.message || "Something went wrong"),
                variant: "destructive",
            });
        },
    });

    const buildCertificatePayload = (certId: string): CertificatePayload => {
        const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;
        const signaturePayload = btoa(JSON.stringify({
            name: recipientName,
            studentId,
            course: eventName,
            issuerName,
            issueDate,
            certificateId: certId,
        }));

        return {
            holder: {
                name: recipientName,
                studentId,
                ...(recipientEmail ? { email: recipientEmail } : {}),
            },
            certificateDetails: {
                certificateId: certId,
                course: eventName,
                level: "Advanced",
                duration: "12 weeks",
            },
            issuer: {
                issuerName,
                issuerId,
                issuerWallet,
            },
            validity: {
                issueDate,
                expiryDate,
                status: "ACTIVE",
            },
            security: {
                txHash: "",
                merkleRoot: "",
            },
            signature: {
                signature: signaturePayload,
                signedBy: issuerName,
            },
            verification: {
                qrCodeUrl: verificationUrl,
            },
        };
    };

    const handleGenerateCertificate = async () => {
        setIsGeneratingPreview(true);
        const missingFields: string[] = [];

        if (!recipientName.trim()) missingFields.push("Recipient Name");
        if (!studentId.trim()) missingFields.push("Student ID");
        if (!eventName.trim()) missingFields.push("Event / Course Name");
        if (!issueDate) missingFields.push("Issue Date");
        if (!expiryDate) missingFields.push("Expiry Date");
        if (!issuerName.trim()) missingFields.push("Issuer Name");
        if (!issuerWallet.trim()) missingFields.push("Issuer Wallet");

        if (missingFields.length > 0) {
            toast({
                title: "Missing Information",
                description: `Please fill: ${missingFields.join(", ")}`,
                variant: "destructive",
            });
            setIsGeneratingPreview(false);
            return;
        }

        if (new Date(expiryDate).getTime() <= new Date(issueDate).getTime()) {
            toast({
                title: "Invalid Dates",
                description: "Expiry date must be after issue date.",
                variant: "destructive",
            });
            setIsGeneratingPreview(false);
            return;
        }

        // Generate certificate ID if not set
        const certId = certificateId || generateCertificateId();
        setCertificateId(certId);
        setIsSigned(false);

        const qrPayload = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;

        try {
            const qrDataUrl = await QRCode.toDataURL(qrPayload, {
                width: 220,
                margin: 1,
            });
            setQrCodeDataUrl(qrDataUrl);
        } catch (error) {
            console.error("Failed to generate QR code:", error);
            setQrCodeDataUrl(null);
            toast({
                title: "QR Generation Failed",
                description: "Could not generate QR code for this certificate.",
                variant: "destructive",
            });
        }

        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate certificate image locally (for preview/download only)
        if (certificateRef.current) {
            try {
                const canvas = await html2canvas(certificateRef.current, {
                    backgroundColor: "#ffffff",
                    scale: 2,
                    logging: false,
                });

                const imageData = canvas.toDataURL("image/png");
                setGeneratedCertificate(imageData);
            } catch (error) {
                console.error("Failed to generate certificate image:", error);
                // Image generation failure shouldn't block certificate creation
                toast({
                    title: "Preview Image Unavailable",
                    description: "Certificate can still be issued, but image download preview may be unavailable.",
                });
            }
        }

        setPreviewData({
            name: recipientName,
            course: eventName,
            issuerName,
            certificateId: certId,
            issueDate,
            expiryDate,
            payload: buildCertificatePayload(certId),
        });
        setCurrentStep("preview");

        toast({
            title: "Preview Ready",
            description: "Review the certificate details and click Proceed to Sign.",
        });
        setIsGeneratingPreview(false);
    };

    const handleProceedToSign = () => {
        // PROTECTION: Prevent double calls by blocking if already signing
        if (isSigningInProgress) {
            console.log("⚠️ DOUBLE_CALL_PROTECTION: Signing already in progress, ignoring click");
            return;
        }

        if (!previewData) {
            return;
        }

        if (!signatureDataUrl) {
            toast({
                title: "Signature Required",
                description: "Please sign in the signature pad before issuing the certificate.",
                variant: "destructive",
            });
            return;
        }

        // Set loading state IMMEDIATELY before mutation
        setIsSigningInProgress(true);

        // Build complete payload with all required fields
        const finalPayload = {
            ...previewData.payload,
            signature: {
                ...previewData.payload.signature,
                signature: signatureDataUrl,
            },
        };

        // Debug: Log complete payload to verify all fields are present
        console.log("📋 PAYLOAD_FIX: Certificate Creation Payload", {
            holder: finalPayload.holder ? {
                name: finalPayload.holder.name ? "✓" : "✗",
                studentId: finalPayload.holder.studentId ? "✓" : "✗",
                email: finalPayload.holder.email ? "✓" : "○",
            } : "✗",
            certificateDetails: finalPayload.certificateDetails ? {
                certificateId: finalPayload.certificateDetails.certificateId ? "✓" : "✗",
                course: finalPayload.certificateDetails.course ? "✓" : "✗",
                level: finalPayload.certificateDetails.level ? "✓" : "✗",
                duration: finalPayload.certificateDetails.duration ? "✓" : "✗",
            } : "✗",
            issuer: finalPayload.issuer ? {
                issuerName: finalPayload.issuer.issuerName ? "✓" : "✗",
                issuerId: finalPayload.issuer.issuerId ? "✓" : "✗",
                issuerWallet: finalPayload.issuer.issuerWallet ? "✓" : "✗",
            } : "✗",
            validity: finalPayload.validity ? {
                issueDate: finalPayload.validity.issueDate ? "✓" : "✗",
                expiryDate: finalPayload.validity.expiryDate ? "✓" : "✗",
                status: finalPayload.validity.status ? "✓" : "✗",
            } : "✗",
            security: finalPayload.security ? "✓" : "○",
            signature: finalPayload.signature ? {
                signature: finalPayload.signature.signature ? `✓ (${finalPayload.signature.signature.substring(0, 20)}...)` : "✗",
                signedBy: finalPayload.signature.signedBy ? "✓" : "✗",
            } : "✗",
            verification: finalPayload.verification ? "✓" : "○",
        });

        // Log full payload for debugging
        console.log("🔍 Full Payload Structure:", JSON.stringify(finalPayload, null, 2));

        console.log("✅ DOUBLE_CALL_FIX: Single API call in progress");
        createCertificateMutation.mutate(finalPayload);
    };

    // Smooth drawing with quadratic curves to reduce jitter
    const drawSmoothLine = (x: number, y: number) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas || !lastPoint) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // Use quadratic curve for smoothness
        const midX = (lastPoint.x + x) / 2;
        const midY = (lastPoint.y + y) / 2;
        context.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
        context.stroke();
        
        setLastPoint({ x: midX, y: midY });
    };

    const getMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const getTouchPosition = (touch: React.Touch) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
    };

    // Toggle drawing mode on canvas click
    const toggleDrawingMode = (event: React.MouseEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        if (!drawingMode) {
            // Start drawing
            setDrawingMode(true);
            setSignatureMode("draw");
            setUploadedSignature(""); // Clear any uploaded signature
            const context = canvas.getContext("2d");
            if (context) {
                const { x, y } = getMousePosition(event);
                context.beginPath();
                context.moveTo(x, y);
                setLastPoint({ x, y });
                // Save current state for undo
                setStrokes([...strokes, context.getImageData(0, 0, canvas.width, canvas.height)]);
            }
        } else {
            // Stop drawing
            setDrawingMode(false);
            setLastPoint(null);
            // Save signature
            if (canvas) {
                const newSignature = canvas.toDataURL();
                setSignatureDataUrl(newSignature);
            }
        }
    };

    const handleSignatureMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!drawingMode) {
            toggleDrawingMode(event);
            return;
        }
        event.preventDefault();
    };

    const handleSignatureMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!drawingMode) return;

        event.preventDefault();
        const { x, y } = getMousePosition(event);
        drawSmoothLine(x, y);
    };

    const handleSignatureMouseUp = (event?: React.MouseEvent<HTMLCanvasElement>) => {
        // Only toggle on double-click or explicit click if not moving
        event?.preventDefault();
    };

    const handleSignatureTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        if (event.touches.length === 0) return;

        // Toggle drawing on first touch
        if (!drawingMode) {
            const touch = event.touches[0];
            const canvas = signatureCanvasRef.current;
            if (!canvas) return;

            setDrawingMode(true);
            setSignatureMode("draw");
            setUploadedSignature("");
            const context = canvas.getContext("2d");
            if (context) {
                const { x, y } = getTouchPosition(touch);
                context.beginPath();
                context.moveTo(x, y);
                setLastPoint({ x, y });
                setStrokes([...strokes, context.getImageData(0, 0, canvas.width, canvas.height)]);
            }
        }
    };

    const handleSignatureTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        if (!drawingMode || event.touches.length === 0) return;

        const touch = event.touches[0];
        const { x, y } = getTouchPosition(touch);
        drawSmoothLine(x, y);
    };

    const handleSignatureTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        if (!drawingMode) return;

        // Toggle drawing off on touch end
        setDrawingMode(false);
        setLastPoint(null);
        const canvas = signatureCanvasRef.current;
        if (canvas) {
            const newSignature = canvas.toDataURL();
            setSignatureDataUrl(newSignature);
        }
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureDataUrl("");
        setUploadedSignature("");
        setDrawingMode(false);
        setStrokes([]);
        setLastPoint(null);
        initializeSignatureCanvas();
    };

    const undoStroke = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas || strokes.length === 0) return;

        const newStrokes = [...strokes];
        newStrokes.pop(); // Remove last stroke
        setStrokes(newStrokes);

        // Redraw all remaining strokes
        const context = canvas.getContext("2d");
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            newStrokes.forEach((stroke) => {
                context.putImageData(stroke, 0, 0);
            });
        }

        // Update signature
        if (canvas) {
            const newSignature = canvas.toDataURL();
            setSignatureDataUrl(newSignature);
        }
    };

    const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
            toast({
                title: "Invalid File Type",
                description: "Please upload a PNG or JPG image.",
                variant: "destructive",
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            if (imageUrl) {
                setUploadedSignature(imageUrl);
                setSignatureDataUrl(imageUrl);
                setSignatureMode("upload");
                setDrawingMode(false);
                setStrokes([]);
                
                // Draw uploaded image on canvas
                const img = new Image();
                img.onload = () => {
                    const canvas = signatureCanvasRef.current;
                    if (canvas) {
                        const context = canvas.getContext("2d");
                        if (context) {
                            context.clearRect(0, 0, canvas.width, canvas.height);
                            // Scale image to fit canvas
                            const maxWidth = canvas.offsetWidth - 20;
                            const maxHeight = canvas.offsetHeight - 20;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > maxWidth || height > maxHeight) {
                                const ratio = Math.min(maxWidth / width, maxHeight / height);
                                width = width * ratio;
                                height = height * ratio;
                            }
                            
                            const x = (canvas.offsetWidth - width) / 2;
                            const y = (canvas.offsetHeight - height) / 2;
                            context.drawImage(img, x, y, width, height);
                        }
                    }
                };
                img.src = imageUrl;
                
                toast({
                    title: "Signature Uploaded",
                    description: "Your signature has been loaded.",
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDownload = () => {
        if (generatedCertificate) {
            const link = document.createElement("a");
            link.download = `certificate-${recipientName.replace(/\s+/g, '-').toLowerCase()}-${certificateId}.png`;
            link.href = generatedCertificate;
            link.click();
        }
    };

    const handleReset = () => {
        setRecipientName("");
        setRecipientEmail("");
        setStudentId("");
        setCertificateTitle("of Achievement");
        setEventName("");
        setIssueDate(new Date().toISOString().split('T')[0]);
        const nextExpiry = new Date();
        nextExpiry.setFullYear(nextExpiry.getFullYear() + 1);
        setExpiryDate(nextExpiry.toISOString().split('T')[0]);
        setIssuerName("");
        setIssuerWallet("0x1234567890abcdef1234567890ABCDEF12345678");
        setCertificateId("");
        setGeneratedCertificate(null);
        setQrCodeDataUrl(null);
        setPreviewData(null);
        setIsSigned(false);
        setIsGeneratingPreview(false);
        setCurrentStep("details");
        setIsSigningInProgress(false);
        clearSignature();
    };

    const isSubmitting = createCertificateMutation.isPending;
    const isActionLocked = isGeneratingPreview || isSubmitting;

    return (
        <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Certificate Details
                        </CardTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={currentStep === "details" ? "font-semibold text-foreground" : ""}>1. Enter Details</span>
                            <span>→</span>
                            <span className={currentStep === "preview" ? "font-semibold text-foreground" : ""}>2. Preview & Sign</span>
                            <span>→</span>
                            <span className={currentStep === "issued" ? "font-semibold text-foreground" : ""}>3. Issued</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="recipientName">Recipient Name *</Label>
                            <Input
                                id="recipientName"
                                value={recipientName}
                                onChange={(e) => setRecipientName(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="Enter recipient's full name"
                                data-testid="input-recipient-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="recipientEmail">Recipient Email</Label>
                            <Input
                                id="recipientEmail"
                                type="email"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="recipient@example.com"
                                data-testid="input-recipient-email"
                            />
                        </div>

                        <div>
                            <Label htmlFor="studentId">Student ID *</Label>
                            <Input
                                id="studentId"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="e.g., SID-2026-001"
                                data-testid="input-student-id"
                            />
                        </div>

                        <div>
                            <Label htmlFor="certificateTitle">Certificate Title</Label>
                            <Input
                                id="certificateTitle"
                                value={certificateTitle}
                                onChange={(e) => setCertificateTitle(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="e.g., of Achievement, of Completion"
                                data-testid="input-certificate-title"
                            />
                        </div>

                        <div>
                            <Label htmlFor="eventName">Event / Course Name *</Label>
                            <Input
                                id="eventName"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="e.g., Smart India Hackathon 2024"
                                data-testid="input-event-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="issueDate">Issue Date</Label>
                            <Input
                                id="issueDate"
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                                disabled={isActionLocked}
                                data-testid="input-issue-date"
                            />
                        </div>

                        <div>
                            <Label htmlFor="expiryDate">Expiry Date *</Label>
                            <Input
                                id="expiryDate"
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                disabled={isActionLocked}
                                data-testid="input-expiry-date"
                            />
                        </div>

                        <div>
                            <Label htmlFor="issuerName">Issuer / Organization Name *</Label>
                            <Input
                                id="issuerName"
                                value={issuerName}
                                onChange={(e) => setIssuerName(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="Your organization name"
                                data-testid="input-issuer-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="issuerWallet">Issuer Wallet *</Label>
                            <Input
                                id="issuerWallet"
                                value={issuerWallet}
                                onChange={(e) => setIssuerWallet(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="0x..."
                                data-testid="input-issuer-wallet"
                            />
                        </div>

                        <div>
                            <Label htmlFor="certificateId">Certificate ID (auto-generated if empty)</Label>
                            <Input
                                id="certificateId"
                                value={certificateId}
                                onChange={(e) => setCertificateId(e.target.value)}
                                disabled={isActionLocked}
                                placeholder="Leave empty to auto-generate"
                                data-testid="input-certificate-id"
                            />
                        </div>

                        <div className="space-y-3 pt-4">
                            <Button
                                onClick={handleGenerateCertificate}
                                disabled={isActionLocked || !recipientName || !eventName || !issuerName || !studentId || !issuerWallet || !expiryDate}
                                className="w-full"
                                data-testid="button-generate-certificate"
                            >
                                {isGeneratingPreview ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Preparing Preview...
                                    </>
                                ) : isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Signing & Issuing...
                                    </>
                                ) : (
                                    <>
                                        <Award className="h-4 w-4 mr-2" />
                                        Generate Certificate
                                    </>
                                )}
                            </Button>

                            {previewData && (
                                <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg transition-all duration-300 animate-in fade-in-0 slide-in-from-top-1" data-testid="section-certificate-preview">
                                    <p className="text-sm font-semibold text-blue-900">Preview Certificate</p>
                                    <div className="text-sm text-blue-900 space-y-1">
                                        <p><strong>Name:</strong> {previewData.name}</p>
                                        <p><strong>Course:</strong> {previewData.course}</p>
                                        <p><strong>Issuer:</strong> {previewData.issuerName}</p>
                                        <p><strong>Certificate ID:</strong> {previewData.certificateId}</p>
                                        <p><strong>Issue Date:</strong> {previewData.issueDate}</p>
                                        <p><strong>Expiry Date:</strong> {previewData.expiryDate}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label htmlFor="signature-pad" className="flex items-center gap-2">
                                                <span>Signature</span>
                                                {signatureMode === "draw" && drawingMode && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Drawing Mode</span>
                                                )}
                                                {signatureMode === "upload" && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Uploaded</span>
                                                )}
                                            </Label>
                                            <p className="text-xs text-gray-600 mt-1">
                                                {drawingMode ? "Click to stop drawing" : "Click canvas to start drawing"}
                                            </p>
                                        </div>
                                        <canvas
                                            id="signature-pad"
                                            ref={signatureCanvasRef}
                                            width={500}
                                            height={250}
                                            className="w-full border-2 border-blue-300 rounded-lg bg-white cursor-crosshair touch-none transition-shadow hover:shadow-md"
                                            onMouseDown={handleSignatureMouseDown}
                                            onMouseMove={handleSignatureMouseMove}
                                            onMouseUp={handleSignatureMouseUp}
                                            onMouseLeave={() => {
                                                if (drawingMode) setDrawingMode(false);
                                            }}
                                            onTouchStart={handleSignatureTouchStart}
                                            onTouchMove={handleSignatureTouchMove}
                                            onTouchEnd={handleSignatureTouchEnd}
                                            data-testid="canvas-signature-pad"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                onClick={clearSignature} 
                                                disabled={isActionLocked || !signatureDataUrl}
                                                size="sm"
                                                data-testid="button-clear-signature"
                                            >
                                                Clear
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                onClick={undoStroke}
                                                disabled={isActionLocked || signatureMode === "upload" || strokes.length === 0}
                                                size="sm"
                                                data-testid="button-undo-signature"
                                            >
                                                <Undo2 className="h-4 w-4 mr-1" />
                                                Undo
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                onClick={() => uploadInputRef.current?.click()}
                                                disabled={isActionLocked || drawingMode}
                                                size="sm"
                                                data-testid="button-upload-signature"
                                            >
                                                <Upload className="h-4 w-4 mr-1" />
                                                Upload
                                            </Button>
                                            {uploadedSignature && (
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    onClick={() => {
                                                        setUploadedSignature("");
                                                        setSignatureMode("draw");
                                                    }}
                                                    size="sm"
                                                    data-testid="button-remove-uploaded"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <input
                                                ref={uploadInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg"
                                                onChange={handleSignatureUpload}
                                                style={{ display: "none" }}
                                                data-testid="input-signature-upload"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleProceedToSign}
                                        disabled={isActionLocked || !signatureDataUrl || isSigningInProgress}
                                        className="w-full"
                                        data-testid="button-proceed-to-sign"
                                    >
                                        {isSubmitting || isSigningInProgress ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Signing & Issuing...
                                            </>
                                        ) : (
                                            "Sign & Issue"
                                        )}
                                    </Button>
                                </div>
                            )}

                            {isSigned && generatedCertificate && (
                                <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg transition-all duration-300 animate-in fade-in-0 slide-in-from-top-1">
                                    <p className="text-sm text-green-800 font-medium">✓ Certificate Generated Successfully!</p>
                                    <Button
                                        onClick={handleDownload}
                                        disabled={isActionLocked}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        data-testid="button-download-certificate"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Certificate (PNG)
                                    </Button>
                                    <Button variant="ghost" onClick={handleReset} disabled={isActionLocked} className="w-full text-sm">
                                        Create Another Certificate
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Preview Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Live Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto border rounded-lg p-4 bg-gray-50">
                            {/* Scaled preview for display */}
                            <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "400px", height: "300px" }}>
                                <CertificateTemplate
                                    data={{
                                        name: recipientName,
                                        email: recipientEmail,
                                        studentId,
                                        course: eventName,
                                        issuer: issuerName,
                                        date: issueDate ? new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "",
                                        certificateId: certificateId || "CERT-XXXX-XXXX",
                                        network: "Sepolia",
                                        qrCode: qrCodeDataUrl || undefined,
                                        signature: signatureDataUrl || undefined,
                                    }}
                                />
                            </div>
                        </div>
                        {/* Full-size hidden certificate for html2canvas capture */}
                        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                            <CertificateTemplate
                                ref={certificateRef}
                                data={{
                                    name: recipientName,
                                    email: recipientEmail,
                                    studentId,
                                    course: eventName,
                                    issuer: issuerName,
                                    date: issueDate ? new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "",
                                    certificateId: certificateId || "CERT-XXXX-XXXX",
                                    network: "Sepolia",
                                    qrCode: qrCodeDataUrl || undefined,
                                    signature: signatureDataUrl || undefined,
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
