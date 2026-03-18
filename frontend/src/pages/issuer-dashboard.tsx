import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileText, Link, CheckCircle, TrendingUp, Trash2, LogOut, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CertificateForm from "@/components/certificate-form";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { DocumentBatchWithStats, BlockchainStatus } from "@shared/schema";

export default function IssuerDashboard() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { user, token, logout } = useAuth();
  // Use auth user ID, fallback to URL param for backward compat
  const issuerId = user?.id || params.issuerId as string;
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch issuer statistics
  const { data: stats } = useQuery<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }>({
    queryKey: ['/api/issuer', issuerId, 'stats'],
    enabled: !!issuerId,
  });

  // Fetch document batches
  const { data: batches, refetch: refetchBatches } = useQuery<DocumentBatchWithStats[]>({
    queryKey: ['/api/issuer', issuerId, 'batches'],
    enabled: !!issuerId,
  });

  // Fetch blockchain status
  const { data: blockchainStatus } = useQuery<BlockchainStatus>({
    queryKey: ['/api/blockchain/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleUploadSuccess = () => {
    refetchBatches();
    setIsProcessing(false);
  };

  const handleUploadStart = () => {
    setIsProcessing(true);
  };

  const { toast } = useToast();

  // Delete batch mutation
  const deleteMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest('DELETE', `/api/issuer/${issuerId}/batch/${batchId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Deleted",
        description: "The document batch has been deleted successfully.",
      });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete batch",
        variant: "destructive",
      });
    },
  });

  // Revoke batch mutation
  const revokeMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest('POST', `/api/issuer/revoke`, { batchId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Revoked",
        description: `Document has been revoked on blockchain. TX: ${data.blockchain?.txHash?.slice(0, 16)}...`,
      });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: ['/api/issuer', issuerId, 'stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke document",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl text-foreground">DocuTrust</span>
              </div>
              <div className="text-muted-foreground text-sm hidden md:block">
                Dashboard {'>'} Issuer
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="text-sm text-muted-foreground">
                  {user.name} ({user.email})
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => { logout(); setLocation('/'); }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Issuer Dashboard</h1>
          <p className="text-muted-foreground">Upload and manage document batches with blockchain verification</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-documents">
                    {stats?.totalDocuments || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Blockchain Roots</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-blockchain-roots">
                    {stats?.totalBatches || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Link className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Verifications</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-verifications">
                    {stats?.totalVerifications || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Success Rate</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-success-rate">
                    {stats?.successRate ? `${stats.successRate.toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Certificate Creation Section */}
          <div className="lg:col-span-2">
            <CertificateForm
              issuerId={issuerId}
              onCertificateCreated={handleUploadSuccess}
            />
          </div>

          {/* Blockchain Status */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Blockchain Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <Badge variant="outline" className="text-green-700 bg-green-50">
                      {blockchainStatus?.network || 'Sepolia Testnet'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Block Height</span>
                    <span className="text-sm font-mono text-foreground" data-testid="text-block-height">
                      #{blockchainStatus?.blockHeight || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Gas Price</span>
                    <span className="text-sm text-foreground" data-testid="text-gas-price">
                      {blockchainStatus?.gasPrice || '0'} gwei
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${blockchainStatus?.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm text-foreground" data-testid="text-blockchain-status">
                        {blockchainStatus?.status === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Document Batches Table */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Issued Certificates</CardTitle>
              <p className="text-muted-foreground text-sm">Manage your issued certificates and their blockchain status</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Merkle Root</TableHead>
                      <TableHead>Blockchain Status</TableHead>
                      <TableHead>Verifications</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches?.map((batch) => (
                      <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{batch.batchName}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{batch.documentCount} docs</div>
                          <div className="text-sm text-muted-foreground">{batch.fileName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1 max-w-xs overflow-hidden">
                            {batch.merkleRoot ? `${batch.merkleRoot.slice(0, 16)}...` : 'Processing...'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={batch.status === 'completed' ? 'default' : 'secondary'}
                            className={
                              batch.status === 'revoked' ? 'bg-red-100 text-red-800' :
                              batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                                batch.status === 'blockchain_stored' ? 'bg-blue-100 text-blue-800' :
                                  batch.status === 'signed' ? 'bg-purple-100 text-purple-800' :
                                    'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {batch.status === 'revoked' ? '⛔ Revoked' :
                              batch.status === 'completed' ? 'Confirmed' :
                              batch.status === 'blockchain_stored' ? 'Stored' :
                                batch.status === 'signed' ? 'Signed' :
                                  'Processing'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {batch.verificationCount || 0}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {/* Revoke button — only for non-revoked batches with blockchain records */}
                            {batch.status !== 'revoked' && batch.merkleRoot && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    disabled={revokeMutation.isPending}
                                  >
                                    <Ban className="h-4 w-4 mr-1" />
                                    Revoke
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke Document?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently revoke "{batch.batchName}" on the blockchain.
                                      Once revoked, the document will fail all future verifications.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => revokeMutation.mutate(batch.id)}
                                      className="bg-orange-600 text-white hover:bg-orange-700"
                                    >
                                      Revoke on Blockchain
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {batch.status === 'revoked' && (
                              <span className="text-xs text-red-600 font-medium">Revoked</span>
                            )}

                            <Button variant="link" size="sm">
                              View
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Certificate?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{batch.batchName}". This action cannot be undone. Note: Blockchain records are permanent and will not be affected.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(batch.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!batches || batches.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No certificates issued yet. Create your first certificate above to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
