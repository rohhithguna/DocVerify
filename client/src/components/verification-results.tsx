import { CheckCircle, Link, FileSignature, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VerificationResultsProps {
  verification: {
    verification: any;
    results: {
      digitalSignatureValid: boolean;
      merkleProofValid: boolean;
      blockchainVerified: boolean;
      confidenceScore: number;
      matchedBatch?: {
        id: string;
        batchName: string;
        issuerName: string;
        createdAt: string;
      };
    };
  };
}

export default function VerificationResults({ verification }: VerificationResultsProps) {
  const { results } = verification;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  // Calculate stroke offset for circular progress
  const circumference = 2 * Math.PI * 56;
  const strokeOffset = circumference - (results.confidenceScore / 100) * circumference;

  return (
    <Card data-testid="card-verification-results">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Verification Results</CardTitle>
          <Badge 
            variant={results.confidenceScore >= 70 ? "default" : "destructive"}
            className={results.confidenceScore >= 70 ? "bg-green-100 text-green-800" : ""}
          >
            {results.confidenceScore >= 70 ? "Verified" : "Failed"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Confidence Score Circle */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle 
                cx="64" 
                cy="64" 
                r="56" 
                stroke="currentColor" 
                strokeWidth="8" 
                fill="transparent" 
                className="text-muted"
              />
              <circle 
                cx="64" 
                cy="64" 
                r="56" 
                stroke="currentColor" 
                strokeWidth="8" 
                fill="transparent" 
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className={getScoreRingColor(results.confidenceScore)}
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              />
            </svg>
            <div className="absolute text-center">
              <span 
                className={`text-3xl font-bold ${getScoreColor(results.confidenceScore)}`}
                data-testid="text-confidence-score"
              >
                {results.confidenceScore}%
              </span>
              <p className="text-sm text-muted-foreground">Confidence</p>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            results.digitalSignatureValid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <FileSignature className={results.digitalSignatureValid ? 'text-green-600' : 'text-red-600'} />
              <span className="text-sm font-medium">Digital Signature</span>
            </div>
            <span 
              className={`font-medium ${results.digitalSignatureValid ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-signature-status"
            >
              {results.digitalSignatureValid ? 'Valid' : 'Invalid'}
            </span>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            results.blockchainVerified 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <Link className={results.blockchainVerified ? 'text-green-600' : 'text-red-600'} />
              <span className="text-sm font-medium">Blockchain Verification</span>
            </div>
            <span 
              className={`font-medium ${results.blockchainVerified ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-blockchain-status"
            >
              {results.blockchainVerified ? 'Confirmed' : 'Failed'}
            </span>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            results.merkleProofValid 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 flex items-center justify-center ${
                results.merkleProofValid ? 'text-blue-600' : 'text-red-600'
              }`}>
                🌳
              </div>
              <span className="text-sm font-medium">Merkle Proof</span>
            </div>
            <span 
              className={`font-medium ${results.merkleProofValid ? 'text-blue-600' : 'text-red-600'}`}
              data-testid="text-merkle-status"
            >
              {results.merkleProofValid ? 'Valid' : 'Invalid'}
            </span>
          </div>
        </div>

        {/* Document Details */}
        {results.matchedBatch && (
          <div className="bg-accent rounded-lg p-4">
            <h4 className="font-medium text-accent-foreground mb-3">Document Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issuer:</span>
                <span className="text-accent-foreground font-mono" data-testid="text-issuer-name">
                  {results.matchedBatch.issuerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch:</span>
                <span className="text-accent-foreground font-mono" data-testid="text-batch-name">
                  {results.matchedBatch.batchName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue Date:</span>
                <span className="text-accent-foreground" data-testid="text-issue-date">
                  {new Date(results.matchedBatch.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No Match Found */}
        {!results.matchedBatch && results.confidenceScore === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <h4 className="font-medium text-amber-800">No Matching Document Found</h4>
                <p className="text-sm text-amber-700 mt-1">
                  This document could not be matched against any verified batches in our system.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
