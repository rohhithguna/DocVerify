import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Upload, Search, LogIn, FileText, CheckCircle2, Zap, Loader2, Database, Key, ArrowRight, Blocks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [searchHash, setSearchHash] = useState("");
  const [verifyState, setVerifyState] = useState<'idle' | 'processing' | 'verified'>('idle');

  const handleMockVerify = () => {
    if (!searchHash.trim() || verifyState !== 'idle') return;
    
    setVerifyState('processing');
    
    // Fake processing animation
    setTimeout(() => {
      setVerifyState('verified');
      
      // Reset back to idle after a few seconds
      setTimeout(() => {
        setVerifyState('idle');
        setSearchHash('');
      }, 4000);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-blue-100 selection:text-blue-900 pb-32">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#e5e7eb] sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#111827] rounded-full flex items-center justify-center shadow-sm">
               <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-[19px] tracking-tight text-[#111827]">DocuTrust</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-[13.5px] font-medium text-[#6b7280] hidden sm:block">
                  {user.name}
                </span>
                <Button 
                  onClick={() => navigate("/dashboard")}
                  className="rounded-full bg-[#111827] text-white hover:bg-black font-semibold h-9 px-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-[1px]"
                >
                  Dashboard
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => navigate("/login")}
                className="rounded-[8px] bg-white border border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] font-semibold h-9 px-4 transition-colors shadow-sm"
              >
                <LogIn className="h-4 w-4 mr-2 text-[#6b7280]" />
                Issuer Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-[1000px] mx-auto px-6 pt-24 pb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 mb-8 mx-auto shadow-sm">
          <Zap className="w-[14px] h-[14px] fill-blue-500 text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Fastest On-Chain Verification</span>
        </div>
        
        <h1 className="text-[40px] md:text-[64px] font-bold text-[#111827] tracking-tight leading-[1.1] mb-6">
          Cryptographic reality<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500">for digital documents.</span>
        </h1>
        
        <p className="text-[18px] md:text-[20px] text-[#6b7280] max-w-[640px] mx-auto leading-relaxed font-normal mb-10">
          Compute irreversible SHA-256 state hashes, secure files to the Ethereum blockchain, and publicly verify authenticity without third-party reliance.
        </p>

        {/* Interactive Verification Input Box */}
        <div className="max-w-[600px] mx-auto bg-white p-2 rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-[#e5e7eb] flex items-center relative overflow-hidden transition-all duration-300 hover:shadow-[0_16px_50px_rgba(0,0,0,0.08)]">
           <Search className={`w-[20px] h-[20px] text-[#9ca3af] ml-3 shrink-0 transition-opacity ${verifyState === 'processing' ? 'opacity-0' : 'opacity-100'}`} />
           
           {verifyState === 'processing' && (
             <Loader2 className="w-[20px] h-[20px] text-blue-600 ml-3 shrink-0 animate-spin absolute left-2" />
           )}
           
           <input 
             type="text" 
             placeholder={verifyState === 'processing' ? "Querying Ethereum mainnet..." : "Paste Document SHA-256 Hash or File URL..."}
             value={searchHash}
             onChange={(e) => setSearchHash(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleMockVerify()}
             disabled={verifyState !== 'idle'}
             className="w-full bg-transparent border-none outline-none px-3 text-[15px] h-12 text-[#111827] placeholder:text-[#9ca3af] disabled:opacity-70 disabled:bg-transparent" 
           />
           
           <Button 
             className={`rounded-[12px] px-6 h-11 font-semibold transition-all duration-300 ml-2 ${
               verifyState === 'verified' 
                 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' 
                 : 'bg-[#111827] hover:bg-black text-white hover:-translate-y-[1px] shadow-[0_4px_14px_rgba(0,0,0,0.1)]'
             }`} 
             onClick={handleMockVerify}
             disabled={verifyState !== 'idle'}
           >
             {verifyState === 'verified' ? (
                <span className="flex items-center gap-1.5 animate-in slide-in-from-bottom-2"><CheckCircle2 className="w-4 h-4" /> Authenticated</span>
             ) : (
                "Verify Now"
             )}
           </Button>
        </div>

        {/* Trust Signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 md:mt-12 text-[#6b7280]">
          <div className="flex items-center gap-2 text-[13px] font-medium opacity-80 hover:opacity-100 transition-opacity">
            <Shield className="w-4 h-4 text-[#111827]" /> SHA-256 Secured
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-[#e5e7eb]" />
          <div className="flex items-center gap-2 text-[13px] font-medium opacity-80 hover:opacity-100 transition-opacity">
            <Blocks className="w-4 h-4 text-[#111827]" /> Ethereum Verified
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-[#e5e7eb]" />
          <div className="flex items-center gap-2 text-[13px] font-medium opacity-80 hover:opacity-100 transition-opacity">
             <Zap className="w-4 h-4 text-[#111827]" /> Real-time Nodes
          </div>
        </div>
      </section>

      {/* Primary Action Cards */}
      <section className="max-w-[1000px] mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center lg:px-8">
          
          {/* Issue Card (Secondary) */}
          <Card 
            className="group border border-[#e5e7eb] bg-white cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-400 overflow-hidden" 
            onClick={() => navigate(user ? "/dashboard" : "/login")}
          >
            <CardContent className="p-8 sm:p-10 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d1d5db] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-14 h-14 bg-[#f3f4f6] rounded-[16px] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#111827] transition-all duration-400">
                <Upload className="h-6 w-6 text-[#111827] group-hover:text-white transition-colors duration-400" />
              </div>
              <h3 className="text-2xl font-bold text-[#111827] mb-3 tracking-tight">
                Mint Documents
              </h3>
              <p className="text-[15px] text-[#6b7280] leading-relaxed mb-8">
                Authorized instances can compute secure hashes and embed tamper-proof credentials firmly into the blockchain state.
              </p>
              <div className="flex items-center text-[14px] font-semibold text-[#111827] group-hover:text-blue-600 transition-colors">
                 {user ? "Enter Dashboard" : "Issuer Authentication"} <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Verify Card (Primary Focus) */}
          <Card 
            className="group border border-transparent ring-1 ring-black/5 bg-white cursor-pointer md:scale-105 hover:-translate-y-3 hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)] transition-all duration-500 relative overflow-hidden z-10" 
            onClick={() => navigate("/verify")}
          >
            <CardContent className="p-8 sm:p-10 relative">
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_auto] animate-gradient" />
              
              <div className="absolute top-8 right-8">
                 <span className="bg-green-50 text-green-700 text-[10px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-wider border border-green-200 shadow-sm">
                   Open Access
                 </span>
              </div>

              <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-[16px] flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-[26px] font-bold text-[#111827] mb-3 tracking-tight">
                Verify Document
              </h3>
              <p className="text-[15px] text-[#4b5563] leading-relaxed mb-8 pr-10">
                Instantly audit file integrity. The system queries public ledgers in real-time to guarantee authenticity. No account required.
              </p>
              
              <Button className="w-full h-12 text-[15px] rounded-[10px] bg-[#111827] hover:bg-black font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.1)] group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition-all group-hover:-translate-y-0.5">
                Launch Auditor <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Visual Flow Section */}
      <section className="mt-32 max-w-[1100px] mx-auto px-6 overflow-hidden">
        <div className="text-center mb-16">
          <h3 className="text-[28px] font-bold tracking-tight text-[#111827]">The Cryptographic Pipeline</h3>
          <p className="text-[#6b7280] mt-2 font-medium">Deterministic verification from upload to audit.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative max-w-[900px] mx-auto">
           {/* Desktop subtle connector line */}
           <div className="absolute top-[40px] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#e5e7eb] to-transparent hidden md:block" />

           {/* Flow Steps */}
           {[
             { title: "Upload", icon: Upload, desc: "Raw file is read instantly." },
             { title: "Hash", icon: Key, desc: "Secure SHA-256 generated." },
             { title: "Store", icon: Database, desc: "Pinned to immutable ledger." },
             { title: "Verify", icon: Shield, desc: "Global access confirmed." }
           ].map((step, i) => (
             <div key={i} className="relative z-10 flex flex-col items-center text-center group cursor-default">
               <div className="w-[80px] h-[80px] bg-white border border-[#e5e7eb] rounded-full flex items-center justify-center mb-5 shadow-[0_8px_20px_rgba(0,0,0,0.03)] group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)] group-hover:-translate-y-1 transition-all duration-300">
                  <step.icon className="w-8 h-8 text-[#111827] opacity-80 group-hover:text-blue-600 group-hover:opacity-100 transition-colors" />
               </div>
               <h4 className="font-bold text-[#111827] text-[16px] mb-1.5">{step.title}</h4>
               <p className="text-[13px] text-[#6b7280] leading-relaxed max-w-[160px]">{step.desc}</p>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
}
