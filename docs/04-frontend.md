# 04 - Frontend System

## Overview

The frontend is a **React 18 single-page application** built with TypeScript, featuring separate user experiences for issuers and verifiers. It uses modern state management with TanStack Query for server state and React Context for client state.

## Technology Stack

| Tool | Purpose |
|------|---------|
| **React 18** | UI library with concurrent rendering |
| **TypeScript** | Type safety and IDE support |
| **Vite** | Build tool and dev server (< 1s HMR) |
| **React Router** | Client-side routing |
| **TanStack Query (React Query)** | Server state management, caching, synchronization |
| **React Context** | Client-side state (auth, form drafts) |
| **Tailwind CSS** | Utility-first styling |
| **Lucide React** | Icon library |
| **Zod** | Runtime validation on client |

## Folder Structure

```
frontend/src/
├── pages/                       # Route-level components
│   ├── landing.tsx              # Public entry point
│   ├── login.tsx                # Authentication
│   ├── issuer-dashboard.tsx     # Issuer hub
│   ├── certificate-create.tsx   # Step-by-step creation
│   ├── certificate-sign.tsx     # Signature interface
│   ├── certificate-preview.tsx  # QR display & issuance
│   ├── verifier-dashboard.tsx   # Verification split view
│   ├── verify-certificate.tsx   # Detailed verification view
│   ├── results.tsx              # Verification results
│   └── not-found.tsx            # 404 fallback
│
├── components/                  # Reusable components
│   ├── certificate-form.tsx     # Form for certificate creation
│   ├── certificate-template.tsx # Certificate preview template
│   ├── file-upload.tsx          # File drop zone (CSV, images)
│   ├── issuer-navbar.tsx        # Navigation for issuer
│   ├── processing-status.tsx    # Batch processing indicator
│   ├── theme-provider.tsx       # Dark/light mode setup
│   ├── verification-results.tsx # Results display component
│   └── ui/                      # Shadcn UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── toast.tsx
│       └── ...
│
├── context/                     # Global state
│   └── issuer-certificate-draft.tsx  # Multi-step form state
│
├── hooks/                       # Custom React hooks
│   ├── use-auth.tsx             # Authentication context hook
│   ├── use-toast.ts             # Toast notification hook
│   └── use-mobile.tsx           # Responsive design hook
│
├── lib/                         # Utilities & config
│   ├── queryClient.ts           # TanStack Query setup
│   └── utils.ts                 # Helper functions
│
├── App.tsx                      # Router definition
├── main.tsx                     # React entry point
├── index.css                    # Global styles + Tailwind
└── vite-env.d.ts               # Vite type definitions
```

## Routing Architecture

```
Public Routes:
├── /                    → landing.tsx
├── /login               → login.tsx
└── /verify/:certId      → verify-certificate.tsx

Protected Routes (require JWT):
├── /dashboard           → issuer-dashboard.tsx
├── /certificate/create  → certificate-create.tsx
├── /certificate/sign    → certificate-sign.tsx
├── /certificate/preview → certificate-preview.tsx
│   └── /:id             → preview specific certificate
└── /certificate/:id     → detailed view

Verifier Routes:
├── /verify              → verifier-dashboard.tsx  (QR scan interface)
├── /verifier/:id        → verifier-dashboard.tsx  (scoped to verifier)
└── /results             → results.tsx             (verification results)

Not Found:
└── /*                   → not-found.tsx           (404 fallback)
```

## Page Components

### Landing (`pages/landing.tsx`)

**Purpose**: Unauthenticated entry point explaining the system

**Features**:
```
┌─────────────────────────────────────┐
│         DocuTrustChain              │
│    Digital Certificate Platform     │
├─────────────────────────────────────┤
│                                     │
│  Issue → Sign → Verify              │
│  Blockchain-backed certificates     │
│                                     │
│  [Get Started] [Learn More]         │
│                                     │
├─────────────────────────────────────┤
│  Features:                          │
│  • Cryptographic hashing            │
│  • Digital signatures               │
│  • Blockchain verification          │
│  • Revocation tracking              │
│  • QR code scanning                 │
└─────────────────────────────────────┘
```

