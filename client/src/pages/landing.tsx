import { useLocation } from "wouter";
import { Shield, Upload, Search, Lock, Link, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const selectRole = (role: 'issuer' | 'verifier') => {
    // Generate a simple ID for demo purposes
    const userId = `${role}_${Date.now()}`;
    setLocation(`/${role}/${userId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl text-foreground">DocuVerify</span>
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
            Secure, transparent, and tamper-proof document verification using Merkle trees and blockchain technology.
            Choose your role to begin the verification journey.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Issuer Card */}
          <Card className="group border-2 hover:border-primary hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">Document Issuer</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Upload bulk CSV documents, compute cryptographic hashes, and store Merkle roots on the blockchain for verification.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Bulk CSV Upload</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Digital Signing</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Blockchain Storage</span>
                  </div>
                </div>
                <Button 
                  onClick={() => selectRole('issuer')} 
                  className="w-full"
                  data-testid="button-select-issuer"
                >
                  Continue as Issuer
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
                <h3 className="text-2xl font-semibold text-foreground mb-4">Document Verifier</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Upload documents for verification, get confidence scores, and manage your verification history.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Document Verification</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Confidence Scoring</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>History Management</span>
                  </div>
                </div>
                <Button 
                  onClick={() => selectRole('verifier')} 
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="button-select-verifier"
                >
                  Continue as Verifier
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
            <p className="text-sm text-muted-foreground">Digital signatures and Merkle tree proofs ensure document authenticity</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Link className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Blockchain Verified</h4>
            <p className="text-sm text-muted-foreground">Merkle roots stored on testnet blockchain for immutable verification</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Gauge className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Instant Results</h4>
            <p className="text-sm text-muted-foreground">Real-time verification with detailed confidence scores</p>
          </div>
        </div>
      </div>
    </div>
  );
}
