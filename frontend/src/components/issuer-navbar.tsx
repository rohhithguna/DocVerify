import { useLocation, useNavigate } from "react-router-dom";
import { FileText, LogOut, PlusCircle, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function IssuerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Certificate Details", path: "/certificate/create", icon: PlusCircle },
    { label: "Signature", path: "/certificate/sign", icon: FileText },
    { label: "Certificate Preview", path: "/certificate/preview", icon: LayoutDashboard },
  ];

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            data-testid="issuer-navbar-logo"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">DocuTrust</span>
          </button>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => navigate(item.path)}
                  className="gap-2"
                  data-testid={`issuer-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden lg:block text-sm text-muted-foreground">
                {user.name} ({user.email})
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="gap-2"
              data-testid="issuer-nav-logout"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
        <div className="md:hidden pb-3 flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={`mobile-${item.path}`}
                variant={isActive ? "default" : "ghost"}
                onClick={() => navigate(item.path)}
                className="gap-2 flex-1"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
