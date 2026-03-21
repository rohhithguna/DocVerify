import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, Upload, Image as ImageIcon } from "lucide-react";
import IssuerNavbar from "@/components/issuer-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2.5);
  const [undoStack, setUndoStack] = useState<Array<{ dataUrl: string; hadStroke: boolean }>>([]);
  const [hasCanvasStroke, setHasCanvasStroke] = useState(false);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.lineWidth = strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }, [strokeWidth]);

  const getPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const persistCanvasToDraft = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    updateDraft({ signatureDataUrl: canvas.toDataURL() });
  };

  const drawSmoothedSegment = (nextPoint: { x: number; y: number }) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const lastPoint = lastPointRef.current;
    if (!lastPoint) {
      lastPointRef.current = nextPoint;
      return;
    }

    if (!strokeStartedRef.current) {
      setUndoStack((previous) => [
        ...previous.slice(-19),
        { dataUrl: canvas.toDataURL(), hadStroke: hasCanvasStroke },
      ]);
      strokeStartedRef.current = true;
    }

    const midX = (lastPoint.x + nextPoint.x) / 2;
    const midY = (lastPoint.y + nextPoint.y) / 2;

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    context.stroke();

    lastPointRef.current = nextPoint;
    setHasCanvasStroke(true);
  };

  const clearCanvasPixels = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const restoreSnapshot = (snapshot: { dataUrl: string; hadStroke: boolean }) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      clearCanvasPixels();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setHasCanvasStroke(snapshot.hadStroke);
      updateDraft({ signatureDataUrl: snapshot.hadStroke ? canvas.toDataURL() : "" });
    };
    image.src = snapshot.dataUrl;
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const point = getPointerPosition(event);
    lastPointRef.current = point;
    strokeStartedRef.current = false;

    if (isDrawMode) {
      setIsDrawMode(false);
      persistCanvasToDraft();
      return;
    }

    setIsDrawMode(true);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawMode) {
      return;
    }

    event.preventDefault();
    const point = getPointerPosition(event);
    drawSmoothedSegment(point);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) {
      return;
    }

    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((previous) => previous.slice(0, -1));
    setIsDrawMode(false);
    lastPointRef.current = null;
    strokeStartedRef.current = false;
    restoreSnapshot(snapshot);
  };

  const clearSignature = () => {
    clearCanvasPixels();
    updateDraft({ signatureDataUrl: "" });
    setHasCanvasStroke(false);
    setIsDrawMode(false);
    setUndoStack([]);
    lastPointRef.current = null;
    strokeStartedRef.current = false;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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
      if (!dataUrl) {
        toast({
          title: "Upload failed",
          description: "Could not read the uploaded file.",
          variant: "destructive",
        });
        return;
      }

      const canvas = signatureCanvasRef.current;
      if (canvas) {
        clearCanvasPixels();
        setHasCanvasStroke(false);
        setIsDrawMode(false);
        setUndoStack([]);
        lastPointRef.current = null;
        strokeStartedRef.current = false;
      }

      updateDraft({ signatureDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    clearCanvasPixels();
    setHasCanvasStroke(false);
    setIsDrawMode(false);
    setUndoStack([]);
    lastPointRef.current = null;
    strokeStartedRef.current = false;
    updateDraft({ signatureDataUrl: "" });
  };

  const handleNext = () => {
    if (!draft.hasPreview || !draft.certificateId) {
      toast({
        title: "Complete previous step first",
        description: "Please provide certificate details before signing.",
        variant: "destructive",
      });
      navigate("/certificate/create");
      return;
    }

    if (!draft.signatureDataUrl) {
      toast({
        title: "Signature required",
        description: "Please sign in the signature pad before continuing.",
        variant: "destructive",
      });
      return;
    }

    navigate("/certificate/preview");
  };

  return (
    <div className="min-h-screen bg-background">
      <IssuerNavbar />
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Signature</h1>
          <p className="text-muted-foreground">Step 2 of 3: capture issuer signature and continue to preview.</p>
        </div>

        {!draft.hasPreview && (
          <Card className="mb-6 border-destructive/40">
            <CardContent className="py-4 flex items-center justify-between">
              <p className="text-sm text-destructive">Certificate details are incomplete. Create a draft before signing.</p>
              <Button variant="outline" onClick={() => navigate("/certificate/create")}>Go to Details</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenLine className="h-5 w-5" />
                  Digital Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Click once to {isDrawMode ? "stop" : "start"} draw mode, then move mouse or touch to sign.
                  </div>
                  <div className="flex items-center gap-3">
                    <label htmlFor="stroke-width" className="text-sm text-muted-foreground">Stroke width</label>
                    <input
                      id="stroke-width"
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={strokeWidth}
                      onChange={(event) => setStrokeWidth(Number(event.target.value))}
                      className="w-28"
                    />
                    <span className="w-10 text-right text-sm font-medium text-foreground">{strokeWidth.toFixed(1)}</span>
                  </div>
                </div>
                <div className="border rounded-lg bg-white p-3">
                  <canvas
                    ref={signatureCanvasRef}
                    width={1400}
                    height={420}
                    className={`w-full min-h-[400px] h-[48vh] max-h-[560px] border border-dashed rounded touch-none ${isDrawMode ? "border-emerald-500 cursor-crosshair" : "border-gray-300 cursor-pointer"}`}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleUndo} disabled={undoStack.length === 0}>
                      Undo
                    </Button>
                    <Button variant="outline" onClick={clearCanvas} disabled={!hasCanvasStroke}>
                      Clear
                    </Button>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/certificate/create")}>Back to Details</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Finalize</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Issuer: <span className="text-foreground font-medium">{draft.issuerName || "-"}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Certificate ID: <span className="text-foreground font-medium">{draft.certificateId || "-"}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={handleNext}
                  disabled={!draft.hasPreview || !draft.signatureDataUrl}
                  data-testid="button-go-preview"
                >
                  Continue to Certificate Preview
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileUpload}
              />

              <Button className="w-full gap-2" variant="outline" onClick={handleUploadClick}>
                <Upload className="h-4 w-4" />
                Upload PNG or JPG
              </Button>

              <div className="rounded-lg border bg-muted/20 p-3 min-h-[210px] flex items-center justify-center">
                {draft.signatureDataUrl ? (
                  <img
                    src={draft.signatureDataUrl}
                    alt="Signature preview"
                    className="max-h-[180px] w-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground text-center space-y-2">
                    <ImageIcon className="h-6 w-6 mx-auto" />
                    <p>No uploaded signature yet</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button className="flex-1" variant="outline" onClick={handleUploadClick}>
                  Replace
                </Button>
                <Button className="flex-1" variant="outline" onClick={clearSignature} disabled={!draft.signatureDataUrl && !hasCanvasStroke}>
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
