import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2 } from "lucide-react";

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ProcessingStatusProps {
  isProcessing: boolean;
  onProcessingComplete?: () => void;
}

export default function ProcessingStatus({ isProcessing, onProcessingComplete }: ProcessingStatusProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: 'parsing',
      title: 'Parsing CSV Data',
      description: 'Reading and validating CSV file structure',
      status: 'pending'
    },
    {
      id: 'hashing',
      title: 'Computing Hashes',
      description: 'Generating cryptographic hashes for each record',
      status: 'pending'
    },
    {
      id: 'signing',
      title: 'Digital Signing',
      description: 'Creating digital signatures for document integrity',
      status: 'pending'
    },
    {
      id: 'merkle',
      title: 'Building Merkle Tree',
      description: 'Constructing Merkle tree and generating proofs',
      status: 'pending'
    },
    {
      id: 'blockchain',
      title: 'Blockchain Storage',
      description: 'Storing Merkle root on testnet blockchain',
      status: 'pending'
    }
  ]);

  // Update visibility based on processing prop
  useEffect(() => {
    setIsVisible(isProcessing);
  }, [isProcessing]);

  // Simulate processing steps (this would be driven by real events in production)
  useEffect(() => {
    if (!isVisible) return;

    const processSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        // Update current step to processing
        setSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'processing' } : step
        ));
        
        // Simulate processing time
        const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        // Complete current step
        setSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'completed' } : step
        ));
        
        // Update progress
        setProgress(((i + 1) / steps.length) * 100);
      }
      
      // Hide after completion
      setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
        setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
        onProcessingComplete?.();
      }, 2000);
    };

    processSteps();
  }, [isVisible]);

  // No longer needed - processing is controlled by props

  if (!isVisible) return null;

  return (
    <div className="bg-accent rounded-lg p-6 border border-border" data-testid="processing-status">
      <div className="flex items-center space-x-3 mb-4">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-accent-foreground">Processing Documents</h3>
          <Progress value={progress} className="mt-2" data-testid="progress-processing" />
        </div>
        <span className="text-sm text-muted-foreground" data-testid="text-progress-percentage">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className="flex items-center space-x-3"
            data-testid={`processing-step-${step.id}`}
          >
            <div className="flex-shrink-0">
              {step.status === 'completed' ? (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              ) : step.status === 'processing' ? (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                </div>
              ) : (
                <div className="w-6 h-6 bg-muted-foreground rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{index + 1}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-accent-foreground">{step.title}</h4>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
            <div className="text-sm font-medium">
              {step.status === 'completed' && (
                <span className="text-green-600">✓ Complete</span>
              )}
              {step.status === 'processing' && (
                <span className="text-primary">Processing...</span>
              )}
              {step.status === 'pending' && (
                <span className="text-muted-foreground">Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