**Behavior**:
- Display system benefits and flow
- Navigate to /login on CTA
- Show public verification info
- No authentication required

### Login (`pages/login.tsx`)

**Purpose**: User authentication

**Form**:
```typescript
interface LoginForm {
  email: string;        // Email address
  password: string;     // Password (min 8 chars)
  rememberMe?: boolean; // Optional session persistence
}
```

**Process**:
```
1. User enters credentials
2. Client-side validation
   ├─ Email format check
   ├─ Password minimum length
   └─ Display user-friendly errors
3. Submit to /api/auth/login
4. Backend validates & returns JWT
5. Store JWT in localStorage
6. Set auth context
7. Redirect based on role:
   ├─ Issuer → /dashboard
   ├─ Verifier → /verify
   └─ Admin → /admin (if implemented)
```

**Error Handling**:
```
Invalid credentials → "Email or password incorrect"
Missing fields → "All fields required"
Network error → "Connection failed. Please try again"
Server error → "Authentication failed. Please try again"
```

### Issuer Dashboard (`pages/issuer-dashboard.tsx`)

**Purpose**: Central hub for certificate management

**Layout**:
```
┌─────────────────────────────────────────┐
│  Navbar                                 │
├─────────────────────────────────────────┤
│                                         │
│  STATISTICS CARDS:                      │
│  ├─ Total Certificates       1,250      │
│  ├─ Pending Verification         45     │
│  ├─ Success Rate              94.2%     │
│  ├─ Last 24 Hours                 12    │
│                                         │
│  BATCHES TABLE:                         │
│  ├─ Batch Name                          │
│  ├─ Status (processing|signed|on-chain) │
│  ├─ Certificate Count                   │
│  ├─ Verification Rate                   │
│  ├─ Actions (revoke, delete, view)      │
│                                         │
│  BLOCKCHAIN STATUS INDICATOR:           │
│  ├─ Connected / Disconnected            │
│  ├─ Gas Price                           │
│  └─ Network (Sepolia / Mainnet)         │
│                                         │
│  ACTION BUTTONS:                        │
│  └─ [Issue New Batch]                   │
│     [View Analytics]                    │
│     [Export History]                    │
│                                         │
└─────────────────────────────────────────┘
```

**Data Flow**:
```
Component Mount
    │
    ├─ useAuth() → get issuerId
    │
    ├─ useQuery(/api/issuer/:id/batches)
    │  └─ Fetch paginated batch list
    │
    ├─ useQuery(/api/issuer/:id/stats)
    │  └─ Fetch aggregate statistics
    │
    └─ useQuery(/api/blockchain/status)
       └─ Fetch blockchain connection status

User Actions:
    │
    ├─ Revoke batch → POST /api/revoke/:batchId
    │
    ├─ Delete batch → DELETE /api/batch/:batchId
    │
    └─ Create new → Navigate to /certificate/create
```

**Features**:
- Real-time statistics updates
- Paginated batch listing (20 per page)
- Search/filter by batch name
- Status badges (processing, signed, on-chain)
- Quick actions dropdown (revoke, delete, details)
- Blockchain status indicator with auto-refresh

### Certificate Create (`pages/certificate-create.tsx`)

**Purpose**: Step-by-step multi-form certificate creation

**Workflow**:
```
Step 1: Recipient Details
├─ Full Name *
├─ Student/Academic ID *
└─ Email Address (optional)

Step 2: Certificate Information
├─ Event or Course Name *
├─ Issue Date *
├─ Expiry Date *
└─ Certificate Title (optional)

Step 3: Issuer Information  
├─ Issuer Name *
└─ Issuer Wallet Address (0x...) *

Step 4: Review & Finalize
├─ Display all entered data
├─ Show generated Certificate ID
├─ Show generated QR Code preview
│
└─ [Create Certificate] button
   └─ Generates QR & navigates to signing
```

