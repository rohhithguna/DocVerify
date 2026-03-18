import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CloudUpload, FileText, Upload, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequestMultipart, queryClient } from "@/lib/queryClient";

interface FileUploadProps {
  issuerId?: string;
  verifierId?: string;
  onUploadSuccess?: () => void;
  onVerificationComplete?: (verification: any) => void;
  onUploadStart?: () => void;
}

export default function FileUpload({
  issuerId,
  verifierId,
  onUploadSuccess,
  onVerificationComplete,
  onUploadStart
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [groupingCriterion, setGroupingCriterion] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const { toast } = useToast();

  const isIssuerMode = !!issuerId;
  const isVerifierMode = !!verifierId;

  // Upload mutation for issuer
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
      // Invalidate issuer queries
      if (issuerId) {
        queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'batches'] });
        queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/blockchain/status'] });

      setFile(null);
      setBatchName("");
      setGroupingCriterion("");
      setIssuerName("");
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

  // Verification mutation for verifier
  const verifyMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequestMultipart('POST', '/api/verifier/verify', formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Complete",
        description: `Document verified with ${data.results.confidenceScore}% confidence`,
      });
      // Invalidate verifier queries
      if (verifierId) {
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', verifierId, 'history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/verifier', verifierId, 'stats'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });

      setFile(null);
      onVerificationComplete?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify document",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size (FIX for BUG #11)
    const maxSize = isIssuerMode ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB or 10MB
    if (selectedFile.size > maxSize) {
      const maxSizeMB = maxSize / 1024 / 1024;
      toast({
        title: "File Too Large",
        description: `File must be less than ${maxSizeMB}MB. Your file is ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
        variant: "destructive",
      });
      // Clear the input
      e.target.value = '';
      return;
    }

    // Validate file type
    if (isIssuerMode && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file (.csv extension)",
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    if (isIssuerMode) {
      // Validate all required fields (FIX for BUG #10)
      if (!issuerId) {
        toast({
          title: "Configuration Error",
          description: "Issuer ID is missing. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      if (!batchName || !groupingCriterion || !issuerName) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      formData.append('batchName', batchName);
      formData.append('issuerId', issuerId);
      formData.append('issuerName', issuerName);
      formData.append('groupingCriterion', groupingCriterion);

      onUploadStart?.();
      uploadMutation.mutate(formData);
    } else if (isVerifierMode) {
      if (!verifierId) {
        toast({
          title: "Configuration Error",
          description: "Verifier ID is missing. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      formData.append('verifierId', verifierId);
      onUploadStart?.();
      verifyMutation.mutate(formData);
    }
  };

  const isProcessing = uploadMutation.isPending || verifyMutation.isPending;

  return (
    <div className="space-y-6">
      {/* File Upload Zone */}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
        <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {isIssuerMode ? 'Upload CSV File' : 'Upload Document'}
        </h3>
        <p className="text-muted-foreground mb-4">
          {isIssuerMode
            ? 'Drag and drop your CSV file here or click to browse'
            : 'Upload a document to verify its authenticity'
          }
        </p>

        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={isIssuerMode ? '.csv' : '.pdf,.jpg,.jpeg,.png'}
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />

        <Button asChild variant="outline" data-testid="button-choose-file">
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            Choose File
          </label>
        </Button>

        <p className="text-xs text-muted-foreground mt-2">
          {isIssuerMode
            ? 'Supports: .csv files up to 50MB'
            : 'Supports: PDF, JPG, PNG files up to 10MB'
          }
        </p>
      </div>

      {/* Selected File Display */}
      {file && (
        <div className="bg-accent rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-accent-foreground" data-testid="text-selected-file">
                {file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-600" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              data-testid="button-remove-file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Issuer Configuration */}
      {isIssuerMode && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="issuer-name">Issuer Name</Label>
            <Input
              id="issuer-name"
              value={issuerName}
              onChange={(e) => setIssuerName(e.target.value)}
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
              placeholder="Enter batch identifier"
              data-testid="input-batch-name"
            />
          </div>

          <div>
            <Label htmlFor="grouping-criterion">Grouping Criterion</Label>
            <Select value={groupingCriterion} onValueChange={setGroupingCriterion}>
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

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!file || isProcessing || (isIssuerMode && (!batchName || !groupingCriterion || !issuerName))}
        className="w-full"
        data-testid={isIssuerMode ? "button-process-sign" : "button-start-verification"}
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{isIssuerMode ? 'Processing...' : 'Verifying...'}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            {isIssuerMode ? (
              <>
                <Upload className="h-4 w-4" />
                <span>Process & Sign</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Start Verification</span>
              </>
            )}
          </div>
        )}
      </Button>
    </div>
  );
}
