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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("docutrust_token")
  );
  const [isLoading, setIsLoading] = useState(true);

  // On mount, verify existing token
  useEffect(() => {
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Invalid token");
        })
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem("docutrust_token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

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
    
    // Step 1: Immediately save token to localStorage
    localStorage.setItem("docutrust_token", data.token);
    
    // Step 2: Update state (synchronous but batched by React)
    setToken(data.token);
    setUser(data.user);
    
    // Step 3: Small delay to ensure state updates are flushed to DOM
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
    setToken(null);
    setUser(null);
    localStorage.removeItem("docutrust_token");
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