**Validation Rules**:
```typescript
// Required fields with min/max lengths
recipientName:    string, min 2, max 100
studentId:        string, min 2, max 100  
recipientEmail:   email (optional)

eventName:        string, min 3, max 200
issueDate:        date (must be before expiry)
expiryDate:       date (must be after issue)

issuerName:       string, min 2, max 100
issuerWallet:     0x + 40 hex chars (Ethereum address)
```

**Implementation Details**:
```typescript
// State management
const { draft, updateDraft, generateCertificateId } = useIssuerCertificateDraft();

// Current step tracking
const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

// Form validation  
const isCurrentStepValid = () => {
  if (currentStep === 1) 
    return !!draft.recipientName && !!draft.studentId;
  if (currentStep === 2)
    return !!draft.eventName && !!draft.issueDate && !!draft.expiryDate;
  if (currentStep === 3)
    return !!draft.issuerName && isValidEthAddress(draft.issuerWallet);
  return true;
};

// Next/Previous navigation
const handleNext = () => {
  if (isCurrentStepValid()) setCurrentStep(Math.min(4, currentStep + 1));
};

// Finalization (QR generation)
const handleFinalize = async () => {
  const certId = draft.certificateId || generateCertificateId();
  const url = `${window.location.origin}/verify/${certId}`;
  
  const qrCode = await QRCode.toDataURL(url, {width: 220, margin: 1});
  updateDraft({certificateId: certId, qrCodeDataUrl: qrCode});
  navigate('/certificate/sign');
};
```

**Error Handling**:
```
Network error → Toast: "Failed to prepare certificate"
Invalid address → Inline error under wallet field
Soft validation → Real-time field-level feedback
Hard validation → Block Next button until step valid
QR generation timeout → Timeout after 8 seconds
```

### Certificate Signing (`pages/certificate-sign.tsx`)

**Purpose**: Collect digital signature from authorized signer

**Features**:
```
Layout:
┌──────────────────────────────────────┐
│  [← Back]                            │
│  Certificate Signature Step          │
├──────────────────────────────────────┤
│                                      │
│  MODE SELECTOR:                      │
│  [○ Draw Signature] [○ Upload Image] │
│                                      │
│  CANVAS AREA (if Draw):              │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │     <Signature Drawing Area>   │  │
│  │                                │  │
│  │  [X Clear] [↶ Undo]            │  │
│  └────────────────────────────────┘  │
│                                      │
│  OR FILE UPLOAD (if Upload):         │
│  [Drop signature image here]         │
│  [or click to browse]                │
│                                      │
│  PREVIEW:                            │
│  ─────────────────────────────────   │
│   Signature preview (base64 image)   │
│  ─────────────────────────────────   │
│                                      │
│  [Continue to Preview]               │
│                                      │
└──────────────────────────────────────┘
```

**Signature Capture**:
```typescript
// Canvas-based drawing
const canvasRef = useRef<HTMLCanvasElement>(null);
const [isDrawing, setIsDrawing] = useState(false);

const startDrawing = (e: React.MouseEvent) => {
  const ctx = canvasRef.current?.getContext('2d');
  const {x, y} = e.currentTarget.getBoundingClientRect();
  ctx?.beginPath();
  ctx?.moveTo(e.clientX - x, e.clientY - y);
  setIsDrawing(true);
};

const draw = (e: React.MouseEvent) => {
  if (!isDrawing) return;
  const ctx = canvasRef.current?.getContext('2d');
  const {x, y} = e.currentTarget.getBoundingClientRect();
  ctx?.lineTo(e.clientX - x, e.clientY - y);
  ctx?.stroke();
};

// Convert canvas to base64
const saveSignature = () => {
  const dataUrl = canvasRef.current?.toDataURL('image/png');
  updateDraft({signatureDataUrl: dataUrl});
};
```

