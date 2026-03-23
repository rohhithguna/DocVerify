import { useLocation, useNavigate } from "react-router-dom";
import { FileText, LogOut, PlusCircle, LayoutDashboard, PenLine, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function IssuerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Details", path: "/certificate/create", icon: PlusCircle },
    { label: "Signature", path: "/certificate/sign", icon: PenLine },
    { label: "Preview", path: "/certificate/preview", icon: Eye },
  ];

  return (
    <>
      {/* MINIMAL TOP HEADER */}
      <header className="bg-[#ffffff] border-b border-[#e5e7eb] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            
            {/* Logo */}
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2.5 text-[#111827] hover:opacity-80 transition-opacity"
              data-testid="issuer-navbar-logo"
            >
              <div className="w-8 h-8 bg-[#111827] rounded-full flex items-center justify-center shadow-sm">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-[19px] tracking-tight">DocuTrust</span>
            </button>

            {/* User Info & Actions */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="hidden sm:block text-[13px] font-medium text-[#6b7280]">
                  {user.name} <span className="opacity-60 font-normal">({user.email})</span>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="gap-2 h-9 px-4 rounded-[8px] border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] font-semibold transition-colors"
                data-testid="issuer-nav-logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
            
          </div>
        </div>
      </header>

      {/* ULTRA MINIMAL FROSTED GLASS TOP NAVIGATION */}
      <div className="w-full px-4 sm:px-6 flex justify-center relative z-40">
        <nav 
          className="max-w-[840px] w-full mx-auto my-5 flex items-center justify-between overflow-x-auto scroll-smooth no-scrollbar rounded-full gap-1 sm:gap-2"
          style={{
            padding: '4px 6px',
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-1 items-center justify-center gap-2 min-w-max sm:min-w-0 transition-all duration-200 ease-out rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a] focus-visible:ring-offset-2 ${
                  isActive 
                    ? 'bg-[#0f172a] text-white font-medium' 
                    : 'text-[#6b7280] bg-transparent hover:bg-black/[0.04] hover:text-[#0f172a]'
                }`}
                style={{
                  padding: isActive ? '6px 14px' : '6px 12px',
                  boxShadow: isActive ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : 'none'
                }}
              >
                <Icon className={`w-[15px] h-[15px] sm:w-[16px] sm:h-[16px] shrink-0 ${isActive ? 'text-white' : ''}`} />
                <span className="text-[13px] sm:text-[14px] font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
