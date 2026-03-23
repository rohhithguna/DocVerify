import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, Upload, Image as ImageIcon, ArrowLeft, ArrowRight, ShieldCheck, Undo2, Eraser, CheckCircle2 } from "lucide-react";
import IssuerNavbar from "@/components/issuer-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIssuerCertificateDraft } from "@/context/issuer-certificate-draft";

export default function CertificateSignPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { draft, updateDraft } = useIssuerCertificateDraft();

  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokeStartedRef = useRef(false);
  
  const [activeTab, setActiveTab] = useState<"draw" | "upload">("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2.5);
  const [undoStack, setUndoStack] = useState<Array<{ dataUrl: string; hadStroke: boolean }>>([]);
  const [hasCanvasStroke, setHasCanvasStroke] = useState(false);

  // Initialize Canvas
  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Scale stroke visually since raw canvas is 1400px wide
    context.lineWidth = strokeWidth * 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }, [strokeWidth, activeTab]);

  const getPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale accurately mapping DOM pixels to Canvas internal coordinate pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const persistCanvasToDraft = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    updateDraft({ signatureDataUrl: canvas.toDataURL() });
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (!strokeStartedRef.current) {
      setUndoStack((prev) => [...prev.slice(-19), { dataUrl: canvas.toDataURL(), hadStroke: hasCanvasStroke }]);
      strokeStartedRef.current = true;
    }

    setIsDrawing(true);
    const pos = getPointerPosition(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y); // Creates a dot immediately on touch
    ctx.stroke();
    lastPointRef.current = pos;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    event.preventDefault();
    
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const pos = getPointerPosition(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
    
    if (!hasCanvasStroke) setHasCanvasStroke(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    strokeStartedRef.current = false;
    persistCanvasToDraft();
  };

  const clearCanvasPixels = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const restoreSnapshot = (snapshot: { dataUrl: string; hadStroke: boolean }) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      clearCanvasPixels();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setHasCanvasStroke(snapshot.hadStroke);
      updateDraft({ signatureDataUrl: snapshot.hadStroke ? canvas.toDataURL() : "" });
    };
    image.src = snapshot.dataUrl;
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((previous) => previous.slice(0, -1));
    setIsDrawing(false);
    lastPointRef.current = null;
    strokeStartedRef.current = false;
    restoreSnapshot(snapshot);
  };

  const clearSignature = () => {
    clearCanvasPixels();
    updateDraft({ signatureDataUrl: "" });
    setHasCanvasStroke(false);
    setIsDrawing(false);
    setUndoStack([]);
    lastPointRef.current = null;
    strokeStartedRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isSupported = ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
    if (!isSupported) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PNG or JPG signature image.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;

      if (signatureCanvasRef.current) {
        clearCanvasPixels();
        setHasCanvasStroke(false);
        setIsDrawing(false);
        setUndoStack([]);
      }

      updateDraft({ signatureDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (!draft.certificateId) {
      toast({ title: "Incomplete", description: "Certificate details missing.", variant: "destructive" });
      navigate("/certificate/create");
      return;
    }

    if (!draft.signatureDataUrl) {
      toast({ title: "Signature Required", description: "Please sign before finalizing.", variant: "destructive" });
      return;
    }

    navigate("/certificate/preview");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-[#111827] pb-24 overflow-x-hidden">
      <IssuerNavbar />
      
      <main className="max-w-[840px] w-full mx-auto px-6 py-12 relative z-10">
        <div className="mb-10 w-full animate-in fade-in duration-500">
          <Button variant="ghost" onClick={() => navigate("/certificate/create")} className="mb-6 -ml-4 text-[#6b7280] hover:text-[#111827] hover:bg-transparent px-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Details
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] mb-2">Digital Signature</h1>
          <p className="text-[#6b7280]">Provide the cryptographically binding issuer signature to authenticate this document.</p>
        </div>

        <Card className="rounded-[12px] border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-[#ffffff] overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-8 sm:p-10 min-h-[500px] flex flex-col justify-between relative">
            
            <div className="w-full">
              {/* Tab Navigation */}
              <div className="flex bg-[#f3f4f6] p-1.5 rounded-[12px] w-full max-w-[440px] mb-10 mx-auto">
                <button 
                  onClick={() => setActiveTab('draw')} 
                  className={`flex-1 rounded-[8px] py-2.5 text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2.5 ${activeTab === 'draw' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-[#111827]' : 'text-[#6b7280] hover:text-[#111827]'}`}
                >
                  <PenLine className="w-4 h-4" /> Draw Signature
                </button>
                <button 
                  onClick={() => setActiveTab('upload')} 
                  className={`flex-1 rounded-[8px] py-2.5 text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2.5 ${activeTab === 'upload' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-[#111827]' : 'text-[#6b7280] hover:text-[#111827]'}`}
                >
                   <Upload className="w-4 h-4" /> Upload Image
                </button>
              </div>

              {/* Draw Tab */}
              {activeTab === 'draw' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between px-1 gap-4">
                    <div className="flex items-center gap-4">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Stroke Thickness</Label>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        step={0.5}
                        value={strokeWidth}
                        onChange={(event) => setStrokeWidth(Number(event.target.value))}
                        className="w-32 accent-[#111827]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={handleUndo} disabled={undoStack.length === 0} className="h-9 px-4 text-[#6b7280] hover:text-[#111827] bg-[#f8fafc] hover:bg-[#f3f4f6] rounded-[8px] font-semibold transition-all duration-200 hover:shadow-sm">
                        <Undo2 className="w-4 h-4 mr-2" /> Undo
                      </Button>
                      <Button variant="ghost" onClick={clearSignature} disabled={!hasCanvasStroke} className="h-9 px-4 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-[8px] font-semibold transition-all duration-200 hover:shadow-sm">
                           <Eraser className="w-4 h-4 mr-2" /> Clear
                      </Button>
                    </div>
                  </div>

                  <div 
                    className={`relative border-2 border-dashed rounded-[12px] bg-[#fafafa] overflow-hidden transition-all duration-300 ${
                      isDrawing ? 'border-[#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 'border-[#d1d5db] hover:border-[#9ca3af]'
                    }`}
                  >
                    <canvas
                      ref={signatureCanvasRef}
                      width={1400}
                      height={460}
                      className="w-full h-[320px] touch-none cursor-crosshair z-10 relative"
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                    />
                    
                    {!hasCanvasStroke && !isDrawing && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#9ca3af] z-0 animate-in fade-in duration-700">
                        <PenLine className="w-8 h-8 mb-3 opacity-50 text-[#d1d5db]" />
                        <span className="text-xl font-medium tracking-tight text-[#d1d5db]">Sign here</span>
                      </div>
                    )}

                    {hasCanvasStroke && !isDrawing && (
                      <div className="absolute top-4 right-4 pointer-events-none bg-green-50 text-green-600 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-green-100 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Captured</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Tab */}
              {activeTab === 'upload' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 max-w-[500px] mx-auto">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <div className="border-2 border-dashed border-[#e5e7eb] rounded-[12px] bg-[#fafafa] p-4 h-[320px] flex flex-col items-center justify-center transition-all hover:border-[#d1d5db]">
                    {draft.signatureDataUrl && !hasCanvasStroke ? (
                      <img
                        src={draft.signatureDataUrl}
                        alt="Signature preview"
                        className="max-h-[260px] w-full object-contain filter contrast-125 mix-blend-multiply"
                      />
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-white border border-[#e5e7eb] rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <ImageIcon className="h-6 w-6 text-[#9ca3af]" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-[#111827]">No signature uploaded</p>
                          <p className="text-sm text-[#6b7280]">Supports transparent PNG or JPEG.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button className="flex-1 h-11 rounded-[8px] bg-white border border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md" variant="outline" onClick={handleUploadClick}>
                      <Upload className="h-4 w-4" />
                      {draft.signatureDataUrl && !hasCanvasStroke ? "Replace File" : "Choose File"}
                    </Button>
                    {(draft.signatureDataUrl && !hasCanvasStroke) && (
                       <Button className="flex-1 h-11 rounded-[8px] bg-red-50 text-red-600 border border-transparent hover:bg-red-100 font-semibold transition-all duration-200 hover:shadow-md" variant="outline" onClick={clearSignature}>
                         Clear Image
                       </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Trust Box */}
              <div className="mt-8 flex items-start gap-3.5 p-5 rounded-[12px] bg-[#f8fafc] border border-[#e5e7eb] shadow-sm">
                <ShieldCheck className="w-6 h-6 text-[#2563eb] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#4b5563] leading-relaxed">
                  <strong className="text-[#111827]">Cryptographic Binding:</strong> This signature will be securely embedded into the visual template and mathematically hashed onto the blockchain registry. Ensure it represents the authorized issuer.
                </p>
              </div>

            </div>

            {/* NAVIGATION FOOTER */}
            <div className={`mt-10 pt-6 border-t border-[#e5e7eb] flex items-center justify-between w-full`}>
              <Button 
                onClick={() => navigate("/certificate/create")} 
                variant="outline" 
                className="h-11 px-6 rounded-[8px] font-semibold border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                Back to Details
              </Button>
              
              <Button 
                onClick={handleNext} 
                disabled={!draft.signatureDataUrl}
                className="h-11 px-8 rounded-[8px] font-semibold bg-[#111827] text-white hover:bg-[#000000] shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
              >
                Continue to Preview <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
