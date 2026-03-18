import { useLocation } from "wouter";
import { Shield, Upload, Search, Lock, Link, Gauge, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl text-foreground">DocuTrust</span>
            </div>
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    Welcome, {user.name}
                  </span>
                  <Button onClick={() => setLocation("/dashboard")}>
                    Dashboard
                  </Button>
                </>
              ) : (
                <Button onClick={() => setLocation("/login")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Blockchain-Powered<br />
            <span className="text-primary">Document Verification</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Secure, transparent, and tamper-proof document verification using
            SHA-256 hashing and Ethereum smart contracts.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Issuer Card */}
          <Card className="group border-2 hover:border-primary hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">
                  Issue Documents
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Upload documents, compute SHA-256 hashes, and store them
                  permanently on the Ethereum blockchain.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>SHA-256 Hashing</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Digital Signing</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Smart Contract Storage</span>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation(user ? "/dashboard" : "/login")}
                  className="w-full"
                >
                  {user ? "Go to Dashboard" : "Sign In to Issue"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Verifier Card */}
          <Card className="group border-2 hover:border-green-500 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-green-500/20 transition-colors">
                  <Search className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">
                  Verify Documents
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Upload any document to verify its authenticity against the
                  blockchain. No login required.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Instant Verification</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>On-Chain Lookup</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>No Login Required</span>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation("/verify")}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Verify a Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Cryptographically Secure</h4>
            <p className="text-sm text-muted-foreground">
              SHA-256 hashing and digital signatures ensure document authenticity
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Link className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Smart Contract</h4>
            <p className="text-sm text-muted-foreground">
              Real Solidity contract on Ethereum for immutable document records
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Gauge className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Instant Results</h4>
            <p className="text-sm text-muted-foreground">
              Real-time verification with clear authentic / not-found results
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