**Validation**:
```
Empty signature → "Please provide a signature"
Too small → "Signature too small, please try again"
File size > 5MB → "Image too large"
Invalid format → "Only PNG/JPG/BMP images"
```

### Certificate Preview (`pages/certificate-preview.tsx`)

**Purpose**: Display certificate with QR code and issue certificate

**Layout**:
```
┌────────────────────────────────────────┐
│  [← Back]                              │
│  Certificate Preview & Issue           │
├────────────────────────────────────────┤
│                                        │
│  CERTIFICATE TEMPLATE:                 │
│  ┌──────────────────────────────────┐ │
│  │  ═══════════════════════════════  │ │
│  │  Certificate of Achievement      │ │
│  │  ═══════════════════════════════  │ │
│  │                                  │ │
│  │  This is to certify that         │ │
│  │  John Doe                        │ │
│  │                                  │ │
│  │  has successfully completed      │ │
│  │  Q1 2024 Training Program        │ │
│  │                                  │ │
│  │  Issued by: University           │ │
│  │  Date: January 15, 2024          │ │
│  │  Certificate ID: CERT-001        │ │
│  │                                  │ │
│  │  [QR Code Image]                 │ │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ACTIONS:                              │
│  [Download as PDF] [Print]             │
│  [Share Link]       [Issue Certificate]│
│                                        │
│  BLOCKCHAIN STATUS:                    │
│  ○ Pending initial save                │
│  ○ Awaiting blockchain submission      │
│                                        │
└────────────────────────────────────────┘
```

**Issue Process**:
```
1. User clicks "Issue Certificate"
2. Prepare certificate payload
   ├─ Recipient info
   ├─ Certificate details
   ├─ QR code data
   ├─ Signature
   └─ Metadata
3. Submit to backend
4. Backend:
   ├─ Hash certificate data
   ├─ Create document record
   ├─ Store in database
   └─ Return document ID
5. Update local state
6. Display success confirmation
   ├─ Share verification link
   ├─ Download certificate
   └─ Option to issue another
```

**Routes**: 
- `/certificate/preview?draftId={id}` - newly created
- `/certificate/preview/{id}` - view specific issued certificate

### Verifier Dashboard (`pages/verifier-dashboard.tsx`)

**Purpose**: Split interface for verification and dashboard

**Layout**:
```
VERIFY TAB (left 65%):
┌──────────────────────────────────────┐
│                                      │
│  Certificate Preview Area            │
│  (shows before/after upload)         │
│                                      │
│  [upload image placeholder]          │
│                                      │
├──────────────────────────────────────┤
│  File Upload Interface:              │
│                                      │
│  [Drop certificate image here]       │
│  [or click to browse]                │
│                                      │
│  Supported: PNG, JPG, PDF            │
│  Max size: 10 MB                     │
│                                      │
│  Status: Scanning document...        │
│  [Verifying...]                      │
│                                      │
│  [Run Manual Verification]           │
│                                      │
└──────────────────────────────────────┘

DASHBOARD TAB (right 35%):
┌──────────────────────────────────────┐
│  Verifications: 450                  │
│  Success Rate: 94.4%                 │
│  Failed: 25                          │
│  Last 24h: 12                        │
├──────────────────────────────────────┤
│                                      │
│  Recent Activity:                    │
│  ├─ certificate.png              95% │
│  │  Verified 2:30 PM              ✓  │
│  ├─ document-2.pdf               87% │
│  │  Verified 1:45 PM              ✓  │
│  ├─ expired.png                   0% │
│  │  Verified 1:15 PM              ✗  │
│  └─ ...                             │
│                                      │
│  [View Full History]                │
│                                      │
└──────────────────────────────────────┘
```

**Scanning Animation**:
```
Initial:     [waiting for upload...]

During:      ◯  ◯  ◯    (spinning rings)
             Verifying authenticity…
             Checking blockchain records

Complete:    ✓ Success
             or
             ✗ Failed
```

### Results Page (`pages/results.tsx`)

