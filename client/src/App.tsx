import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import { trpc } from "./_core/trpc";
import { useAuth } from "./_core/useAuth";
import PublicShell from "./components/PublicShell";
import { ButtonLink, Spinner } from "./components/ui";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./hooks/useToast";
import Admin from "./pages/Admin";
import AdminCases from "./pages/AdminCases";
import { AdminCategories, AdminDepartments, AdminOfficers, AdminUsers } from "./pages/AdminRegistry";
import Board from "./pages/Board";
import CaseDetail from "./pages/CaseDetail";
import Home from "./pages/Home";
import Manage from "./pages/Manage";
import StaffLogin from "./pages/StaffLogin";
import Submit from "./pages/Submit";
import Track from "./pages/Track";

function Guard({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/staff/login" />;
  if (admin && user.role !== "admin") return <Redirect to="/manage" />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-5 py-32 text-center">
        <h1 className="text-6xl">Page not found</h1>
        <p className="mt-4 text-lg text-mute">That address does not exist. <Link href="/" className="text-blue underline">Return home</Link> or track a case.</p>
        <div className="mt-8 flex justify-center gap-3"><ButtonLink href="/">Home</ButtonLink><ButtonLink href="/track" variant="outline">Track a case</ButtonLink></div>
      </div>
    </PublicShell>
  );
}

/** Lets in-page links such as "/#standards" scroll to their target after navigation. */
function ScrollToHash() {
  const [path] = useLocation();
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
    else window.scrollTo(0, 0);
  }, [path]);
  return null;
}

export default function App() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } }));
  // Unbatched links keep each procedure on its own URL, which lets the server rate-limit sensitive ones separately.
  const [client] = useState(() => trpc.createClient({ links: [httpLink({ url: "/api/trpc", fetch: (u, o) => fetch(u, { ...o, credentials: "include" }) })] }));
  return (
    <ThemeProvider>
      <trpc.Provider client={client} queryClient={qc}>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <ScrollToHash />
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/track" component={Track} />
              <Route path="/track/:trackingNumber" component={Track} />
              <Route path="/board" component={Board} />
              <Route path="/cases/new" component={Submit} />
              <Route path="/staff/login" component={StaffLogin} />
              <Route path="/manage"><Guard><Manage /></Guard></Route>
              <Route path="/officer/cases/:trackingNumber"><Guard><CaseDetail /></Guard></Route>
              <Route path="/admin"><Guard admin><Admin /></Guard></Route>
              <Route path="/admin/cases"><Guard admin><AdminCases /></Guard></Route>
              <Route path="/admin/departments"><Guard admin><AdminDepartments /></Guard></Route>
              <Route path="/admin/categories"><Guard admin><AdminCategories /></Guard></Route>
              <Route path="/admin/officers"><Guard admin><AdminOfficers /></Guard></Route>
              <Route path="/admin/users"><Guard admin><AdminUsers /></Guard></Route>
              <Route component={NotFound} />
            </Switch>
          </ToastProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  );
}
