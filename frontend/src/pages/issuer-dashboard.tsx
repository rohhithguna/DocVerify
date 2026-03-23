import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { 
  FileText, Link as LinkIcon, CheckCircle, TrendingUp, Trash2, Ban, 
  PlusCircle, RefreshCw, Database, Activity, ShieldOff 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { DocumentBatchWithStats, BlockchainStatus } from "@shared/schema";
import IssuerNavbar from "@/components/issuer-navbar";

interface IssuerBatchesResponse {
  batches: DocumentBatchWithStats[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function IssuerDashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const { user, token } = useAuth();
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

  const { data: statsFromApi, refetch: refetchStats } = useQuery<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }>({
    queryKey: ['/api/issuer', issuerId, 'stats'],
    enabled: !!issuerId,
    staleTime: 60000,
    gcTime: 300000,
  });

  const {
    data: batchesResponse,
    refetch: refetchBatches,
    isLoading: isBatchesLoading,
    isError: isBatchesError,
  } = useQuery<IssuerBatchesResponse>({
    queryKey: ['/api/issuer', issuerId, 'batches'],
    enabled: !!issuerId,
    staleTime: 60000,
    gcTime: 300000,
  });

  const {
    data: blockchainStatus,
    isLoading: isBlockchainLoading,
    isError: isBlockchainError,
  } = useQuery<BlockchainStatus>({
    queryKey: ['/api/blockchain/status'],
    refetchInterval: 30000,
  });

  const fetchDashboardData = useCallback(async () => {
    if (!issuerId) return;
    try {
      setIsLoadingDashboard(true);
      setDashboardError(null);
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
    const roots = Math.max(0, sourceCertificates.filter((c) => c.status !== 'revoked').length);
    const verified = Math.max(0, sourceCertificates.reduce((count, certificate) => count + (certificate.verificationCount || 0), 0));
    setStats((prev) => ({
      ...prev,
      totalDocuments: total,
      totalBatches: roots,
      totalVerifications: verified,
    }));
  };

  useEffect(() => {
    if (issuerId) fetchDashboardData();
  }, [issuerId, fetchDashboardData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && issuerId) fetchDashboardData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [issuerId, fetchDashboardData]);

  useEffect(() => {
    const nextCertificates = (batchesResponse?.batches || [])
      .map((batch) => ({ ...batch, batchId: batch.id, id: batch.documentId || batch.id }))
      .filter((batch) => !locallyDeletedCertificateIds.has(batch.id));
    setCertificates(nextCertificates);
    updateStats(nextCertificates);
  }, [batchesResponse, locallyDeletedCertificateIds]);

  useEffect(() => {
    if (statsFromApi) setStats(statsFromApi);
  }, [statsFromApi]);

  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!certificates.find((c: any) => c.id === id) || isDeletingDocument) return;
    const prevCertificates = certificates;
    try {
      setIsDeletingDocument(true);

      const res = await fetch(`/api/issuer/certificate/${id}/delete`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCertificates((prev: any[]) => {
          const next = prev.filter((c: any) => c.id !== id);
          updateStats(next);
          return next;
        });
        setLocallyDeletedCertificateIds((prev) => new Set(prev).add(id));
        toast({ title: "Document Deleted", description: "Certificate removed successfully." });
        await fetchDashboardData();
        return;
      }
      
      if (res.status === 404) {
        toast({ title: "Document Removed", description: "Certificate was already deleted." });
        await fetchDashboardData();
        return;
      }
      
      throw new Error(data?.error || data?.message || `Error: ${res.status}`);
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message || "Failed to delete certificate", variant: "destructive" });
    } finally {
      setIsDeletingDocument(false);
    }
  };

  const revokeMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest('POST', `/api/issuer/revoke`, { batchId });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({ title: "Document Revoked", description: `Document has been revoked on blockchain. TX: ${data.blockchain?.txHash?.slice(0, 16)}...` });
      await fetchDashboardData();
    },
    onError: (error: any) => {
      toast({ title: "Revocation Failed", description: error.message || "Failed to revoke document", variant: "destructive" });
    },
  });

  const unrevokeMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest('POST', `/api/issuer/unrevoke`, { batchId });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({ title: "Document Reconnected", description: `Document has been restored on blockchain. TX: ${data.blockchain?.txHash?.slice(0, 16)}...` });
      await fetchDashboardData();
    },
    onError: (error: any) => {
      toast({ title: "Reconnect Failed", description: error.message || "Failed to reconnect document", variant: "destructive" });
    },
  });

  const normalizedBlockchainStatus = String((blockchainStatus as any)?.status || (blockchainStatus as any)?.legacyStatus || "DISCONNECTED").toUpperCase();
  const blockchainStatusLabel = normalizedBlockchainStatus === "CONNECTED" ? "Connected" : normalizedBlockchainStatus === "DISCONNECTED" ? "Disconnected" : "Pending";
  
  const statusColors = {
    CONNECTED: { bg: "bg-[#16a34a]/10", text: "text-[#16a34a]", dot: "bg-[#16a34a]" },
    DISCONNECTED: { bg: "bg-[#fef2f2]", text: "text-[#dc2626]", dot: "bg-[#dc2626]" },
    PENDING: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" }
  };
  const activeStatus = statusColors[normalizedBlockchainStatus as keyof typeof statusColors] || statusColors.DISCONNECTED;

  const statCards = [
    { title: "Total Documents", value: stats.totalDocuments || 0, icon: FileText },
    { title: "Blockchain Roots", value: stats.totalBatches || 0, icon: LinkIcon },
    { title: "Verifications", value: stats.totalVerifications || 0, icon: CheckCircle },
    { title: "Success Rate", value: stats.successRate ? `${stats.successRate.toFixed(1)}%` : '0%', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-[#111827] overflow-x-hidden pb-24">
      <IssuerNavbar />

      <main className="max-w-[1200px] w-full mx-auto px-6 lg:px-8 py-12">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-[#e5e7eb] pb-8 w-full">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#111827]">Issuer Workspace</h1>
            <p className="text-base text-[#6b7280]">Manage cryptographic documents and monitor your infrastructure.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => fetchDashboardData()} 
              variant="outline"
              disabled={isLoadingDashboard}
              className="h-11 px-5 bg-[#ffffff] border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 rounded-[8px] shadow-sm font-semibold"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
              {isLoadingDashboard ? 'Syncing...' : 'Sync State'}
            </Button>
            <Button 
              onClick={() => navigate("/certificate/create")} 
              className="h-11 px-6 rounded-[8px] font-semibold bg-[#111827] text-white hover:bg-[#000000] shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-[2px]"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Issue Certificate
            </Button>
          </div>
        </div>

        {/* ERROR STATE */}
        {(isBatchesError || isBlockchainError || dashboardError) && (
          <div className="mb-8 p-5 rounded-[12px] border border-[#fca5a5] bg-[#fef2f2] text-[#dc2626] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 font-medium">
              <Ban className="w-5 h-5 text-[#dc2626]" />
              <span>{dashboardError || "Unable to reach complete consensus. Connection error."}</span>
            </div>
          </div>
        )}

        {/* STATS SYSTEM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 w-full">
          {statCards.map((card, idx) => (
            <div key={idx} className="group p-6 rounded-[12px] bg-[#ffffff] border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-300 flex flex-col justify-between cursor-default">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-[#6b7280]">{card.title}</h3>
                <div className="p-2.5 rounded-[10px] bg-[#f8fafc] group-hover:bg-[#f3f4f6] transition-colors duration-300">
                  <card.icon className="w-5 h-5 text-[#111827]" />
                </div>
              </div>
              <div>
                <span className="text-[32px] font-bold tracking-tight text-[#111827]">{card.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN SPLIT LAYOUT */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 w-full items-start">
          
          {/* LEFT: TABLE SECTION (min-w-0 ensures table wrapper doesn't force grid overflow) */}
          <div className="space-y-6 min-w-0 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold tracking-tight text-[#111827]">Recent Documents</h2>
            </div>
            
            <div className="bg-[#ffffff] border border-[#e5e7eb] rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                    <th className="px-4 py-3 w-[45%] md:w-[35%] lg:w-[20%] text-[11px] font-bold text-[#6b7280] uppercase tracking-wider truncate">Document ID</th>
                    <th className="px-4 py-3 hidden lg:table-cell lg:w-[20%] text-[11px] font-bold text-[#6b7280] uppercase tracking-wider truncate">Details</th>
                    <th className="px-4 py-3 hidden md:table-cell md:w-[30%] lg:w-[25%] text-[11px] font-bold text-[#6b7280] uppercase tracking-wider truncate">Merkle Hash</th>
                    <th className="px-4 py-3 w-[30%] md:w-[15%] lg:w-[15%] text-[11px] font-bold text-[#6b7280] uppercase tracking-wider truncate">Status</th>
                    <th className="px-4 py-3 w-[25%] md:w-[20%] lg:w-[20%] text-[11px] font-bold text-[#6b7280] uppercase tracking-wider text-right truncate">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {isBatchesLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-[#6b7280]">
                        <div className="flex flex-col items-center gap-3 font-medium">
                          <RefreshCw className="w-5 h-5 animate-spin text-[#6b7280]" />
                          <span className="text-[13px]">Loading records...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(!isBatchesLoading && certificates.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#6b7280]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-[#111827]">No records found</span>
                            <span className="text-[12px] text-[#6b7280] mt-1">When you issue certificates, they will appear here.</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {certificates.map((batch) => (
                    <tr key={batch.id} className="hover:bg-[#f9fafb] transition-colors duration-150 group">
                      <td className="px-4 py-3 truncate">
                        <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                          <span className="text-[13px] font-bold text-[#111827] truncate block w-full">{batch.batchName}</span>
                          <span className="text-[11px] text-[#6b7280] truncate block w-full">{new Date(batch.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell truncate">
                        <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                          <span className="text-[13px] font-medium text-[#111827] truncate block w-full">{batch.documentCount} items</span>
                          <span className="text-[11px] text-[#6b7280] truncate block w-full">{batch.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell truncate">
                        {batch.merkleRoot ? (
                          <div className="w-full overflow-hidden">
                            <code className="block w-full truncate text-[12px] text-[#6b7280] bg-[#f8fafc] px-2 py-1 rounded-[6px] border border-[#e5e7eb] font-mono tracking-tight group-hover:bg-[#ffffff] transition-colors">
                              {batch.merkleRoot}
                            </code>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-[#6b7280] truncate">Processing...</span>
                        )}
                      </td>
                      <td className="px-4 py-3 truncate">
                         {batch.status === 'revoked' ? (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef2f2] text-[#dc2626] border border-[#fee2e2] max-w-full overflow-hidden">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#dc2626] shrink-0" />
                             <span className="text-[10px] font-bold uppercase tracking-wider truncate">Revoked</span>
                           </div>
                         ) : batch.blockchainStatus === 'CONFIRMED' ? (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16a34a]/10 text-[#16a34a] border border-[#16a34a]/20 max-w-full overflow-hidden">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a] shrink-0" />
                             <span className="text-[10px] font-bold uppercase tracking-wider truncate">Confirmed</span>
                           </div>
                         ) : batch.blockchainStatus === 'FAILED' ? (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef2f2] text-[#dc2626] border border-[#fee2e2] max-w-full overflow-hidden">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#dc2626] shrink-0" />
                             <span className="text-[10px] font-bold uppercase tracking-wider truncate">Failed</span>
                           </div>
                         ) : (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 max-w-full overflow-hidden">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse shrink-0" />
                             <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pending</span>
                           </div>
                         )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {batch.status === 'revoked' && batch.merkleRoot && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={unrevokeMutation.isPending || isDeletingDocument} className="h-8 w-8 text-[#16a34a] hover:text-[#15803d] hover:bg-[#f0fdf4] rounded-[6px] transition-all duration-200" title="Reconnect">
                                  <LinkIcon className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-[12px] p-6 sm:max-w-md border border-[#e5e7eb] shadow-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-xl font-bold text-[#111827]">Reconnect Document (Revoke)</AlertDialogTitle>
                                  <AlertDialogDescription className="text-[#6b7280] mt-2">
                                    This will unrevoke "{batch.batchName}" permanently on the blockchain. Verifications will succeed again.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6">
                                  <AlertDialogCancel className="rounded-[8px] h-10 px-4 font-semibold border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6]">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => unrevokeMutation.mutate(batch.batchId)} className="rounded-[8px] h-10 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                                    Confirm Reconnect
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isDeletingDocument} className="h-8 w-8 text-[#6b7280] hover:text-[#dc2626] hover:bg-[#fef2f2] rounded-[6px] transition-all duration-200" title="Delete Record">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[12px] p-6 sm:max-w-md border border-[#e5e7eb] shadow-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold text-[#111827]">Delete Record</AlertDialogTitle>
                                <AlertDialogDescription className="text-[#6b7280] mt-2">
                                  How would you like to delete "{batch.batchName}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="flex flex-col gap-3 mt-4">
                                <div className="text-sm text-[#4b5563]">
                                  <strong>Permanent Delete</strong>: Removes it entirely from your dashboard.
                                </div>
                                <div className="text-sm text-[#4b5563]">
                                  <strong>Delete (Soft Delete)</strong>: It stays on the dashboard but is deleted (revoked) from the blockchain.
                                </div>
                              </div>
                              <AlertDialogFooter className="mt-6 sm:justify-between items-center w-full flex-row">
                                <AlertDialogCancel className="rounded-[8px] h-10 px-4 font-semibold border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6]">Cancel</AlertDialogCancel>
                                <div className="flex gap-2">
                                  {batch.status !== 'revoked' && (
                                    <AlertDialogAction onClick={() => revokeMutation.mutate(batch.batchId)} className="rounded-[8px] h-10 px-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-none">
                                      Delete
                                    </AlertDialogAction>
                                  )}
                                  <AlertDialogAction onClick={() => handleDelete(batch.id)} className="rounded-[8px] h-10 px-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-none">
                                    Permanent Delete
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: INFRASTRUCTURE PANEL (fixed width) */}
          <div className="space-y-6 w-full lg:w-[320px]">
             <h2 className="text-[18px] font-bold tracking-tight text-[#111827] pl-1">Infrastructure</h2>
             
             <div className="rounded-[12px] bg-[#ffffff] p-6 border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-[10px] bg-[#f8fafc] border border-[#e5e7eb]">
                      <Database className="w-5 h-5 text-[#111827]" />
                    </div>
                    <span className="font-bold text-[#111827] tracking-tight">Node Status</span>
                  </div>
                  
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${activeStatus.bg} border border-transparent`}>
                    <div className={`w-2 h-2 rounded-full ${activeStatus.dot} animate-pulse`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${activeStatus.text}`}>
                      {isBlockchainLoading ? '...' : blockchainStatusLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-0 relative w-full">
                  <div className="flex flex-col gap-1 border-b border-[#e5e7eb] py-4 w-full">
                    <span className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Environment</span>
                    <span className="text-[15px] font-semibold text-[#111827] flex items-center gap-2 truncate">
                      {blockchainStatus?.network || 'Sepolia Testnet'} <Activity className="w-4 h-4 text-[#2563eb]" />
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 border-b border-[#e5e7eb] py-4 w-full">
                    <span className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Consensus Height</span>
                    <span className="text-[15px] font-mono text-[#111827] tracking-tight font-semibold truncate">
                      {isBlockchainLoading ? '...' : `#${blockchainStatus?.blockHeight || '0'}`}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 py-4 w-full">
                     <span className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Mempool Gas</span>
                     <span className="text-[15px] font-mono text-[#111827] tracking-tight font-semibold truncate">
                      {isBlockchainLoading ? '...' : `${blockchainStatus?.gasPrice || '0'} GWEI`}
                     </span>
                  </div>
                </div>
             </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
