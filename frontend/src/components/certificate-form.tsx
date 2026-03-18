import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { Download, Award, Loader2 } from "lucide-react";
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

export default function CertificateForm({ issuerId, onCertificateCreated }: CertificateFormProps) {
    const [recipientName, setRecipientName] = useState("");
    const [certificateTitle, setCertificateTitle] = useState("of Achievement");
    const [eventName, setEventName] = useState("");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [issuerName, setIssuerName] = useState("");
    const [certificateId, setCertificateId] = useState("");
    const [generatedCertificate, setGeneratedCertificate] = useState<string | null>(null);

    const certificateRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Generate unique certificate ID
    const generateCertificateId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CERT-${timestamp}-${random}`;
    };

    // Create certificate mutation
    const createCertificateMutation = useMutation({
        mutationFn: async (certificateData: {
            recipientName: string;
            certificateTitle: string;
            eventName: string;
            issueDate: string;
            issuerName: string;
            certificateId: string;
            imageData: string;
        }) => {
            const response = await apiRequest('POST', `/api/issuer/${issuerId}/create-certificate`, certificateData);
            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Certificate Created!",
                description: `Certificate for ${recipientName} has been signed and stored on blockchain.`,
            });
            queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'batches'] });
            queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
            onCertificateCreated?.();
        },
        onError: (error: any) => {
            toast({
                title: "Failed to Create Certificate",
                description: error.message || "Something went wrong",
                variant: "destructive",
            });
        },
    });

    const handleGenerateCertificate = async () => {
        if (!recipientName || !eventName || !issuerName) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        // Generate certificate ID if not set
        const certId = certificateId || generateCertificateId();
        setCertificateId(certId);

        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate image from certificate
        if (certificateRef.current) {
            try {
                const canvas = await html2canvas(certificateRef.current, {
                    backgroundColor: "#ffffff",
                    scale: 2,
                    logging: false,
                });

                const imageData = canvas.toDataURL("image/png");
                setGeneratedCertificate(imageData);

                // Send to backend
                createCertificateMutation.mutate({
                    recipientName,
                    certificateTitle,
                    eventName,
                    issueDate,
                    issuerName,
                    certificateId: certId,
                    imageData,
                });
            } catch (error) {
                console.error("Failed to generate certificate image:", error);
                toast({
                    title: "Generation Failed",
                    description: "Failed to generate certificate image",
                    variant: "destructive",
                });
            }
        }
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
        setCertificateTitle("of Achievement");
        setEventName("");
        setIssueDate(new Date().toISOString().split('T')[0]);
        setIssuerName("");
        setCertificateId("");
        setGeneratedCertificate(null);
    };

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
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="recipientName">Recipient Name *</Label>
                            <Input
                                id="recipientName"
                                value={recipientName}
                                onChange={(e) => setRecipientName(e.target.value)}
                                placeholder="Enter recipient's full name"
                                data-testid="input-recipient-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="certificateTitle">Certificate Title</Label>
                            <Input
                                id="certificateTitle"
                                value={certificateTitle}
                                onChange={(e) => setCertificateTitle(e.target.value)}
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
                                data-testid="input-issue-date"
                            />
                        </div>

                        <div>
                            <Label htmlFor="issuerName">Issuer / Organization Name *</Label>
                            <Input
                                id="issuerName"
                                value={issuerName}
                                onChange={(e) => setIssuerName(e.target.value)}
                                placeholder="Your organization name"
                                data-testid="input-issuer-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="certificateId">Certificate ID (auto-generated if empty)</Label>
                            <Input
                                id="certificateId"
                                value={certificateId}
                                onChange={(e) => setCertificateId(e.target.value)}
                                placeholder="Leave empty to auto-generate"
                                data-testid="input-certificate-id"
                            />
                        </div>

                        <div className="space-y-3 pt-4">
                            <Button
                                onClick={handleGenerateCertificate}
                                disabled={createCertificateMutation.isPending || !recipientName || !eventName || !issuerName}
                                className="w-full"
                                data-testid="button-generate-certificate"
                            >
                                {createCertificateMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Award className="h-4 w-4 mr-2" />
                                        Generate & Sign Certificate
                                    </>
                                )}
                            </Button>

                            {generatedCertificate && (
                                <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800 font-medium">✓ Certificate Generated Successfully!</p>
                                    <Button
                                        onClick={handleDownload}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        data-testid="button-download-certificate"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Certificate (PNG)
                                    </Button>
                                    <Button variant="ghost" onClick={handleReset} className="w-full text-sm">
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
                                    recipientName={recipientName}
                                    certificateTitle={certificateTitle}
                                    eventName={eventName}
                                    issueDate={issueDate ? new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ""}
                                    issuerName={issuerName}
                                    certificateId={certificateId || "CERT-XXXX-XXXX"}
                                />
                            </div>
                        </div>
                        {/* Full-size hidden certificate for html2canvas capture */}
                        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                            <CertificateTemplate
                                ref={certificateRef}
                                recipientName={recipientName}
                                certificateTitle={certificateTitle}
                                eventName={eventName}
                                issueDate={issueDate ? new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ""}
                                issuerName={issuerName}
                                certificateId={certificateId || "CERT-XXXX-XXXX"}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
