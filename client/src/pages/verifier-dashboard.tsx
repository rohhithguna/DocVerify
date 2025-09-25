import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Gauge, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FileUpload from "@/components/file-upload";
import VerificationResults from "@/components/verification-results";
import { useParams } from "wouter";
import { useState } from "react";
import type { VerificationWithDetails } from "@shared/schema";

export default function VerifierDashboard() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const verifierId = params.verifierId as string;
  const [currentVerification, setCurrentVerification] = useState(null);

  // Fetch verifier statistics
  const { data: stats } = useQuery<{
    totalVerifications: number;
    averageScore: number;
    failedVerifications: number;
    recentCount: number;
  }>({
    queryKey: ['/api/verifier', verifierId, 'stats'],
    enabled: !!verifierId,
  });

  // Fetch verification history
  const { data: history, refetch: refetchHistory } = useQuery<VerificationWithDetails[]>({
    queryKey: ['/api/verifier', verifierId, 'history'],
    enabled: !!verifierId,
  });

  const handleVerificationComplete = (verification: any) => {
    setCurrentVerification(verification);
    refetchHistory();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-xl text-foreground">DocuVerify</span>
              </div>
              <div className="text-muted-foreground text-sm hidden md:block">
                Dashboard {'>'} Verifier
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Mode: Verifier
              </div>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/')}
                data-testid="button-back-home"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Verifier Dashboard</h1>
          <p className="text-muted-foreground">Verify documents and view confidence scores</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Verifications</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-verifications">
                    {stats?.totalVerifications || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Average Score</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-average-score">
                    {stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Gauge className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Failed Verifications</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-failed-verifications">
                    {stats?.failedVerifications || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Last 24 Hours</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-recent-count">
                    {stats?.recentCount || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Document Verification */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Document Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload 
                  verifierId={verifierId} 
                  onVerificationComplete={handleVerificationComplete}
                />
              </CardContent>
            </Card>

            {/* Verification Results */}
            {currentVerification && (
              <VerificationResults verification={currentVerification} />
            )}
          </div>

          {/* Verification History */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {history?.slice(0, 10).map((verification) => (
                    <div 
                      key={verification.id} 
                      className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      data-testid={`card-verification-${verification.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {verification.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(verification.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            verification.status === 'verified' ? 'bg-green-500' : 
                            verification.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></div>
                          <span className={`text-sm font-medium ${
                            verification.status === 'verified' ? 'text-green-600' : 
                            verification.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {verification.confidenceScore !== null ? `${verification.confidenceScore}%` : 'Processing'}
                          </span>
                        </div>
                        <Button variant="link" size="sm" data-testid={`button-view-verification-${verification.id}`}>
                          View Details
                        </Button>
                      </div>
                      {verification.issuerName && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {verification.issuerName}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!history || history.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No verifications yet. Upload a document to get started.
                    </div>
                  )}
                </div>
                {history && history.length > 0 && (
                  <Button variant="outline" className="w-full mt-4" data-testid="button-view-all-history">
                    View All History
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
