import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  organization?: string;
}

async function getApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse errors and use fallback message.
  }

  return fallbackMessage;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_STORAGE_KEY = "docutrust_token";

let secureToken: string | null = null;

function readTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const sessionToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (sessionToken) return sessionToken;

  // Backward compatibility: migrate previous localStorage token once.
  const legacyToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (legacyToken) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, legacyToken);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return legacyToken;
  }

  return null;
}

function getStoredToken(): string | null {
  if (!secureToken) {
    secureToken = readTokenFromStorage();
  }
  return secureToken;
}

function setStoredToken(token: string | null) {
  secureToken = token;
  if (typeof window === "undefined") return;

  if (token) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  // Verify existing token with retry and proper cleanup to avoid stale updates.
  useEffect(() => {
    let isDisposed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const verifyTokenWithRetry = async (attemptsLeft: number, tokenToVerify: string) => {
      if (isDisposed) return;

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${tokenToVerify}` },
        });

        if (isDisposed) return;

        if (res.status === 401) {
          setStoredToken(null);
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (res.status >= 500 && attemptsLeft > 0) {
          retryTimeout = setTimeout(() => {
            void verifyTokenWithRetry(attemptsLeft - 1, tokenToVerify);
          }, 1000);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (isDisposed) return;
          setUser(data);
          setIsLoading(false);
          return;
        }

        setStoredToken(null);
        setToken(null);
        setUser(null);
        setIsLoading(false);
      } catch {
        if (isDisposed) return;
        setIsLoading(false);
      }
    };

    if (token) {
      void verifyTokenWithRetry(2, token);
    } else {
      setUser(null);
      setIsLoading(false);
    }

    const syncTokenFromStorage = () => {
      const nextToken = readTokenFromStorage();
      secureToken = nextToken;
      setToken(nextToken);
      if (!nextToken) {
        setUser(null);
      }
    };

    window.addEventListener("storage", syncTokenFromStorage);

    return () => {
      isDisposed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      window.removeEventListener("storage", syncTokenFromStorage);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (!res.ok) {
      const message = await getApiErrorMessage(res, "Login failed");
      throw new Error(message);
    }

    const data = await res.json();
    
    setStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
    
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const register = async ({ email, password, name, organization }: RegisterData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim(), organization }),
    });

    if (!res.ok) {
      const message = await getApiErrorMessage(res, "Registration failed");
      throw new Error(message);
    }

    await res.json();
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
