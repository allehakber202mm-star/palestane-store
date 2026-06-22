import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

// Public Pages
import Home from "@/pages/home";
import Accounts from "@/pages/accounts";
import AccountDetails from "@/pages/account-details";
import About from "@/pages/about";
import Feedback from "@/pages/feedback";
import Contact from "@/pages/contact";
import CelebrityAds from "@/pages/celebrity-ads";

// Admin Pages
import AdminLogin from "@/pages/admin/login";
import AdminAccounts from "@/pages/admin/accounts";
import AdminStats from "@/pages/admin/stats";
import AdminSettings from "@/pages/admin/settings";
import AdminCelebrityAds from "@/pages/admin/celebrity-ads";
import AdminFeedback from "@/pages/admin/feedback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  if (!isAuthenticated) return <Redirect to="/admin/login" />;
  return <Component />;
}

function AdminRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Redirect to={isAuthenticated ? "/admin/accounts" : "/admin/login"} />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/account/:id" component={AccountDetails} />
      <Route path="/about" component={About} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/contact" component={Contact} />
      <Route path="/celebrity-ads" component={CelebrityAds} />

      {/* Admin Routes */}
      <Route path="/admin" component={AdminRedirect} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminRedirect} />
      <Route path="/admin/accounts">
        <ProtectedRoute component={AdminAccounts} />
      </Route>
      <Route path="/admin/stats">
        <ProtectedRoute component={AdminStats} />
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute component={AdminSettings} />
      </Route>
      <Route path="/admin/celebrity-ads">
        <ProtectedRoute component={AdminCelebrityAds} />
      </Route>
      <Route path="/admin/feedback">
        <ProtectedRoute component={AdminFeedback} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="palestine-store-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
