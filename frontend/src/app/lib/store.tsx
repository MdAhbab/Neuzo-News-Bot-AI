import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import * as api from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  hasToken: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on boot, mirroring the original App.tsx mount effect.
    api
      .me()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    setUser(await api.login(email, password));
  };
  const signUp = async (email: string, password: string) => {
    setUser(await api.signup(email, password));
  };
  const signOut = () => {
    api.logout();
    setUser(null);
    toast("Signed out");
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        hasToken:
          typeof window !== "undefined" && !!localStorage.getItem("neuzo_auth_token"),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
