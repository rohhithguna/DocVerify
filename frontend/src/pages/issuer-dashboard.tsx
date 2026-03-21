import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { FileText, Link, CheckCircle, TrendingUp, Trash2, Ban, PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { DocumentBatchWithStats, BlockchainStatus } from "@shared/schema";
import IssuerNavbar from "@/components/issuer-navbar";

export default function IssuerDashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const { user, token } = useAuth();
  // Use auth user ID, fallback to URL param for backward compat
  const issuerId = user?.id || params.issuerId as string;
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [locallyDeletedCertificateIds, setLocallyDeletedCertificateIds] = useState<Set<string>>(new Set());
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalBatches: 0,
    totalVerifications: 0,
    successRate: 0,
  });

  // Fetch issuer statistics
  const { data: statsFromApi, refetch: refetchStats } = useQuery<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }>({
    queryKey: ['/api/issuer', issuerId, 'stats'],
    enabled: !!issuerId,
  });

  // Fetch document batches
  const {
    data: batches,
    refetch: refetchBatches,
    isLoading: isBatchesLoading,
    isError: isBatchesError,
  } = useQuery<DocumentBatchWithStats[]>({
    queryKey: ['/api/issuer', issuerId, 'batches'],
    enabled: !!issuerId,
  });

  // Centralized dashboard data fetching function
  const fetchDashboardData = useCallback(async () => {
    if (!issuerId) return;

    try {
      setIsLoadingDashboard(true);
      setDashboardError(null);

      // Fetch both batches and stats in parallel
      await Promise.all([refetchBatches(), refetchStats()]);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setDashboardError("Failed to fetch dashboard data. Please try again.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [issuerId, refetchBatches, refetchStats]);

  const updateStats = (sourceCertificates: any[] = certificates) => {
    const total = Math.max(0, sourceCertificates.length);
    const roots = Math.max(0, sourceCertificates.length);
    const verified = Math.max(
      0,
      sourceCertificates.reduce(
        (count, certificate) => count + (certificate.verificationCount || 0),
        0
      )
    );

    setStats((prev) => ({
      ...prev,
      totalDocuments: total,
      totalBatches: roots,
      totalVerifications: verified,
    }));
  };

  // Initial load: fetch dashboard data on component mount
  useEffect(() => {
    if (issuerId) {
      fetchDashboardData();
    }
  }, [issuerId, fetchDashboardData]);

  // Refresh data when user returns to dashboard tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && issuerId) {
        // User came back to the tab - refresh data
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [issuerId, fetchDashboardData]);

  useEffect(() => {
    const nextCertificates = (batches || [])
      .map((batch) => ({
        ...batch,
        id: batch.documentId || batch.id,
      }))
      .filter((batch) => !locallyDeletedCertificateIds.has(batch.id));
    setCertificates(nextCertificates);
    updateStats(nextCertificates);
  }, [batches, locallyDeletedCertificateIds]);

  useEffect(() => {
    if (!statsFromApi) {
      return;
    }

    setStats(statsFromApi);
  }, [statsFromApi]);

  // Fetch blockchain status
  const {
    data: blockchainStatus,
    isLoading: isBlockchainLoading,
    isError: isBlockchainError,
  } = useQuery<BlockchainStatus>({
    queryKey: ['/api/blockchain/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const normalizedBlockchainStatus = String(
    (blockchainStatus as any)?.status || (blockchainStatus as any)?.legacyStatus || "DISCONNECTED"
  ).toUpperCase();
  const blockchainStatusLabel =
    normalizedBlockchainStatus === "CONNECTED"
      ? "Connected"
      : normalizedBlockchainStatus === "DISCONNECTED"
        ? "Disconnected"
        : normalizedBlockchainStatus === "PENDING" || normalizedBlockchainStatus === "SYNCING"
          ? "Pending"
          : "Error";
  const blockchainDotClass =
    normalizedBlockchainStatus === "CONNECTED"
      ? "bg-green-500"
      : normalizedBlockchainStatus === "DISCONNECTED"
        ? "bg-red-500"
        : normalizedBlockchainStatus === "PENDING" || normalizedBlockchainStatus === "SYNCING"
          ? "bg-yellow-500"
          : "bg-red-700";

  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!certificates.find((certificate: any) => certificate.id === id)) {
      return;
    }

    if (isDeletingDocument) {
      return;
    }

    const prevCertificates = certificates;

    try {
      setIsDeletingDocument(true);

      // Optimistic UI update: remove from display immediately
      setCertificates((prev: any[]) => {
        const nextCertificates = prev.filter((c: any) => c.id !== id);
        updateStats(nextCertificates);
        return nextCertificates;
      });

      setLocallyDeletedCertificateIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const res = await fetch(`/api/issuer/certificate/${id}/delete`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await res.json();

      // Normal delete success (200)
      if (res.ok && data.success) {
        toast({
          title: "Document Deleted",
          description: "Certificate removed successfully.",
        });
        // Refresh dashboard data from backend
        await fetchDashboardData();
        return;
      }

      // Document not found (404) - already deleted, treat as success
      if (res.status === 404) {
        // Item already removed from UI optimistically, just sync stats
        toast({
          title: "Document Removed",
          description: "Certificate was already deleted.",
        });
        // Refresh dashboard data from backend
        await fetchDashboardData();
        return;
      }

      // Other errors - restore UI state
      setCertificates(prevCertificates);
      updateStats(prevCertificates);
      setLocallyDeletedCertificateIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      toast({
        title: "Delete Failed",
        description: data?.message || `Error: ${res.status}`,
        variant: "destructive",
      });
    } catch (err) {
      console.error("Delete error:", err);
      // Restore UI on network error
      setCertificates(prevCertificates);
      updateStats(prevCertificates);
      setLocallyDeletedCertificateIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Network error",
        variant: "destructive",
      });
    } finally {
      setIsDeletingDocument(false);
    }
  };

  // Revoke batch mutation
  const revokeMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest('POST', `/api/issuer/revoke`, { batchId });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Document Revoked",
        description: `Document has been revoked on blockchain. TX: ${data.blockchain?.txHash?.slice(0, 16)}...`,
      });
      // Refresh dashboard data from backend
      await fetchDashboardData();
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
      <IssuerNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Issuer Dashboard</h1>
            <p className="text-muted-foreground">Manage issued certificates and blockchain verification status.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => fetchDashboardData()} 
              variant="outline"
              size="sm"
              disabled={isLoadingDashboard}
              className="gap-2"
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
              {isLoadingDashboard ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={() => navigate("/certificate/create")} className="gap-2" data-testid="button-start-certificate-flow">
              <PlusCircle className="h-4 w-4" />
              Create Certificate
            </Button>
          </div>
        </div>

        {(isBatchesError || isBlockchainError || dashboardError) && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="issuer-dashboard-error">
            <div className="flex items-center justify-between gap-3">
              <span>
                {dashboardError
                  ? dashboardError
                  : isBatchesError
                    ? "Unable to load issued certificates."
                    : "Unable to load blockchain status."}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDashboardData()}
                disabled={isLoadingDashboard}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
                {isLoadingDashboard ? 'Refreshing...' : 'Retry'}
              </Button>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-documents">
                    {stats.totalDocuments || 0}
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
                    {stats.totalBatches || 0}
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
                    {stats.totalVerifications || 0}
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
                    {stats.successRate ? `${stats.successRate.toFixed(1)}%` : '0%'}
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
          <div className="lg:col-span-1 lg:col-start-3">
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
                      {isBlockchainLoading ? 'Loading...' : `#${blockchainStatus?.blockHeight || '0'}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Gas Price</span>
                    <span className="text-sm text-foreground" data-testid="text-gas-price">
                      {isBlockchainLoading ? 'Loading...' : `${blockchainStatus?.gasPrice || '0'} gwei`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${blockchainDotClass}`}></div>
                      <span className="text-sm text-foreground" data-testid="text-blockchain-status">
                        {isBlockchainLoading ? 'Loading...' : blockchainStatusLabel}
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
                    {isBatchesLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Loading issued certificates...
                        </TableCell>
                      </TableRow>
                    )}
                    {certificates.map((batch) => (
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
                            variant="secondary"
                            className={
                              batch.blockchainStatus === 'CONFIRMED'
                                ? 'bg-green-100 text-green-800'
                                : batch.blockchainStatus === 'FAILED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {batch.blockchainStatus || 'PENDING'}
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
                                    disabled={revokeMutation.isPending || isDeletingDocument}
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

                            <Button variant="link" size="sm" disabled className="opacity-50 cursor-not-allowed">
                              Details Soon
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={isDeletingDocument}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Certificate?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will mark "{batch.batchName}" as deleted in the system. Blockchain records are immutable and will remain for audit/verification history.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(batch.id)}
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
                    {!isBatchesLoading && certificates.length === 0 && (
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