**Purpose**: Display detailed verification results

**Layout**:
```
┌────────────────────────────────────────┐
│  Verification Results                  │
├────────────────────────────────────────┤
│                                        │
│  STATUS CARD:                          │
│  ┌──────────────────────────────────┐ │
│  │                                  │ │
│  │          95%                     │ │
│  │       ✓ VALID                    │ │
│  │                                  │ │
│  │  Certificate Verified Successfully │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  DETAILED CHECKS:                      │
│  ├─ [✓] QR Metadata Valid              │
│  ├─ [✓] Blockchain Match Found         │
│  ├─ [✓] Tampering Check Passed         │
│  ├─ [✓] Merkle Proof Verified          │
│  │                                     │
│  └─ Status: VALID                      │
│     Not Revoked                        │
│     Confidence: 95%                    │
│                                        │
│  CERTIFICATE DETAILS:                  │
│  ├─ Name: John Doe                     │
│  ├─ Course: Q1 2024 Program            │
│  ├─ Issued by: University              │
│  ├─ Date: January 15, 2024             │
│  ├─ Hash: 0x1a2b3c... (shortened)      │
│  └─ Batch ID: batch-uuid               │
│                                        │
│  BLOCKCHAIN STATUS:                    │
│  ├─ Hash on Chain: Yes                 │
│  ├─ Revoked: No                        │
│  ├─ Timestamp: 1705333200              │
│  └─ Block: 5234567                     │
│                                        │
│  ACTIONS:                              │
│  [Verify Another] [Download Report]    │
│  [Share Result]   [Go Home]            │
│                                        │
└────────────────────────────────────────┘
```

**Result States**:
```typescript
type VerificationStatus = 
  | "VALID"        // All checks passed
  | "INVALID"      // Failed verification
  | "REVOKED"      // Certificate revoked
  | "NOT_FOUND"    // Certificate doesn't exist
  | "ORPHANED"     // Deleted locally but exists on-chain

Confidence score mapping:
├─ 100: All checks pass, blockchain confirmed
├─ 90: Missing signature, but hash and blockchain good
├─ 70: Merkle proof fails, but hash found
├─ 50: Blockchain unreachable, local checks pass
└─ 0: Failed, revoked, not found, or orphaned
```

## State Management

### Authentication Context (`context/auth.tsx`)

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: "issuer" | "verifier" | "admin";
  organization: string;
  createdAt: string;
}

interface AuthContext {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterForm) => Promise<void>;
}
```

**Implementation**:
- Store token in localStorage
- Auto-sync token to API headers
- Persist user on page reload
- Handle token expiration

### Certificate Draft Context (`context/issuer-certificate-draft.tsx`)

```typescript
interface CertificateDraft {
  // Recipient info
  recipientName: string;
  studentId: string;
  recipientEmail: string;
  
  // Certificate info
  eventName: string;
  issueDate: string;
  expiryDate: string;
  certificateTitle: string;
  
  // Issuer info
  issuerName: string;
  issuerWallet: string;
  
  // Generated data
  certificateId: string;
  qrCodeDataUrl: string;
  signatureDataUrl: string;
  
  // Status
  hasPreview: boolean;
  issuedDocumentId: string;
  issuedAt: string;
}

interface CertificateDraftContext {
  draft: CertificateDraft;
  updateDraft: (updates: Partial<CertificateDraft>) => void;
  resetDraft: () => void;
  generateCertificateId: () => string;
  buildPayload: () => CertificatePayload;
}
```

**Persistence**: 
- Stored in sessionStorage (cleared on browser close)
- Survives page refresh during multi-step process

## API Integration with TanStack Query

### Query Setup (`lib/queryClient.ts`)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      gcTime: 1000 * 60 * 30,          // 30 minutes (formerly cacheTime)
      retry: 2,                         // Retry failed requests
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Custom hooks for API calls
export function apiRequest(method: string, path: string, body?: any) {
  const token = localStorage.getItem('auth_token');
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(res => {
    if (res.status === 401) {
      // Token expired, clear and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return res;
  });
}
```

