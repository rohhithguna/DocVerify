import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register extra fields
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const { toast } = useToast();

  const isInfoMessage = error.toLowerCase().includes("successful");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Step 1: Login and wait for state updates
        await login(email, password);
        
        // Step 2: Show success toast
        toast({
          title: "Signed In",
          description: "Welcome back. Redirecting to your dashboard.",
        });
        
        // Step 3: Wait a bit for state to fully settle before redirect
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Step 4: Now redirect (state is ready)
        navigate("/dashboard");
      } else {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        await register({ email, password, name, organization });
        setIsLogin(true);
        setPassword("");
        setError("Registration successful. Please sign in.");
        toast({
          title: "Account Created",
          description: "Registration successful. You can now sign in.",
        });
        return;
      }
    } catch (err: any) {
      const message = err?.message || "Something went wrong";
      setError(message);
      toast({
        title: isLogin ? "Sign-In Failed" : "Registration Failed",
        description: message,
        variant: "destructive",
      });
      // Ensure loading state is reset on error
      setLoading(false);
    } finally {
      // Only set loading to false if we didn't already in catch block
      if (isLogin) {
        // Loading will stay true during redirect, which is fine
      } else {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <span className="font-bold text-2xl text-foreground">DocuTrust</span>
          </div>
          <p className="text-muted-foreground">
            Blockchain-powered document verification
          </p>
        </div>

        <Card className="border-2">
          <CardContent className="p-8">
            {/* Toggle Tabs */}
            <div className="flex mb-6 bg-muted rounded-lg p-1">
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isLogin
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
                onClick={() => { setIsLogin(true); setError(""); }}
                disabled={loading}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  !isLogin
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
                onClick={() => { setIsLogin(false); setError(""); }}
                disabled={loading}
              >
                <UserPlus className="h-4 w-4" />
                Register
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className={`text-sm p-3 rounded-lg mb-4 ${
                isInfoMessage ? "bg-green-50 text-green-700 border border-green-200" : "bg-destructive/10 text-destructive"
              }`}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      required={!isLogin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization (optional)</Label>
                    <Input
                      id="organization"
                      placeholder="MIT University"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={8}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isLogin
                    ? "Sign In"
                    : "Create Account"
                }
              </Button>
            </form>

            {/* Demo Info */}
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                For demo: Register with any email and password (min 8 chars)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Verify without login */}
        <div className="text-center mt-4">
          <Button
            variant="link"
            onClick={() => navigate("/verify")}
            className="text-muted-foreground"
          >
            Verify a document without logging in →
          </Button>
        </div>
      </div>
    </div>
  );
}
