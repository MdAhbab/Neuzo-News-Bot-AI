import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Toaster } from "./components/ui/sonner";
import { AppShell } from "./components/AppShell";
import { SmoothScroll } from "./components/SmoothScroll";
import { AuthProvider, useAuth } from "./lib/store";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Job from "./pages/Job";
import History from "./pages/History";
import Briefing from "./pages/Briefing";

const Pulse = lazy(() => import("./pages/Pulse"));
const Analytics = lazy(() => import("./pages/Analytics"));

function FullLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  useLocation(); // re-render on route change for SmoothScroll reset
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/jobs/:jobId" element={<Job />} />
        <Route
          path="/app/jobs/:jobId/pulse"
          element={
            <Suspense fallback={<FullLoader />}>
              <Pulse />
            </Suspense>
          }
        />
        <Route path="/app/history" element={<History />} />
        <Route path="/app/briefing" element={<Briefing />} />
        <Route
          path="/app/analytics"
          element={
            <Suspense fallback={<FullLoader />}>
              <Analytics />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange={false}>
      <AuthProvider>
        <BrowserRouter>
          <SmoothScroll>
            <AppRoutes />
          </SmoothScroll>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "var(--popover)",
                border: "1px solid var(--border)",
                color: "var(--popover-foreground)",
                fontFamily: "var(--font-body)",
                borderRadius: "var(--radius)",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