### Example Query Patterns

```typescript
// Get batch statistics
const { data: stats } = useQuery({
  queryKey: ['/api/issuer', issuerId, 'stats'],
  queryFn: () => apiRequest('GET', `/api/issuer/${issuerId}/stats`).then(r => r.json()),
  staleTime: 1000 * 60 * 10,  // 10 minutes
  enabled: !!issuerId,        // Only run if we have issuerId
});

// Get verification history with pagination
const [page, setPage] = useState(1);
const { data: historyResponse } = useQuery({
  queryKey: ['/api/verifier', verifierId, 'history', page],
  queryFn: () => apiRequest('GET', 
    `/api/verifier/${verifierId}/history?page=${page}&pageSize=20`
  ).then(r => r.json()),
  keepPreviousData: true,  // Keep old data while loading new page
});

// Mutation: Verify certificate
const verifyMutation = useMutation({
  mutationFn: async (formData: FormData) => {
    const res = await apiRequest('POST', '/api/verifier/verify', formData);
    return res.json();
  },
  onSuccess: (data) => {
    // Invalidate history cache to refetch
    queryClient.invalidateQueries({ 
      queryKey: ['/api/verifier', activeVerifierId, 'history'] 
    });
    
    // Navigate with result
    navigate('/results', { state: { verification: data } });
  },
  onError: (error) => {
    toast({ title: 'Verification failed', variant: 'destructive' });
  },
});
```

## Component Patterns

### Error Boundary Pattern

```typescript
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <CertificateList />
  </Suspense>
</ErrorBoundary>
```

### Lazy Loading

```typescript
const CertificateDetailModal = lazy(() => 
  import('./CertificateDetailModal')
);

<Suspense fallback={<ModalLoading />}>
  <CertificateDetailModal certificateId={id} />
</Suspense>
```

## Performance Optimization

### Code Splitting
- Route-based splitting with React.lazy()
- Modal components lazy-loaded on demand
- Util libraries excluded from main bundle

### Image Optimization
- QR codes: Base64 data URLs (no HTTP requests)
- Certificates: Lazy loaded only when tab opened
- Icons: Vector (SVG) via lucide-react

### Caching Strategy
```
API Responses (TanStack Query):
├─ Batch statistics: 10 min stale
├─ Verification history: 5 min stale
├─ User profile: 30 min stale
└─ Blockchain status: 1 min stale

Browser cache:
├─ Static assets: 1 year (hash-based)
├─ Vendor JS: 1 month (hash-based)
└─ CSS/images: 1 month (hash-based)
```

## Error Handling

### API Error Patterns

```typescript
try {
  const response = await apiRequest('POST', endpoint, data);
  const jsonData = await response.json();
  
  if (!response.ok) {
    throw new Error(jsonData.error?.message || `HTTP ${response.status}`);
  }
  
  return jsonData;
} catch (error) {
  console.error('API error:', error);
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
  throw error;
}
```

### Validation

```typescript
const certificateSchema = z.object({
  recipientName: z.string().min(2).max(100),
  studentId: z.string().min(2).max(100),
  eventName: z.string().min(3).max(200),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  issuerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// In form submission
try {
  const validated = certificateSchema.parse(formData);
  // Use validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      setFieldError(err.path.join('.'), err.message);
    });
  }
}
```

## Mobile Responsiveness

### Breakpoints (Tailwind)
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Responsive Layout

```typescript
// Stack on mobile, side-by-side on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards will stack on mobile */}
</div>

// Hide on mobile, show on tablet+
<div className="hidden md:block">
  {/* Desktop sidebar */}
</div>
```

## Accessibility

- Semantic HTML (buttons, labels, form controls)
- ARIA labels for non-obvious elements
- Keyboard navigation support
- Color contrast ≥ 4.5:1
- Focus indicators on interactive elements
