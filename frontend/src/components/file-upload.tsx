import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequestMultipart, queryClient } from "@/lib/queryClient";

/* Issuer-mode UI components — only imported when needed */
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface FileUploadProps {
  issuerId?: string;
  verifierId?: string;
  onUploadSuccess?: () => void;
  onVerificationComplete?: (verification: any) => void;
  onVerificationError?: (message: string) => void;
  onUploadStart?: () => void;
  onFilePreview?: (url: string | null) => void;
  onFileSelected?: (fileName: string) => void;
}

export default function FileUpload({
  issuerId,
  verifierId,
  onUploadSuccess,
  onVerificationComplete,
  onVerificationError,
  onUploadStart,
  onFilePreview,
  onFileSelected,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [groupingCriterion, setGroupingCriterion] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [inlineStatusMessage, setInlineStatusMessage] = useState("");
  const [inlineStatusType, setInlineStatusType] = useState<"idle" | "info" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isIssuerMode = !!issuerId;
  const isVerifierMode = !isIssuerMode;
  const activeVerifierId = verifierId || "guest";

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
  };

  // ─── Mutations ───
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequestMultipart('POST', '/api/issuer/upload', formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `${data.documentsProcessed} documents processed and stored on blockchain`,
      });
      if (issuerId) {
        queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'batches'] });
        queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/blockchain/status'] });
      clearFile();
      onUploadSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process upload",
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequestMultipart('POST', '/api/verifier/verify', formData);
      return response.json();
    },
    onSuccess: (data) => {
      const status = data?.status || data?.results?.status;
      const isNotFound = status === "NOT_FOUND";
      const isOrphaned = status === "ORPHANED";
      toast({
        title: isNotFound || isOrphaned ? "Invalid Certificate" : "Verification Complete",
        description: isNotFound
          ? "Certificate not found (possibly deleted). Confidence: 0%"
          : isOrphaned
            ? "Certificate deleted from system but exists on blockchain. Confidence: 0%"
            : data?.results?.confidenceScore !== undefined
              ? `Document verified with ${data.results.confidenceScore}% confidence`
              : "Document verification completed successfully",
      });
      if (activeVerifierId && activeVerifierId !== "guest") {
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', activeVerifierId, 'history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', activeVerifierId, 'stats'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      setInlineStatusType(isNotFound || isOrphaned ? "error" : "success");
      setInlineStatusMessage(
        isNotFound
          ? "Invalid certificate: not found in system."
          : isOrphaned
            ? "Certificate deleted from system but exists on blockchain."
            : "Verification completed successfully."
      );
      onVerificationComplete?.(data);
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to verify document");
      toast({
        title: "Verification Failed",
        description: message,
        variant: "destructive",
      });
      setInlineStatusType("error");
      setInlineStatusMessage(message);
      onVerificationError?.(message);
    },
  });

  const verifyByQrMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('verifierId', activeVerifierId);
      const response = await apiRequestMultipart('POST', '/api/verifier/verify', formData);
      return response.json();
    },
    onSuccess: (data) => {
      const statusLabel = data.status || (data.isRevoked ? "REVOKED" : data.isValid ? "VALID" : "INVALID");
      toast({
        title: `Verification Complete: ${statusLabel}`,
        description: data.message,
      });
      if (activeVerifierId && activeVerifierId !== "guest") {
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', activeVerifierId, 'history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', activeVerifierId, 'stats'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      setInlineStatusType(statusLabel === "NOT_FOUND" || statusLabel === "ORPHANED" ? "error" : "success");
      setInlineStatusMessage(data?.message || `Verification result: ${statusLabel}`);
      onVerificationComplete?.(data);
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to verify certificate using QR metadata");
      toast({
        title: "Verification Failed",
        description: message.includes("Certificate not found in system")
          ? "Certificate not found in system"
          : message,
        variant: "destructive",
      });
      setInlineStatusType("error");
      setInlineStatusMessage(message);
      onVerificationError?.(message);
    },
  });

  // ─── File Handling ───
  const clearFile = useCallback(() => {
    setFile(null);
    onFilePreview?.(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [onFilePreview]);

  const processFile = useCallback((selectedFile: File) => {
    const maxSize = isIssuerMode ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      const maxSizeMB = maxSize / 1024 / 1024;
      toast({
        title: "File Too Large",
        description: `File must be less than ${maxSizeMB}MB.`,
        variant: "destructive",
      });
      return;
    }

    if (isIssuerMode && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file (.csv extension)",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setInlineStatusType("info");
    setInlineStatusMessage(isVerifierMode ? "Scanning document…" : "File selected.");

    // Generate preview for images/PDFs
    // Notify parent of selected file name
    onFileSelected?.(selectedFile.name);

    if (isVerifierMode && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      onFilePreview?.(url);
    } else {
      onFilePreview?.(null);
    }

    if (isVerifierMode) {
      onUploadStart?.();
      verifyByQrMutation.mutate(selectedFile);
    }
  }, [isIssuerMode, isVerifierMode, toast, onFilePreview, onFileSelected, onUploadStart, verifyByQrMutation]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, [processFile]);

  const handleSubmit = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    if (isIssuerMode) {
      if (!issuerId) {
        toast({ title: "Configuration Error", description: "Issuer ID is missing.", variant: "destructive" });
        return;
      }
      if (!batchName || !groupingCriterion || !issuerName) {
        toast({ title: "Missing Information", description: "Please fill in all required fields", variant: "destructive" });
        return;
      }
      formData.append('batchName', batchName);
      formData.append('issuerId', issuerId);
      formData.append('issuerName', issuerName);
      formData.append('groupingCriterion', groupingCriterion);
      onUploadStart?.();
      uploadMutation.mutate(formData);
    } else if (isVerifierMode) {
      formData.append('verifierId', activeVerifierId);
      onUploadStart?.();
      verifyMutation.mutate(formData);
    }
  };

  const isProcessing = uploadMutation.isPending || verifyMutation.isPending;
  const isAutoVerifying = verifyByQrMutation.isPending;
  const isBusy = isProcessing || isAutoVerifying;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── Drop Zone ─── */}
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onClick={() => !isBusy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ padding: file ? '24px 32px' : '48px 32px' }}
      >
        <input
          ref={inputRef}
          type="file"
          id="file-upload"
          style={{ display: 'none' }}
          accept={isIssuerMode ? '.csv' : '.pdf,.jpg,.jpeg,.png'}
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />

        {file ? (
          /* ─── Selected file ─── */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                data-testid="text-selected-file"
              >
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            {!isBusy && (
              <button
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="btn-ghost"
                style={{ padding: '6px 8px', fontSize: 12 }}
                data-testid="button-remove-file"
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          /* ─── Empty state ─── */
          <>
            <svg
              width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="var(--muted-foreground)" strokeWidth="1.5"
              style={{ marginBottom: 12, opacity: 0.4 }}
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              marginBottom: 4,
            }}>
              {isIssuerMode ? 'Upload CSV File' : 'Drop your document here'}
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--muted-foreground)',
              marginBottom: 16,
            }}>
              {isIssuerMode
                ? 'Drag and drop or click to browse'
                : 'PDF, JPG, or PNG — up to 10MB'}
            </div>
            <button
              className="btn-primary"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              disabled={isBusy}
              data-testid="button-choose-file"
            >
              {isBusy ? 'Please wait…' : 'Choose File'}
            </button>
          </>
        )}
      </div>

      {/* ─── Issuer Configuration ─── */}
      {isIssuerMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label htmlFor="issuer-name">Issuer Name</Label>
            <Input
              id="issuer-name"
              value={issuerName}
              onChange={(e) => setIssuerName(e.target.value)}
              disabled={isBusy}
              placeholder="Enter your organization name"
              data-testid="input-issuer-name"
            />
          </div>
          <div>
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              disabled={isBusy}
              placeholder="Enter batch identifier"
              data-testid="input-batch-name"
            />
          </div>
          <div>
            <Label htmlFor="grouping-criterion">Grouping Criterion</Label>
            <Select value={groupingCriterion} onValueChange={setGroupingCriterion} disabled={isBusy}>
              <SelectTrigger data-testid="select-grouping-criterion">
                <SelectValue placeholder="Select grouping method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="date">Date Range</SelectItem>
                <SelectItem value="type">Document Type</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ─── Submit Button ─── */}
      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!file || isBusy || (isIssuerMode && (!batchName || !groupingCriterion || !issuerName))}
        style={{ width: '100%', padding: '12px 24px' }}
        data-testid={isIssuerMode ? "button-process-sign" : "button-start-verification"}
      >
        {isBusy ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="animate-spin"
              style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
            {isIssuerMode ? 'Processing…' : 'Verifying…'}
          </span>
        ) : (
          isIssuerMode ? 'Process & Sign' : 'Run Manual Verification'
        )}
      </button>

      {/* ─── Inline Status ─── */}
      {isVerifierMode && inlineStatusType !== "idle" && (
        <div
          style={{
            fontSize: 13,
            padding: '12px 0',
            color: inlineStatusType === 'error'
              ? 'var(--invalid)'
              : inlineStatusType === 'success'
                ? 'var(--valid)'
                : 'var(--muted-foreground)',
          }}
          data-testid="verification-inline-status"
        >
          {inlineStatusMessage}
        </div>
      )}

      {isVerifierMode && (
        <p style={{
          fontSize: 12,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Upload automatically starts QR metadata verification.
          <br />
          Use the button above for manual re-check.
        </p>
      )}
    </div>
  );
}
