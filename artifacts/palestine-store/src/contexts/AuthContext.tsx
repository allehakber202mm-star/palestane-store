import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetAdminMe, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, isError } = useGetAdminMe({
    query: {
      queryKey: getGetAdminMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  const isAuthenticated = !!user && !isError;
  const isLoading = isUserLoading;

  useEffect(() => {
    if (isError) {
      localStorage.removeItem("admin_token");
      setToken(null);
    }
  }, [isError]);

  const login = (newToken: string) => {
    localStorage.setItem("admin_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setLocation("/admin/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}